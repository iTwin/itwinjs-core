/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { LogLevel } from "@itwin/core-bentley";
import type { IModelRpcProps } from "@itwin/core-common";
import { DevToolsRpcInterface, DevToolsStatsOptions } from "@itwin/core-common";

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
   * @param tokenProps The iModelToken that identifies that backend instance.
   * Supply a dummy token if contacting the backend without the Orchestrator.
   */
  public static connectToBackendInstance(tokenProps: IModelRpcProps): DevTools {
    return new DevTools(tokenProps);
  }

  /** Constructor */
  private constructor(
    private readonly _tokenProps: IModelRpcProps) {
  }

  /** Measures the round trip times for one or more pings to the backend
   * @param count Number of pings to send to the backend
   * @return Result of ping test.
   */
  public async ping(count: number): Promise<PingTestResult> {
    const pings = new Array<Promise<number | undefined>>(count);

    const pingFn = async (): Promise<number> => {
      const start = Date.now();
      await DevToolsRpcInterface.getClient().ping(this._tokenProps);
      return Date.now() - start;
    };

    for (let ii = 0; ii < count; ii++)
      pings[ii] = pingFn().catch(async () => undefined);

    const pingTimes: Array<number | undefined> = await Promise.all(pings);

    const min: number | undefined = pingTimes.reduce((acc: number | undefined, curr: number | undefined) => {
      if (!acc) return curr;
      if (!curr) return acc;
      return Math.min(acc, curr);
    }, undefined);

    const max: number | undefined = pingTimes.reduce((acc: number | undefined, curr: number | undefined) => {
      if (typeof acc === "undefined") return undefined;
      if (!curr) return curr;
      return Math.max(acc, curr);
    }, 0);

    const total: number | undefined = pingTimes.reduce((acc: number | undefined, curr: number | undefined) => {
      if (typeof acc === "undefined") return undefined;
      if (!curr) return undefined;
      return acc + curr;
    }, 0);

    const avg = total ? total / count : undefined;
    return { min, max, avg };
  }

  /** Returns JSON object with backend statistics */
  public async stats(options: DevToolsStatsOptions = DevToolsStatsOptions.FormatUnits): Promise<any> {
    return DevToolsRpcInterface.getClient().stats(this._tokenProps, options);
  }

  // Returns JSON object with backend versions (application and iModelJs)
  public async versions(): Promise<any> {
    return DevToolsRpcInterface.getClient().versions(this._tokenProps);
  }

  /** Sets up a log level at the backend and returns the old log level */
  public async setLogLevel(inLoggerCategory: string, newLevel: LogLevel): Promise<LogLevel | undefined> {
    return DevToolsRpcInterface.getClient().setLogLevel(this._tokenProps, inLoggerCategory, newLevel);
  }
}
