/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { Id64Arg, Id64String } from "@itwin/core-bentley";
import { AxisAlignedBox3d, EcefLocation, EditTxnError, ElementProps, FilePropertyProps, InsertElementOptions, LocalFileName, ModelProps, RelationshipProps, SchemaImportOptions, UpdateModelOptions } from "@itwin/core-common";
import { IModelDb, SaveChangesArgs } from "./IModelDb";

/**
 * Represents an active editing transaction in an iModel.
 * All changes to the iModel must be made within an active EditTxn.
 * @beta
 */
export class EditTxn {
  private _isActive = false;

  /** The iModel this EditTxn may modify. */
  public readonly iModel: IModelDb;

  public constructor(iModel: IModelDb) {
    this.iModel = iModel;
  }

  /** True if this EditTxn is currently active. */
  public get isActive(): boolean {
    return this._isActive;
  }

  /** Start this EditTxn, making it the active transaction for the iModel.
   * @throws EditTxnError if another EditTxn is already active.
   */
  public start(): void {
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
  public end(commit: boolean): void {
    if (!this._isActive || this.iModel.activeTxn !== this) {
      throw EditTxnError.throwError("not-active");
    }
    if (commit) {
      this.iModel.saveChanges(); // eslint-disable-line @typescript-eslint/no-deprecated
    } else {
      this.iModel.abandonChanges();
    }
    this._isActive = false;
    this.iModel.activeTxn = undefined;
  }

  /** Commit the changes in this EditTxn.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public commit(): void {
    this.end(true);
  }

  /** Cancel the changes in this EditTxn.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public cancel(): void {
    this.end(false);
  }

  /** Save changes with additional arguments.
   * @param args Save changes arguments.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public saveChanges(args?: string | SaveChangesArgs): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.saveChanges(args); // eslint-disable-line @typescript-eslint/no-deprecated
    this.end(true); // Commit and end the txn
  }

  /** Insert a new element into the iModel.
   * @param elProps The properties of the new element.
   * @returns The newly inserted element's Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertElement(elProps: ElementProps, options?: InsertElementOptions): Id64String {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    return this.iModel.elements.insertElement(elProps, options); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Update an existing element in the iModel.
   * @param elProps The properties to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateElement<T extends ElementProps>(elProps: Partial<T>): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.elements.updateElement(elProps); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Delete elements from the iModel.
   * @param ids The Ids of the elements to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteElement(ids: Id64Arg): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.elements.deleteElement(ids); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Insert a new model into the iModel.
   * @param props The data for the new model.
   * @returns The newly inserted model's Id.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertModel(props: ModelProps): Id64String {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    return this.iModel.models.insertModel(props); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Update an existing model in the iModel.
   * @param props the properties of the model to change
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateModel(props: UpdateModelOptions): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.models.updateModel(props); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Update the geometry guid of a model.
   * @param modelId The Id of the model to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateGeometryGuid(modelId: Id64String): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.models.updateGeometryGuid(modelId); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Delete models from the iModel.
   * @param ids The Ids of the models to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteModel(ids: Id64Arg): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.models.deleteModel(ids); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Insert a new relationship into the iModel.
   * @param props The properties of the new relationship.
   * @returns The Id of the newly inserted relationship.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public insertRelationship(props: RelationshipProps): Id64String {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    return this.iModel.relationships.insertInstance(props);
  }

  /** Update an existing relationship in the iModel.
   * @param props the properties of the relationship to update.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateRelationship(props: RelationshipProps): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.relationships.updateInstance(props);
  }

  /** Delete a relationship from the iModel.
   * @param props The properties of the relationship to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteRelationship(props: RelationshipProps): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.relationships.deleteInstance(props);
  }

  /** Delete multiple relationships from the iModel.
   * @param props The properties of the relationships to delete.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public deleteRelationships(props: ReadonlyArray<RelationshipProps>): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.relationships.deleteInstances(props);
  }

  /** Drop schemas from the iModel.
   * @param schemaNames Array of schema names to drop.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async dropSchemas(schemaNames: string[]): Promise<void> {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    await this.iModel.dropSchemas(schemaNames); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Import schemas into the iModel.
   * @param schemaFileNames Array of schema file names to import.
   * @param options Import options.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async importSchemas(schemaFileNames: LocalFileName[], options?: SchemaImportOptions): Promise<void> {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    await this.iModel.importSchemas(schemaFileNames, options); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Import schema strings into the iModel.
   * @param serializedXmlSchemas Array of serialized XML schemas.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public async importSchemaStrings(serializedXmlSchemas: string[]): Promise<void> {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    await this.iModel.importSchemaStrings(serializedXmlSchemas); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Save a file property to the iModel.
   * @param prop The file property to save.
   * @param strValue String value.
   * @param blobVal Blob value.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public saveFileProperty(prop: FilePropertyProps, strValue: string | undefined, blobVal?: Uint8Array): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.saveFileProperty(prop, strValue, blobVal); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Update the project extents of the iModel.
   * @param newExtents The new project extents.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateProjectExtents(newExtents: AxisAlignedBox3d): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.updateProjectExtents(newExtents); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  /** Update the ECEF location of the iModel.
   * @param ecef The new ECEF location.
   * @throws EditTxnError if this EditTxn is not active.
   */
  public updateEcefLocation(ecef: EcefLocation): void {
    if (!this._isActive) {
      throw EditTxnError.throwError("not-active");
    }
    this.iModel.updateEcefLocation(ecef); // eslint-disable-line @typescript-eslint/no-deprecated
  }

  // Add more methods as needed, like for models, relationships, etc.
}