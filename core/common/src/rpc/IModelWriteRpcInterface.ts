/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelProps, IModelTokenProps } from "../IModel";
import { AxisAlignedBox3dProps } from "../geometry/Placement";

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
  public async updateProjectExtents(_iModelToken: IModelTokenProps, _newExtents: AxisAlignedBox3dProps): Promise<void> { return this.forward(arguments); }
  public async saveThumbnail(_iModelToken: IModelTokenProps, _val: Uint8Array): Promise<void> { return this.forward(arguments); }
}
