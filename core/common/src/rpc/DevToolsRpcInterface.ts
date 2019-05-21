/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { LogLevel } from "@bentley/bentleyjs-core";
import { IModelToken } from "../IModel";
import { IModelNotFoundResponse } from "./IModelReadRpcInterface";

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
  /** The types that can be marshaled by the interface. */
  public static types = () => [
    IModelToken,
    IModelNotFoundResponse,
  ]

  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): DevToolsRpcInterface { return RpcManager.getClientForInterface(DevToolsRpcInterface); }

  /** The semantic version of the interface. */
  public static version = "0.3.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ==========================================================================================*/
  // Sends a ping and returns true if the backend received the ping
  public async ping(_iModelToken: IModelToken): Promise<boolean> { return this.forward(arguments); }

  // Returns JSON object with backend performance and memory statistics
  public async stats(_iModelToken: IModelToken, _options: DevToolsStatsOptions): Promise<any> { return this.forward(arguments); }

  // Returns JSON object with backend versions (application and iModelJs)
  public async versions(_iModelToken: IModelToken): Promise<any> { return this.forward(arguments); }

  // Sets a new log level for the specified category and returns the old log level
  public async setLogLevel(_iModelToken: IModelToken, _loggerCategory: string, _logLevel: LogLevel): Promise<LogLevel | undefined> { return this.forward(arguments); }
}
