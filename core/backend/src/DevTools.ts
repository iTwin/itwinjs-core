/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { LogLevel, Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "./IModelHost";
import * as os from "os";
import * as process from "process";

const loggerCategory = "imodeljs_backend.DevTools";

interface StringIndexedObject<T> {
  [index: string]: T;
}

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

  private static hrtimeToMS(hrtime: any) {
    return hrtime[0] * 1000 + hrtime[1] / 1000000;
  }

  private static evaluateCpuUsage(): number {
    const NUMBER_OF_CPUS = os.cpus().length;
    const startTime = process.hrtime();
    const startUsage = process.cpuUsage();

    // spin the CPU for 500 milliseconds
    const now = Date.now();
    while (Date.now() - now < 500);

    const elapTime = process.hrtime(startTime);
    const elapUsage = process.cpuUsage(startUsage);

    const elapTimeMS = this.hrtimeToMS(elapTime);

    const elapUserMS = elapUsage.user / 1000; // microseconds to milliseconds
    const elapSystMS = elapUsage.system / 1000;
    const cpuPercent = Math.round((100 * (elapUserMS + elapSystMS) / elapTimeMS / NUMBER_OF_CPUS));

    return cpuPercent;
  }

  private static evaluateCpus(): os.CpuInfo[] {
    const cpus = new Array<os.CpuInfo>();
    Object.assign(cpus, os.cpus());
    for (const cpu of Object.values(cpus)) {
      const total = Object.values(cpu.times).reduce((_total: number, currValue) => _total += currValue, 0);

      const cpuTimes = cpu.times as StringIndexedObject<number>;
      for (const type of Object.keys(cpuTimes)) {
        cpuTimes[type] = Math.round(100 * cpuTimes[type] / total);
      }
    }
    return cpus;
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
          cpus: this.evaluateCpus(),
          cpuUsage: this.evaluateCpuUsage(),
        },
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          ppid: process.ppid,
          memoryUsage: process.memoryUsage(),
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
