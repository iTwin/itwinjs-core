/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { LogLevel } from "@bentley/bentleyjs-core";
import { DevToolsRpcInterface, IModelToken } from "@bentley/imodeljs-common";

/**
 * Results of the ping test
 * @internal
 */
export interface PingTestResult {
  /** Minimum time for the ping response. Set to undefined if any one ping didn't get a response. */
  min: number | undefined;
  /** Maximum time for the ping response, Set to undefined if any one ping didn't get a response. */
  max: number | undefined;
  /** Average time for the ping response. Set to undefined if any one ping didn't get a response. */
  avg: number | undefined;
}

/**
 * Internal diagnostic utility for backends
 * @internal
 */
export class DevTools {

  /** Create a new connection with a specific backend instance.
   * @param iModelToken The iModelToken that identifies that backend instance.
   * Supply a dummy token if contacting the backend without the Orchestrator.
   */
  public static connectToBackendInstance(iModelToken: IModelToken): DevTools {
    return new DevTools(iModelToken);
  }

  /** Constructor */
  private constructor(private readonly _iModelToken: IModelToken) {
  }

  /** Process a signal at the backend (addon) and return false if it wasn't processed */
  public async signal(signalType: number): Promise<boolean> {
    return DevToolsRpcInterface.getClient().signal(this._iModelToken, signalType);
  }

  /** Measures the round trip times for one or more pings to the backend
   * @param count Number of pings to send to the backend
   * @return Result of ping test.
   */
  public async ping(count: number): Promise<PingTestResult> {
    const pings = new Array<Promise<number | undefined>>(count);

    const startFn = async (): Promise<number> => {
      return Promise.resolve(Date.now());
    };

    const pingFn = async (start: number): Promise<number> => {
      await DevToolsRpcInterface.getClient().ping(this._iModelToken);
      return Promise.resolve(Date.now() - start);
    };

    for (let ii = 0; ii < count; ii++)
      pings[ii] = startFn().then(pingFn).catch(() => Promise.resolve(undefined));

    const pingTimes: Array<number | undefined> = await Promise.all(pings);

    const min: number | undefined = pingTimes.reduce((acc: number | undefined, curr: number | undefined) => {
      if (!acc) return curr;
      if (!curr) return acc;
      return Math.min(acc, curr);
    }, undefined);

    const max: number | undefined = pingTimes.reduce((acc: number | undefined, curr: number | undefined) => {
      if (!acc) return curr;
      if (!curr) return acc;
      return Math.max(acc, curr);
    }, undefined);

    const total: number | undefined = pingTimes.reduce((acc: number | undefined, curr: number | undefined) => {
      if (typeof acc === "undefined") return undefined;
      if (!curr) return undefined;
      return acc + curr;
    }, 0);

    const avg = total ? total / count : undefined;
    return { min, max, avg };
  }

  /** Returns JSON object with backend statistics */
  public async stats(): Promise<any> {
    return DevToolsRpcInterface.getClient().stats(this._iModelToken);
  }

  /** Sets up a log level at the backend and returns the old log level */
  public async setLogLevel(inLoggerCategory: string, newLevel: LogLevel): Promise<LogLevel | undefined> {
    return DevToolsRpcInterface.getClient().setLogLevel(this._iModelToken, inLoggerCategory, newLevel);
  }
}
