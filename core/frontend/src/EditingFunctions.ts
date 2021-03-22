/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { BisCodeSpec, CodeProps, IModelError, IModelWriteRpcInterface, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelConnection } from "./IModelConnection";

const loggerCategory = FrontendLoggerCategory.IModelConnection;

/* eslint-disable deprecation/deprecation */

/**
 * General editing functions.
 * @alpha
 * @deprecated this was an experimental class that was replaced by EditCommands
 */
export class EditingFunctions {
  private _connection: IModelConnection;
  private _models?: EditingFunctions.ModelEditor;
  private _categories?: EditingFunctions.CategoryEditor;
  private _codes?: EditingFunctions.Codes;

  /** @private */
  public constructor(connection: IModelConnection) {
    if (connection.isReadonly)
      throw new IModelError(IModelStatus.ReadOnly, "EditingFunctions not available", Logger.logError, loggerCategory);
    this._connection = connection;
  }

  /**
   * Model-editing functions
   */
  public get models(): EditingFunctions.ModelEditor {
    if (this._models === undefined)
      this._models = new EditingFunctions.ModelEditor(this._connection);
    return this._models;
  }

  /**
   * Category-editing functions
   */
  public get categories(): EditingFunctions.CategoryEditor {
    if (this._categories === undefined)
      this._categories = new EditingFunctions.CategoryEditor(this._connection);
    return this._categories;
  }

  /**
   * Code-creation functions
   */
  public get codes(): EditingFunctions.Codes {
    if (this._codes === undefined)
      this._codes = new EditingFunctions.Codes(this._connection);
    return this._codes;
  }
}

/**
 * @alpha
 * @deprecated this was an experimental class that was replaced by EditCommands
 */
export namespace EditingFunctions { // eslint-disable-line no-redeclare
  /**
   * Helper class for defining Codes.
   */
  export class Codes {
    private _connection: IModelConnection;

    /** @private */
    public constructor(c: IModelConnection) {
      this._connection = c;
    }

    /**
     * Helper function to create a CodeProps object
     * @param specName Code spec
     * @param scope Scope element ID
     * @param value Code value
     */
    public async makeCode(specName: string, scope: Id64String, value: string): Promise<CodeProps> {
      const modelCodeSpec = await this._connection.codeSpecs.getByName(specName);
      return { scope, spec: modelCodeSpec.id, value };
    }

    /**
     * Helper function to create a CodeProps object for a model
     * @param scope Scope element ID
     * @param value Code value
     */
    public async makeModelCode(scope: Id64String, value: string): Promise<CodeProps> {
      return this.makeCode(BisCodeSpec.informationPartitionElement, scope, value);
    }
  }

  /** Helper class for creating SpatialCategories.
 * @deprecated this was an experimental class that was replaced by EditCommands
   */
  export class CategoryEditor {
    private _connection: IModelConnection;
    private _rpc: IModelWriteRpcInterface;

    /** @private */
    public constructor(c: IModelConnection) {
      this._connection = c;
      this._rpc = IModelWriteRpcInterface.getClientForRouting(c.routingContext.token);
    }

    /** Create and insert a new SpatialCategory. This first obtains the necessary locks and reserves the Code. This method is not suitable for creating many Categories.
     */
    public async createAndInsertSpatialCategory(scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
      return this._rpc.createAndInsertSpatialCategory(this._connection.getRpcProps(), scopeModelId, categoryName, appearance);
    }
  }

  /** Helper class for creating and editing models.
   * @deprecated
   */
  export class ModelEditor {
    private _connection: IModelConnection;
    private _rpc: IModelWriteRpcInterface;

    /** @private */
    public constructor(c: IModelConnection) {
      this._connection = c;
      this._rpc = IModelWriteRpcInterface.getClientForRouting(c.routingContext.token);
    }

    /** Create and insert a new PhysicalPartition element and a SpatialModel. This first obtains the necessary locks and reserves the Code. This method is not suitable for creating many models.
     */
    public async createAndInsertPhysicalModel(newModelCode: CodeProps, privateModel?: boolean): Promise<Id64String> {
      return this._rpc.createAndInsertPhysicalModel(this._connection.getRpcProps(), newModelCode, !!privateModel);
    }
  }
}
