/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/* eslint-disable deprecation/deprecation */

import { IModelConnectionProps, IModelRpcProps, SnapshotOpenOptions } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { RpcOperation } from "./core/RpcOperation";
import { RpcRequestTokenSupplier_T } from "./core/RpcRequest";
import { RpcRoutingToken } from "./core/RpcRoutingToken";

const unknownIModelId: RpcRequestTokenSupplier_T = (req) => ({ iModelId: "undefined", key: req.parameters[0] });

/** The RPC interface for working with *snapshot* iModels.
 * This interface is intended for desktop and mobile products. Web products are discouraged from registering this interface.
 * @internal
 * @deprecated in 4.10. Check [[IpcAppFunctions]] or [[ConnectionConnection]] for replacements.
 */
export abstract class SnapshotIModelRpcInterface extends RpcInterface { // eslint-disable-line deprecation/deprecation
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

  /**
   * @deprecated in 4.10. Use [[IpcAppFunctions.openSnapshot]] in IPC applications, no replacement for Web applications.
   */
  @RpcOperation.setRoutingProps(unknownIModelId)
  public async openFile(_filePath: string, _opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> { return this.forward(arguments); }

  /**
   * @deprecated in 4.10. Use [[ConnectionConnection.openRemote]].
   */
  @RpcOperation.setRoutingProps(unknownIModelId)
  public async openRemote(_key: string, _opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> { return this.forward(arguments); }

  /**
   * @deprecated in 4.10. Use [[IpcAppFunctions.closeIModel]] in IPC applications, no replacement for Web applications.
   */
  public async close(_iModelRpcProps: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }
}
