/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { LogLevel } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcManager, DevToolsRpcInterface, IModelTokenProps, DevToolsStatsOptions } from "@bentley/imodeljs-common";
import { DevTools, DevToolsStatsFormatter } from "../DevTools";

/** The backend implementation of WipRpcInterface.
 * @internal
 */
export class DevToolsRpcImpl extends RpcInterface implements DevToolsRpcInterface {

  public static register() { RpcManager.registerImpl(DevToolsRpcInterface, DevToolsRpcImpl); }

  // Returns true if the backend received the ping
  public async ping(_tokenProps: IModelTokenProps): Promise<boolean> {
    return DevTools.ping();
  }

  // Returns JSON object with statistics
  public async stats(_tokenProps: IModelTokenProps, options: DevToolsStatsOptions): Promise<any> {
    const stats = DevTools.stats();
    if (options === DevToolsStatsOptions.None)
      return stats;
    const formattedStats = DevToolsStatsFormatter.toFormattedJson(stats);
    return formattedStats;
  }

  // Returns JSON object with backend versions (application and iModelJs)
  public async versions(_tokenProps: IModelTokenProps): Promise<any> {
    return DevTools.versions();
  }

  // Sets up a log level at the backend
  public async setLogLevel(_tokenProps: IModelTokenProps, loggerCategory: string, logLevel: LogLevel): Promise<LogLevel | undefined> {
    return DevTools.setLogLevel(loggerCategory, logLevel);
  }
}
