/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import type { IModelConnectionProps, IModelRpcProps, SnapshotOpenOptions } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { RpcOperation } from "./core/RpcOperation";
import type { RpcRequestTokenSupplier_T } from "./core/RpcRequest";
import type { RpcRoutingToken } from "./core/RpcRoutingToken";

const unknownIModelId: RpcRequestTokenSupplier_T = (req) => ({ iModelId: "undefined", key: req.parameters[0] });

/** The RPC interface for working with *snapshot* iModels.
 * This interface is intended for desktop and mobile products. Web products are discouraged from registering this interface.
 * @internal
 */
export abstract class SnapshotIModelRpcInterface extends RpcInterface {
  /** Returns the SnapshotIModelRpcInterface client instance for the frontend. */
  public static getClient(): SnapshotIModelRpcInterface { return RpcManager.getClientForInterface(SnapshotIModelRpcInterface); }

  /** Returns the SnapshotIModelRpcInterface client instance for a custom RPC routing configuration. */
  public static getClientForRouting(token: RpcRoutingToken): SnapshotIModelRpcInterface { return RpcManager.getClientForInterface(SnapshotIModelRpcInterface, token); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "SnapshotIModelRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "2.0.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  @RpcOperation.setRoutingProps(unknownIModelId)
  public async openFile(_filePath: string, _opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> { return this.forward(arguments); }

  @RpcOperation.setRoutingProps(unknownIModelId)
  public async openRemote(_key: string, _opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> { return this.forward(arguments); }

  public async close(_iModelRpcProps: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }
}
