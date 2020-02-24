/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelProps, IModelTokenProps } from "../IModel";
import { AxisAlignedBox3dProps } from "../geometry/Placement";
import { Id64String, Id64Array, DbOpcode, GuidString } from "@bentley/bentleyjs-core";
import { LockLevel } from "@bentley/imodeljs-clients";
import { SubCategoryAppearance } from "../SubCategoryAppearance";
import { CodeProps } from "../Code";

/** The RPC interface for writing to an iModel.
 * All operations require read+write access.
 * This interface is not normally used directly. See IModelConnection for higher-level and more convenient API for accessing iModels from a frontend.
 * @alpha
 */
export abstract class IModelWriteRpcInterface extends RpcInterface {
  /** Returns the IModelWriteRpcInterface client instance for the frontend. */
  public static getClient(): IModelWriteRpcInterface { return RpcManager.getClientForInterface(IModelWriteRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelWriteRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "0.4.0";

  /*===========================================================================================
      NOTE: Any add/remove/change to the methods below requires an update of the interface version.
      NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async openForWrite(_iModelToken: IModelTokenProps): Promise<IModelProps> { return this.forward(arguments); }
  public async saveChanges(_iModelToken: IModelTokenProps, _description?: string): Promise<void> { return this.forward(arguments); }
  public async hasUnsavedChanges(_iModelToken: IModelTokenProps): Promise<boolean> { return this.forward(arguments); }
  public async hasPendingTxns(_iModelToken: IModelTokenProps): Promise<boolean> { return this.forward(arguments); }
  public async updateProjectExtents(_iModelToken: IModelTokenProps, _newExtents: AxisAlignedBox3dProps): Promise<void> { return this.forward(arguments); }
  public async saveThumbnail(_iModelToken: IModelTokenProps, _val: Uint8Array): Promise<void> { return this.forward(arguments); }

  public async requestResources(_tokenProps: IModelTokenProps, _elementIds: Id64Array, _modelIds: Id64Array, _opcode: DbOpcode): Promise<void> { return this.forward(arguments); }
  public async doConcurrencyControlRequest(_tokenProps: IModelTokenProps): Promise<void> { return this.forward(arguments); }
  public async lockModel(_tokenProps: IModelTokenProps, _modelId: Id64String, _level: LockLevel): Promise<void> { return this.forward(arguments); }
  public async synchConcurrencyControlResourcesCache(_tokenProps: IModelTokenProps): Promise<void> { return this.forward(arguments); }
  public async pullMergePush(_tokenProps: IModelTokenProps, _comment: string, _doPush: boolean): Promise<GuidString> { return this.forward(arguments); }
  public async getModelsAffectedByWrites(_tokenProps: IModelTokenProps): Promise<Id64String[]> { return this.forward(arguments); }
  public async getParentChangeset(_iModelToken: IModelTokenProps): Promise<string> { return this.forward(arguments); }

  public async deleteElements(_tokenProps: IModelTokenProps, _ids: Id64Array) { return this.forward(arguments); }
  public async createAndInsertPhysicalModel(_tokenProps: IModelTokenProps, _newModelCode: CodeProps, _privateModel: boolean): Promise<Id64String> { return this.forward(arguments); }
  public async createAndInsertSpatialCategory(_tokenProps: IModelTokenProps, _scopeModelId: Id64String, _categoryName: string, _appearance: SubCategoryAppearance.Props): Promise<Id64String> { return this.forward(arguments); }
}
