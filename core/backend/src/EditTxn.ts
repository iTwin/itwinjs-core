/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64, Id64Arg, Id64Array, Id64Set, Id64String, IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { EcefLocation, EcefLocationProps, EditTxnError, ElementAspectProps, ElementProps, FilePropertyProps, IModelError, LocalFileName, ModelProps, RelationshipProps, SaveChangesArgs } from "@itwin/core-common";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import type { IModelDb, InsertElementOptions, SchemaImportOptions, UpdateModelOptions } from "./IModelDb";
import { _activeTxn, _cache, _implicitTxn, _instanceKeyCache, _nativeDb } from "./internal/Symbols";

const loggerCategory = BackendLoggerCategory.IModelDb;

/**
 * Represents an active editing transaction in an iModel.
 * All changes to the iModel must be made within an active EditTxn.
 * @beta
 */
export class EditTxn {
  /** The iModel this EditTxn may modify. */
  public readonly iModel: IModelDb;

  /** Description associated with this transaction. */
  public readonly description: string;

  /** True if this transaction currently owns the iModel write surface. */
  public get isActive(): boolean {
    return this.iModel[_activeTxn] === this;
  }

  public constructor(iModel: IModelDb, description: string) {
    this.iModel = iModel;
    this.description = description;
  }

  private restoreImplicitTxn(): void {
    this.iModel[_activeTxn] = this.iModel[_implicitTxn];
  }

  /** Throw if this EditTxn is not active. */
  protected requireActive(): void {
    if (!this.isActive)
      EditTxnError.throwError("not-active", "EditTxn is not active", this.iModel.key);
  }

  /** Start this EditTxn, making it the active transaction for the iModel.
   * @throws EditTxnError if unsaved changes are present.
   */
  public start(): void {
    const implicitTxn = this.iModel[_implicitTxn];
    // Explicit EditTxns can only begin while the implicit txn is active and empty
    if (this !== implicitTxn && this.iModel[_activeTxn] !== implicitTxn)
      EditTxnError.throwError("already-active", "Cannot start EditTxn while another EditTxn is active", this.iModel.key);

    if (this.iModel[_nativeDb].hasUnsavedChanges())
      EditTxnError.throwError("unsaved-changes", "Cannot start a new EditTxn with unsaved changes", this.iModel.key);

    this.iModel[_activeTxn] = this;
  }

  /** End this EditTxn, either by committing or canceling.
   * @param commit If true, commit the changes; otherwise, abandon them.
   * @param args Save changes arguments when committing.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public end(commit: boolean, args?: string | SaveChangesArgs): void {
    this.requireActive();

    if (commit) {
      this.saveChanges(args ?? this.description);
    } else {
      this.abandonChanges();
    }
    this.restoreImplicitTxn();
  }

  /** Commit the changes in this EditTxn.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public commit(args?: string | SaveChangesArgs): void {
    this.end(true, args);
  }

  /** Invoked when the owning iModel is closing.
   * Saves any unsaved changes owned by this transaction.
   */
  public onClose(): void {
    if (this.isActive && this.iModel[_nativeDb].hasUnsavedChanges())
      this.saveChanges();
  }

