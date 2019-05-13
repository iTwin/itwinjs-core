/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModel, IModelToken } from "../IModel";

/** The RPC interface for working with *snapshot* iModels.
 * This interface is intended for desktop and mobile products. Web products are discouraged from registering this interface.
 * @beta The *snapshot* concept is solid, but the concept name might change which would cause a class rename.
 */
export abstract class SnapshotIModelRpcInterface extends RpcInterface {
  /** The types that can be marshaled by the interface. */
  public static types = () => [IModelToken];

  /** Returns the SnapshotIModelRpcInterface client instance for the frontend. */
  public static getClient(): SnapshotIModelRpcInterface { return RpcManager.getClientForInterface(SnapshotIModelRpcInterface); }

  /** The version of the interface. */
  public static version = "0.1.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  public async openSnapshot(_fileName: string): Promise<IModel> { return this.forward(arguments); }
  public async closeSnapshot(_iModelToken: IModelToken): Promise<boolean> { return this.forward(arguments); }
}
