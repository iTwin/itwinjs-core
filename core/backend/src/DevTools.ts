/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { LogLevel, Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "./IModelHost";
import * as os from "os";
import * as process from "process";

const loggerCategory = "imodeljs_backend.DevTools";

/**
 * Internal diagnostic utility
 * @internal
 */
export class DevTools {

  /** Process a signal at the addon and return false if it wasn't processed */
  public static signal(signalType: number): boolean {
    Logger.logInfo(loggerCategory, `About to process signal`, () => ({ signalType }));
    return IModelHost.platform.NativeDevTools.signal(signalType);
  }

  /** Receives a ping and returns true */
  public static ping(): boolean {
    Logger.logInfo(loggerCategory, "Received ping at backend");
    return true;
  }

  private static evaluateCpuUsage(): number {
    const startHrTime = process.hrtime();
    const startUsage = process.cpuUsage();

    // spin the CPU for 1000 milliseconds
    const now = Date.now();
    while (Date.now() - now < 1000);

    const elapUsage = process.cpuUsage(startUsage); // micro seconds
    const elapHrTime = process.hrtime(startHrTime);

    const elapTime = elapHrTime[0] + elapHrTime[1] / 1000; // micro seconds

    const cpuUsagePercent = Math.round(100 * (elapUsage.user + elapUsage.system) / elapTime);
    return cpuUsagePercent;
  }

  /** Returns JSON object with backend statistics */
  public static stats(): any {
    try {
      const stat = {
        os: {
          platform: os.platform(),
          hostname: os.hostname(),
          totalmem: os.totalmem(),
          freemem: os.freemem(),
          uptime: os.uptime(),
          cpus: os.cpus(),
          cpuUsagePercent: this.evaluateCpuUsage(),
        },
        process: {
          memoryUsage: process.memoryUsage,
        },
      };
      return stat;
    } catch (error) {
      Logger.logError(loggerCategory, "Could not fetch stats at backend");
      throw error;
    }
  }

  /** Sets up a log level at the backend and returns the old log level */
  public static setLogLevel(inLoggerCategory: string, newLevel: LogLevel): LogLevel | undefined {
    const oldLevel = Logger.getLevel(inLoggerCategory);
    Logger.logInfo(loggerCategory, `Setting log level`, () => ({ loggerCategory: inLoggerCategory, oldLevel, newLevel }));
    Logger.setLevel(inLoggerCategory, newLevel);
    return oldLevel;
  }

}
