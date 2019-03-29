/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { LogLevel } from "@bentley/bentleyjs-core";
import { DevToolsRpcInterface } from "@bentley/imodeljs-common";

/**
 * Internal diagnostic utility for backends
 * @internal
 */
export class DevTools {

  /** Process a signal at the backend (addon) and return false if it wasn't processed */
  public static async signal(signalType: number): Promise<boolean> {
    return DevToolsRpcInterface.getClient().signal(signalType);
  }

  /** Sends one or more pings to the backend
   * @param count Number of pings to send to the backend
   * @return true if *all* the pings were received by the backend.
   */
  public static async ping(count: number): Promise<boolean> {
    const pings = new Array<Promise<boolean>>(count);
    for (let ii = 0; ii < count; ii++) {
      pings[ii] = DevToolsRpcInterface.getClient().ping();
    }
    const statuses: boolean[] = await Promise.all(pings);

    const status = statuses.reduce((acc: boolean, curr: boolean) => acc && curr);
    return status;
  }

  /** Returns JSON object with backend statistics */
  public static async stats(): Promise<any> {
    return DevToolsRpcInterface.getClient().stats();
  }

  /** Sets up a log level at the backend and returns the old log level */
  public static async setLogLevel(inLoggerCategory: string, newLevel: LogLevel): Promise<LogLevel | undefined> {
    return DevToolsRpcInterface.getClient().setLogLevel(inLoggerCategory, newLevel);
  }

}
