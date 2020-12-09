/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnectionProps, IModelRpcProps, StandaloneOpenOptions } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";

/** The RPC interface for working with *standalone* iModels.
 * @note This interface is only intended for desktop and mobile products.
 * @internal
 */
export abstract class StandaloneIModelRpcInterface extends RpcInterface {
  /** Returns the StandaloneIModelRpcInterface client instance for the frontend. */
  public static getClient(): StandaloneIModelRpcInterface { return RpcManager.getClientForInterface(StandaloneIModelRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "StandaloneIModelRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "1.0.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/

  public async openFile(_filePath: string, _openMode: OpenMode, _opts?: StandaloneOpenOptions): Promise<IModelConnectionProps> { return this.forward(arguments); }
  public async close(_iModelRpcProps: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }
}