  /** Abandon database changes while keeping this EditTxn active.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public abandonChanges(): void {
    this.requireActive();
    this.iModel.clearCaches({ instanceCachesOnly: true });
    this.iModel[_nativeDb].abandonChanges();
  }

  /** Save changes with additional arguments.
   * @param args Save changes arguments.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public saveChanges(args?: string | SaveChangesArgs): void {
    this.requireActive();
    if (this.iModel.openMode === OpenMode.Readonly)
      throw new IModelError(IModelStatus.ReadOnly, "IModelDb was opened read-only");

    if (this.iModel.isBriefcaseDb() && this.iModel.txns.isIndirectChanges)
      throw new IModelError(IModelStatus.BadRequest, "Cannot save changes while in an indirect change scope");

    const saveArgs = typeof args === "string" ? { description: args } : args ?? { description: this.description };
    if (!this.iModel[_nativeDb].hasUnsavedChanges())
      Logger.logWarning(loggerCategory, "there are no unsaved changes", () => saveArgs);

    const stat = this.iModel[_nativeDb].saveChanges(JSON.stringify(saveArgs));
    if (DbResult.BE_SQLITE_ERROR_PropagateChangesFailed === stat)
      throw new IModelError(stat, "Could not save changes due to propagation failure.");

    if (DbResult.BE_SQLITE_OK !== stat)
      throw new IModelError(stat, `Could not save changes (${saveArgs.description})`);
  }

  /** Insert a new element into the iModel.
   * @param elProps The properties of the new element.
   * @returns The newly inserted element's Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertElement(elProps: ElementProps, options?: InsertElementOptions): Id64String {
    this.requireActive();
    try {
      this.iModel.elements[_cache].delete({
        id: elProps.id,
        federationGuid: elProps.federationGuid,
        code: elProps.code,
      });
      return elProps.id = this.iModel[_nativeDb].insertElement(elProps, options);
    } catch (err: any) {
      err.message = `Error inserting element [${err.message}]`;
      err.metadata = { elProps };
      throw err;
    }
  }

  /** Update an existing element in the iModel.
   * @param elProps The properties to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateElement<T extends ElementProps>(elProps: Partial<T>): void {
    this.requireActive();
    try {
      if (elProps.id) {
        this.iModel.elements[_instanceKeyCache].deleteById(elProps.id);
      } else {
        this.iModel.elements[_instanceKeyCache].delete({
          federationGuid: elProps.federationGuid,
          code: elProps.code,
        });
      }
      this.iModel.elements[_cache].delete({
        id: elProps.id,
        federationGuid: elProps.federationGuid,
        code: elProps.code,
      });
      this.iModel[_nativeDb].updateElement(elProps);
    } catch (err: any) {
      err.message = `Error updating element [${err.message}], id: ${elProps.id}`;
      err.metadata = { elProps };
      throw err;
    }
  }

  /** Delete elements from the iModel.
   * @param ids The Ids of the elements to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteElement(ids: Id64Arg): void {
    this.requireActive();
    const iModel = this.iModel;
    Id64.toIdSet(ids).forEach((id) => {
      try {
        this.iModel.elements[_cache].delete({ id });
        this.iModel.elements[_instanceKeyCache].deleteById(id);
        iModel[_nativeDb].deleteElement(id);
      } catch (err: any) {
        err.message = `Error deleting element [${err.message}], id: ${id}`;
        err.metadata = { elementId: id };
        throw err;
      }
    });
  }

  /** Insert a new aspect into the iModel.
   * @param aspectProps The properties of the new aspect.
   * @returns The newly inserted aspect Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertAspect(aspectProps: ElementAspectProps): Id64String {
    this.requireActive();
    try {
      return this.iModel[_nativeDb].insertElementAspect(aspectProps);
    } catch (err: any) {
      const error = new IModelError(err.errorNumber, `Error inserting ElementAspect [${err.message}], class: ${aspectProps.classFullName}`, aspectProps);
      error.cause = err;
      throw error;
    }
  }

  /** Update an existing aspect in the iModel.
   * @param aspectProps The properties of the aspect to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateAspect(aspectProps: ElementAspectProps): void {
    this.requireActive();
    try {
      this.iModel[_nativeDb].updateElementAspect(aspectProps);
    } catch (err: any) {
      const error = new IModelError(err.errorNumber, `Error updating ElementAspect [${err.message}], id: ${aspectProps.id}`, aspectProps);
      error.cause = err;
      throw error;
    }
  }

  /** Delete one or more aspects from the iModel.
   * @param aspectInstanceIds The Ids of the aspects to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteAspect(aspectInstanceIds: Id64Arg): void {
    this.requireActive();
    Id64.toIdSet(aspectInstanceIds).forEach((aspectInstanceId) => {
      try {
        this.iModel[_nativeDb].deleteElementAspect(aspectInstanceId);
      } catch (err: any) {
        const error = new IModelError(err.errorNumber, `Error deleting ElementAspect [${err.message}], id: ${aspectInstanceId}`);
        error.cause = err;
        throw error;
      }
    });
  }

  /** Delete definition elements from the iModel when they are not referenced.
   * @param definitionElementIds The Ids of the definition elements to attempt to delete.
   * @returns The set of definition elements that were still in use and therefore not deleted.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteDefinitionElements(definitionElementIds: Id64Array): Id64Set {
    this.requireActive();
    const usageInfo = this.iModel[_nativeDb].queryDefinitionElementUsage(definitionElementIds);
    if (!usageInfo)
      throw new IModelError(IModelStatus.BadRequest, "Error querying for DefinitionElement usage");

    const usedIdSet = usageInfo.usedIds ? Id64.toIdSet(usageInfo.usedIds) : new Set<Id64String>();
    const deleteIfUnused = (ids: Id64Array | undefined, used: Id64Set): void => {
      ids?.forEach((id) => {
        if (!used.has(id))
          this.deleteElement(id);
      });
    };

    try {
      this.iModel[_nativeDb].beginPurgeOperation();
      deleteIfUnused(usageInfo.spatialCategoryIds, usedIdSet);
      deleteIfUnused(usageInfo.drawingCategoryIds, usedIdSet);
      deleteIfUnused(usageInfo.viewDefinitionIds, usedIdSet);
      deleteIfUnused(usageInfo.geometryPartIds, usedIdSet);
      deleteIfUnused(usageInfo.lineStyleIds, usedIdSet);
      deleteIfUnused(usageInfo.renderMaterialIds, usedIdSet);
      deleteIfUnused(usageInfo.subCategoryIds, usedIdSet);
      deleteIfUnused(usageInfo.textureIds, usedIdSet);
      deleteIfUnused(usageInfo.displayStyleIds, usedIdSet);
      deleteIfUnused(usageInfo.categorySelectorIds, usedIdSet);
      deleteIfUnused(usageInfo.modelSelectorIds, usedIdSet);
      if (usageInfo.otherDefinitionElementIds)
        this.deleteElement(usageInfo.otherDefinitionElementIds);
    } finally {
      this.iModel[_nativeDb].endPurgeOperation();
    }

    if (usageInfo.viewDefinitionIds) {
      // Recheck view-related definitions after deleting view definitions that may have been their last reference.
      let viewRelatedIds: Id64Array = [];
      if (usageInfo.displayStyleIds)
        viewRelatedIds = viewRelatedIds.concat(usageInfo.displayStyleIds.filter((id) => usedIdSet.has(id)));

      if (usageInfo.categorySelectorIds)
        viewRelatedIds = viewRelatedIds.concat(usageInfo.categorySelectorIds.filter((id) => usedIdSet.has(id)));

      if (usageInfo.modelSelectorIds)
        viewRelatedIds = viewRelatedIds.concat(usageInfo.modelSelectorIds.filter((id) => usedIdSet.has(id)));

      if (viewRelatedIds.length > 0) {
        const viewRelatedUsageInfo = this.iModel[_nativeDb].queryDefinitionElementUsage(viewRelatedIds);
        if (viewRelatedUsageInfo) {
          const usedViewRelatedIdSet: Id64Set = viewRelatedUsageInfo.usedIds ? Id64.toIdSet(viewRelatedUsageInfo.usedIds) : new Set<Id64String>();
          try {
            this.iModel[_nativeDb].beginPurgeOperation();
            deleteIfUnused(viewRelatedUsageInfo.displayStyleIds, usedViewRelatedIdSet);
            deleteIfUnused(viewRelatedUsageInfo.categorySelectorIds, usedViewRelatedIdSet);
            deleteIfUnused(viewRelatedUsageInfo.modelSelectorIds, usedViewRelatedIdSet);
          } finally {
            this.iModel[_nativeDb].endPurgeOperation();
          }

          viewRelatedIds.forEach((id) => {
            if (!usedViewRelatedIdSet.has(id))
              usedIdSet.delete(id);
          });
        }
      }
    }

    return usedIdSet;
  }

  /** Insert a new model into the iModel.
   * @param props The data for the new model.
   * @returns The newly inserted model's Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertModel(props: ModelProps): Id64String {
    this.requireActive();
    try {
      return props.id = this.iModel[_nativeDb].insertModel(props);
    } catch (err: any) {
      const error = new IModelError(err.errorNumber, `Error inserting model [${err.message}], class=${props.classFullName}`);
      error.cause = err;
      throw error;
    }
  }

  /** Update an existing model in the iModel.
   * @param props the properties of the model to change
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateModel(props: UpdateModelOptions): void {
    this.requireActive();
    try {
      if (props.id)
        this.iModel.models[_cache].delete(props.id);

      this.iModel[_nativeDb].updateModel(props);
    } catch (err: any) {
      const error = new IModelError(err.errorNumber, `Error updating model [${err.message}], id: ${props.id}`);
      error.cause = err;
      throw error;
    }
  }

  /** Update the geometry guid of a model.
   * @param modelId The Id of the model to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateGeometryGuid(modelId: Id64String): void {
    this.requireActive();
    this.iModel.models[_cache].delete(modelId);
    const error = this.iModel[_nativeDb].updateModelGeometryGuid(modelId);
    if (error !== IModelStatus.Success)
      throw new IModelError(error, `Error updating geometry guid for model ${modelId}`);
  }

  /** Delete models from the iModel.
   * @param ids The Ids of the models to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteModel(ids: Id64Arg): void {
    this.requireActive();
    Id64.toIdSet(ids).forEach((id) => {
      try {
        this.iModel.models[_cache].delete(id);
        this.iModel.models[_instanceKeyCache].deleteById(id);
        this.iModel[_nativeDb].deleteModel(id);
      } catch (err: any) {
        const error = new IModelError(err.errorNumber, `Error deleting model [${err.message}], id: ${id}`);
        error.cause = err;
        throw error;
      }
    });
  }

  /** Insert a new relationship into the iModel.
   * @param props The properties of the new relationship.
   * @returns The Id of the newly inserted relationship.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertRelationship(props: RelationshipProps): Id64String {
    this.requireActive();
    if (!this.iModel[_nativeDb].isLinkTableRelationship(props.classFullName.replace(".", ":")))
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Class '${props.classFullName}' must be a relationship class and it should be subclass of BisCore:ElementRefersToElements or BisCore:ElementDrivesElement.`);

    return props.id = this.iModel[_nativeDb].insertLinkTableRelationship(props);
  }

  /** Update an existing relationship in the iModel.
   * @param props the properties of the relationship to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateRelationship(props: RelationshipProps): void {
    this.requireActive();
    this.iModel[_nativeDb].updateLinkTableRelationship(props);
  }

  /** Delete a relationship from the iModel.
   * @param props The properties of the relationship to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteRelationship(props: RelationshipProps): void {
    this.requireActive();
    this.iModel[_nativeDb].deleteLinkTableRelationship(props);
  }

  /** Delete multiple relationships from the iModel.
   * @param props The properties of the relationships to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteRelationships(props: ReadonlyArray<RelationshipProps>): void {
    this.requireActive();
    this.iModel[_nativeDb].deleteLinkTableRelationships(props);
  }

  /** Drop schemas from the iModel.
   * @param schemaNames Array of schema names to drop.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async dropSchemas(schemaNames: string[]): Promise<void> {
    this.requireActive();
    await this.iModel.dropSchemasImpl(schemaNames);
  }

  /** Import schemas into the iModel.
   * @param schemaFileNames Array of schema file names to import.
   * @param options Import options.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    this.requireActive();
    await this.iModel.importSchemasImpl(schemaFileNames, options);
  }

  /** Import schema strings into the iModel.
   * @param serializedXmlSchemas Array of serialized XML schemas.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async importSchemaStrings(serializedXmlSchemas: string[], options?: SchemaImportOptions): Promise<void> {
    this.requireActive();
    await this.iModel.importSchemaStringsImpl(serializedXmlSchemas, options);
  }

  /** Save a file property to the iModel.
   * @param prop The file property to save.
   * @param strValue String value.
   * @param blobVal Blob value.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    this.requireActive();
    this.iModel.saveFilePropertyImpl(prop, strValue, blobVal);
  }

  /** Update the project extents of the iModel.
   * @param newExtents The new project extents.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async updateProjectExtents(newExtents: Range3dProps): Promise<void> {
    this.requireActive();
    const extents = Range3d.fromJSON(newExtents);
    if (extents.isNull)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid project extents");

    await this.iModel.acquireSchemaLock();
    this.iModel.projectExtents = extents;
    this.iModel.updateIModelProps();

    // Set source from calculated to user so connectors preserve the change.
    const unitsProps: FilePropertyProps = { name: "Units", namespace: "dgn_Db" };
    const unitsStr = this.iModel.queryFilePropertyString(unitsProps);

    if (undefined === unitsStr)
      return;

    const unitsVal = JSON.parse(unitsStr);
    const calculated = 1;
    if (calculated !== unitsVal.extentsSource) {
      unitsVal.extentsSource = calculated;
      this.saveFileProperty(unitsProps, JSON.stringify(unitsVal));
    }
  }

  /** Update the ECEF location of the iModel.
   * @param ecef The new ECEF location.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async updateEcefLocation(ecef: EcefLocationProps): Promise<void> {
    this.requireActive();
    await this.iModel.acquireSchemaLock();

    // Clear GCS that caller already determined was invalid.
    this.iModel.deleteFileProperty({ name: "DgnGCS", namespace: "dgn_Db" });
    this.iModel.setEcefLocation(new EcefLocation(ecef));
    this.iModel.updateIModelProps();
  }
}
