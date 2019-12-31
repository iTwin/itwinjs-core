/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { LogLevel, GuidString } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcManager, DevToolsRpcInterface, IModelTokenProps, DevToolsStatsOptions, IModelToken } from "@bentley/imodeljs-common";
import { DevTools, DevToolsStatsFormatter } from "../DevTools";
import { IModelDb } from "../IModelDb";
import { EventSinkManager } from "./EventSourceRpcImpl";

/** The backend implementation of WipRpcInterface.
 * @internal
 */
export class DevToolsRpcImpl extends RpcInterface implements DevToolsRpcInterface {
  public static register() { RpcManager.registerImpl(DevToolsRpcInterface, DevToolsRpcImpl); }

  // Returns true if the backend received the ping
  public async ping(_tokenProps: IModelTokenProps): Promise<boolean> {
    return DevTools.ping();
  }

  // set event that will be send to the frontend
  public async echo(tokenProps: IModelTokenProps, id: GuidString, message: string): Promise<void> {
    if (EventSinkManager.GLOBAL === tokenProps.key) {
      EventSinkManager.global.emit(DevToolsRpcInterface.name, "echo", { id, message });
    } else {
      const iModelToken = IModelToken.fromJSON(tokenProps);
      const iModelDb = IModelDb.find(iModelToken);
      iModelDb.eventSink!.emit(DevToolsRpcInterface.name, "echo", { id, message });
    }
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
