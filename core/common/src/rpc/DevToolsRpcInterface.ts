/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import type { LogLevel } from "@itwin/core-bentley";
import type { IModelRpcProps } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";

/** Options to get the backend statistics
 * @internal
 */
export enum DevToolsStatsOptions {
  None = 0,

  /** All unitized values are setup as formatted strings with the appropriate units */
  FormatUnits = 1,
}

/** The purpose of this class is to house RPC methods for developer tools.
 * Note that this should NOT be used in production environments.
 * @internal
 */
export abstract class DevToolsRpcInterface extends RpcInterface {
  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): DevToolsRpcInterface { return RpcManager.getClientForInterface(DevToolsRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "DevToolsRpcInterface";

  /** The semantic version of the interface.
   * @note The DevToolsRpcInterface will remain at 0.x since it is for testing only and not intended for production.
   */
  public static interfaceVersion = "0.6.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ==========================================================================================*/
  // Sends a ping and returns true if the backend received the ping
  public async ping(_iModelToken: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }

  // Returns JSON object with backend performance and memory statistics
  public async stats(_iModelToken: IModelRpcProps, _options: DevToolsStatsOptions): Promise<any> { return this.forward(arguments); }

  // Returns JSON object with backend versions (application and iModelJs)
  public async versions(_iModelToken: IModelRpcProps): Promise<any> { return this.forward(arguments); }

  // Sets a new log level for the specified category and returns the old log level
  public async setLogLevel(_iModelToken: IModelRpcProps, _loggerCategory: string, _logLevel: LogLevel): Promise<LogLevel | undefined> { return this.forward(arguments); }
}
