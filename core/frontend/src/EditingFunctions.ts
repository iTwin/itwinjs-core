/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { DbOpcode, Id64Array, Id64String, IModelStatus, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { LockLevel } from "@bentley/imodelhub-client";
import { AxisAlignedBox3d, BisCodeSpec, CodeProps, IModelError, IModelWriteRpcInterface, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { BriefcaseConnection } from "./BriefcaseConnection";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";

const loggerCategory = FrontendLoggerCategory.IModelConnection;

/* eslint-disable deprecation/deprecation */

/**
 * General editing functions. See IModelApp.elementEditor for editing 3D elements.
 * @alpha
 */
export class EditingFunctions {
  private _connection: BriefcaseConnection;
  private _concurrencyControl?: EditingFunctions.ConcurrencyControl;
  private _models?: EditingFunctions.ModelEditor;
  private _categories?: EditingFunctions.CategoryEditor;
  private _codes?: EditingFunctions.Codes;

  /** @private */
  public constructor(connection: BriefcaseConnection) {
    if (connection.isReadonly)
      throw new IModelError(IModelStatus.ReadOnly, "EditingFunctions not available", Logger.logError, loggerCategory);
    this._connection = connection;
  }

  /**
   * Concurrency control functions
   * @alpha
   */
  public get concurrencyControl(): EditingFunctions.ConcurrencyControl {
    if (this._concurrencyControl === undefined)
      this._concurrencyControl = new EditingFunctions.ConcurrencyControl(this._connection);
    return this._concurrencyControl;
  }

  /**
   * Model-editing functions
   * @alpha
   */
  public get models(): EditingFunctions.ModelEditor {
    if (this._models === undefined)
      this._models = new EditingFunctions.ModelEditor(this._connection);
    return this._models;
  }

  /**
   * Category-editing functions
   * @alpha
   */
  public get categories(): EditingFunctions.CategoryEditor {
    if (this._categories === undefined)
      this._categories = new EditingFunctions.CategoryEditor(this._connection);
    return this._categories;
  }

  /**
   * Code-creation functions
   * @alpha
   */
  public get codes(): EditingFunctions.Codes {
    if (this._codes === undefined)
      this._codes = new EditingFunctions.Codes(this._connection);
    return this._codes;
  }

  /**
   * Delete elements
   * @param ids The elements to delete
   * @alpha
   */
  public async deleteElements(ids: Id64Array) {
    await IModelWriteRpcInterface.getClientForRouting(this._connection.routingContext.token).requestResources(this._connection.getRpcProps(), ids, [], DbOpcode.Delete);
    return IModelWriteRpcInterface.getClientForRouting(this._connection.routingContext.token).deleteElements(this._connection.getRpcProps(), ids);
  }

  /** Update the project extents of this iModel.
   * @param newExtents The new project extents as an AxisAlignedBox3d
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem updating the extents.
   * @alpha
   */
  public async updateProjectExtents(newExtents: AxisAlignedBox3d): Promise<void> {
    if (OpenMode.ReadWrite !== this._connection.openMode)
      throw new IModelError(IModelStatus.ReadOnly, "IModelConnection was opened read-only", Logger.logError);
    return IModelWriteRpcInterface.getClientForRouting(this._connection.routingContext.token).updateProjectExtents(this._connection.getRpcProps(), newExtents.toJSON());
  }

  /** Commit pending changes to this iModel
   * @param description Optional description of the changes
   * @throws [[IModelError]] if the IModelConnection is read-only or there is a problem saving changes.
   * @alpha
   */
  public async saveChanges(description?: string): Promise<void> {
    if (OpenMode.ReadWrite !== this._connection.openMode)
      throw new IModelError(IModelStatus.ReadOnly, "IModelConnection was opened read-only", Logger.logError);

    return IModelWriteRpcInterface.getClientForRouting(this._connection.routingContext.token).saveChanges(this._connection.getRpcProps(), description);
  }

  /**
   * Query if there are local changes that have not yet been pushed to the iModel server.
   * @alpha
   */
  // eslint-disable-next-line @bentley/prefer-get
  public async hasPendingTxns(): Promise<boolean> {
    return IModelWriteRpcInterface.getClientForRouting(this._connection.routingContext.token).hasPendingTxns(this._connection.getRpcProps());
  }

  /**
   * Query if there are in-memory changes that have not yet been saved to the briefcase.
   * @alpha
   */
  // eslint-disable-next-line @bentley/prefer-get
  public async hasUnsavedChanges(): Promise<boolean> {
    return IModelWriteRpcInterface.getClientForRouting(this._connection.routingContext.token).hasUnsavedChanges(this._connection.getRpcProps());
  }
}

/**
 * @alpha
 */
export namespace EditingFunctions { // eslint-disable-line no-redeclare
  /**
   * Helper class for defining Codes.
   * @alpha
   */
  export class Codes {
    private _connection: BriefcaseConnection;

    /** @private */
    public constructor(c: BriefcaseConnection) {
      this._connection = c;
    }

    /**
     * Helper function to create a CodeProps object
     * @param specName Code spec
     * @param scope Scope element ID
     * @param value Code value
     * @alpha
     */
    public async makeCode(specName: string, scope: Id64String, value: string): Promise<CodeProps> {
      const modelCodeSpec = await this._connection.codeSpecs.getByName(specName);
      return { scope, spec: modelCodeSpec.id, value };
    }

    /**
     * Helper function to create a CodeProps object for a model
     * @param scope Scope element ID
     * @param value Code value
     * @alpha
     */
    public async makeModelCode(scope: Id64String, value: string): Promise<CodeProps> {
      return this.makeCode(BisCodeSpec.informationPartitionElement, scope, value);
    }
  }

  /** Helper class for creating SpatialCategories.
   * @alpha
   */
  export class CategoryEditor {
    private _connection: BriefcaseConnection;
    private _rpc: IModelWriteRpcInterface;

    /** @private */
    public constructor(c: BriefcaseConnection) {
      this._connection = c;
      this._rpc = IModelWriteRpcInterface.getClientForRouting(c.routingContext.token);
    }

    /** Create and insert a new SpatialCategory. This first obtains the necessary locks and reserves the Code. This method is not suitable for creating many Categories.
     * @alpha
     */
    public async createAndInsertSpatialCategory(scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
      return this._rpc.createAndInsertSpatialCategory(this._connection.getRpcProps(), scopeModelId, categoryName, appearance);
    }
  }

  /** Helper class for creating and editing models.
   * @alpha
   */
  export class ModelEditor {
    private _connection: BriefcaseConnection;
    private _rpc: IModelWriteRpcInterface;

    /** @private */
    public constructor(c: BriefcaseConnection) {
      this._connection = c;
      this._rpc = IModelWriteRpcInterface.getClientForRouting(c.routingContext.token);
    }

    /** Create and insert a new PhysicalPartition element and a SpatialModel. This first obtains the necessary locks and reserves the Code. This method is not suitable for creating many models.
     * @alpha
     */
    public async createAndInsertPhysicalModel(newModelCode: CodeProps, privateModel?: boolean): Promise<Id64String> {
      return this._rpc.createAndInsertPhysicalModel(this._connection.getRpcProps(), newModelCode, !!privateModel);
    }

  }

  /** Concurrency control functions.
   * @alpha
   */
  export class ConcurrencyControl {
    private _connection: BriefcaseConnection;
    private _rpc: IModelWriteRpcInterface;

    /** @private */
    public constructor(c: BriefcaseConnection) {
      this._connection = c;
      this._rpc = IModelWriteRpcInterface.getClientForRouting(c.routingContext.token);
    }

    /** Send all pending requests for locks and codes to the server. */
    public async request(): Promise<void> {
      return this._rpc.doConcurrencyControlRequest(this._connection.getRpcProps());
    }

    /** Lock a model.
     * @param modelId The model
     * @param level The lock level
     * @alpha
     */
    public async lockModel(modelId: Id64String, level: LockLevel = LockLevel.Shared): Promise<void> {
      return this._rpc.lockModel(this._connection.getRpcProps(), modelId, level);
    }
  }
}
