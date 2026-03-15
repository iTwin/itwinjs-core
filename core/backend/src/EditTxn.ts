/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64, Id64Arg, Id64String, IModelStatus } from "@itwin/core-bentley";
import { AxisAlignedBox3d, EcefLocation, EditTxnError, ElementProps, FilePropertyProps, IModelError, InsertElementOptions, LocalFileName, ModelProps, RelationshipProps, SchemaImportOptions, UpdateModelOptions } from "@itwin/core-common";
import { IModelDb, SaveChangesArgs } from "./IModelDb";
import { _cache, _instanceKeyCache, _nativeDb } from "./internal/Symbols";

/**
 * Represents an active editing transaction in an iModel.
 * All changes to the iModel must be made within an active EditTxn.
 * @beta
 */
export class EditTxn {
  private _isActive = false;

  /** The iModel this EditTxn may modify. */
  public readonly iModel: IModelDb;

  protected constructor(iModel: IModelDb) {
    this.iModel = iModel;
  }

  /** True if this EditTxn is currently active. */
  public get isActive(): boolean {
    return this._isActive;
  }

  /** Start this EditTxn, making it the active transaction for the iModel.
   * @throws EditTxnError if another EditTxn is already active.
   */
  protected start(): void {
    if (this.iModel.activeTxn !== undefined) {
      throw EditTxnError.throwError("already-active");
    }
    this.iModel.activeTxn = this;
    this._isActive = true;
  }

  /** End this EditTxn, either by committing or canceling.
   * @param commit If true, commit the changes; otherwise, abandon them.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected end(commit: boolean): void {
    if (!this._isActive || this.iModel.activeTxn !== this) {
      throw EditTxnError.throwError("not-active");
    }
    if (commit) {
      this.iModel.saveChangesImpl();
    } else {
      this.iModel.abandonChanges();
    }
    this._isActive = false;
    this.iModel.activeTxn = undefined;
  }

  /** Commit the changes in this EditTxn.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected commit(): void {
    this.end(true);
  }

  /** Cancel the changes in this EditTxn.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected cancel(): void {
    this.end(false);
  }

  /** Save changes with additional arguments.
   * @param args Save changes arguments.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected saveChanges(args?: string | SaveChangesArgs): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.saveChangesImpl(args);
    this._isActive = false;
    this.iModel.activeTxn = undefined;
  }

  /** Insert a new element into the iModel.
   * @param elProps The properties of the new element.
   * @returns The newly inserted element's Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected insertElement(elProps: ElementProps, options?: InsertElementOptions): Id64String {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
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
  protected updateElement<T extends ElementProps>(elProps: Partial<T>): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
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
  protected deleteElement(ids: Id64Arg): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
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

  /** Insert a new model into the iModel.
   * @param props The data for the new model.
   * @returns The newly inserted model's Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected insertModel(props: ModelProps): Id64String {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
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
  protected updateModel(props: UpdateModelOptions): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
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
  protected updateGeometryGuid(modelId: Id64String): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.models[_cache].delete(modelId);
    const error = this.iModel[_nativeDb].updateModelGeometryGuid(modelId);
    if (error !== IModelStatus.Success)
      throw new IModelError(error, `Error updating geometry guid for model ${modelId}`);
  }

  /** Delete models from the iModel.
   * @param ids The Ids of the models to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected deleteModel(ids: Id64Arg): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
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
  protected insertRelationship(props: RelationshipProps): Id64String {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    if (!this.iModel[_nativeDb].isLinkTableRelationship(props.classFullName.replace(".", ":"))) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Class '${props.classFullName}' must be a relationship class and it should be subclass of BisCore:ElementRefersToElements or BisCore:ElementDrivesElement.`);
    }
    return props.id = this.iModel[_nativeDb].insertLinkTableRelationship(props);
  }

  /** Update an existing relationship in the iModel.
   * @param props the properties of the relationship to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected updateRelationship(props: RelationshipProps): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel[_nativeDb].updateLinkTableRelationship(props);
  }

  /** Delete a relationship from the iModel.
   * @param props The properties of the relationship to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected deleteRelationship(props: RelationshipProps): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel[_nativeDb].deleteLinkTableRelationship(props);
  }

  /** Delete multiple relationships from the iModel.
   * @param props The properties of the relationships to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected deleteRelationships(props: ReadonlyArray<RelationshipProps>): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel[_nativeDb].deleteLinkTableRelationships(props);
  }

  /** Drop schemas from the iModel.
   * @param schemaNames Array of schema names to drop.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected async dropSchemas(schemaNames: string[]): Promise<void> {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    await this.iModel.dropSchemasImpl(schemaNames);
  }

  /** Import schemas into the iModel.
   * @param schemaFileNames Array of schema file names to import.
   * @param options Import options.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    await this.iModel.importSchemasImpl(schemaFileNames, options);
  }

  /** Import schema strings into the iModel.
   * @param serializedXmlSchemas Array of serialized XML schemas.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected async importSchemaStrings(serializedXmlSchemas: string[], options?: SchemaImportOptions): Promise<void> {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    await this.iModel.importSchemaStringsImpl(serializedXmlSchemas, options);
  }

  /** Save a file property to the iModel.
   * @param prop The file property to save.
   * @param strValue String value.
   * @param blobVal Blob value.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.saveFilePropertyImpl(prop, strValue, blobVal);
  }

  /** Update the project extents of the iModel.
   * @param newExtents The new project extents.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected updateProjectExtents(newExtents: AxisAlignedBox3d): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.updateProjectExtentsImpl(newExtents);
  }

  /** Update the ECEF location of the iModel.
   * @param ecef The new ECEF location.
   * @throws EditTxnError if this EditTxn is not active.
   */
  protected updateEcefLocation(ecef: EcefLocation): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.updateEcefLocationImpl(ecef);
  }

  // Add more methods as needed, like for models, relationships, etc.
}

/** @internal */
export class LegacyEditTxn extends EditTxn {
  public constructor(iModel: IModelDb) {
    super(iModel);
    this.start();
  }

  public override commit(): void {
    super.commit();
  }

  public override cancel(): void {
    super.cancel();
  }

  public override saveChanges(args?: string | SaveChangesArgs): void {
    super.saveChanges(args);
  }

  public override insertElement(elProps: ElementProps, options?: InsertElementOptions): Id64String {
    return super.insertElement(elProps, options);
  }

  public override updateElement<T extends ElementProps>(elProps: Partial<T>): void {
    super.updateElement(elProps);
  }

  public override deleteElement(ids: Id64Arg): void {
    super.deleteElement(ids);
  }

  public override insertModel(props: ModelProps): Id64String {
    return super.insertModel(props);
  }

  public override updateModel(props: UpdateModelOptions): void {
    super.updateModel(props);
  }

  public override updateGeometryGuid(modelId: Id64String): void {
    super.updateGeometryGuid(modelId);
  }

  public override deleteModel(ids: Id64Arg): void {
    super.deleteModel(ids);
  }

  public override insertRelationship(props: RelationshipProps): Id64String {
    return super.insertRelationship(props);
  }

  public override updateRelationship(props: RelationshipProps): void {
    super.updateRelationship(props);
  }

  public override deleteRelationship(props: RelationshipProps): void {
    super.deleteRelationship(props);
  }

  public override deleteRelationships(props: ReadonlyArray<RelationshipProps>): void {
    super.deleteRelationships(props);
  }

  public override async dropSchemas(schemaNames: string[]): Promise<void> {
    await super.dropSchemas(schemaNames);
  }

  public override async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    await super.importSchemas(schemaFileNames, options);
  }

  public override async importSchemaStrings(serializedXmlSchemas: string[], options?: SchemaImportOptions): Promise<void> {
    await super.importSchemaStrings(serializedXmlSchemas, options);
  }

  public override saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    super.saveFileProperty(prop, strValue, blobVal);
  }

  public override updateProjectExtents(newExtents: AxisAlignedBox3d): void {
    super.updateProjectExtents(newExtents);
  }

  public override updateEcefLocation(ecef: EcefLocation): void {
    super.updateEcefLocation(ecef);
  }
}
