/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as os from "os";
import * as process from "process";
import type { LogLevel } from "@itwin/core-bentley";
import { Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { IModelHost } from "./IModelHost";

// cspell:ignore ppid elap

const loggerCategory: string = BackendLoggerCategory.DevTools;

interface StringIndexedObject<T> {
  [index: string]: T;
}

/**
 * Performance and Memory statistics of backend
 * @internal
 */
export interface DevToolsStats {
  os: DevToolsOsStats;
  process: DevToolsProcessStats;
}

/**
 * OS stats of backend
 * @internal
 */
export interface DevToolsOsStats {
  platform: NodeJS.Platform;
  hostname: string;
  totalmem: number;
  freemem: number;
  uptime: number;
  cpus: os.CpuInfo[];
  cpuUsage: number;
}

/**
 * Process stats of backend
 * @internal
 */
export interface DevToolsProcessStats {
  uptime: number;
  pid: number;
  ppid: number;
  memoryUsage: NodeJS.MemoryUsage;
}

/** Utility to format the JSON created by DevTools.stats() to include the appropriate units
 * @internal
 */
export class DevToolsStatsFormatter {
  private static readonly _megaByteProps = ["totalmem", "freemem", "rss", "heapTotal", "heapUsed", "external"];
  private static readonly _percentProps = ["user", "nice", "sys", "idle", "irq", "cpuUsage"];
  private static readonly _mHzProps = ["speed"];
  private static readonly _secondsProps = ["uptime"];

  /** Replacer that includes units - can be used with JSON.stringify()  */
  private static _replacer = (key: string, value: any) => {
    if (DevToolsStatsFormatter._megaByteProps.includes(key))
      return `${value.toFixed()} MB`;
    if (DevToolsStatsFormatter._percentProps.includes(key))
      return `${value.toFixed()}%`;
    if (DevToolsStatsFormatter._mHzProps.includes(key))
      return `${value.toString()} MHz`;
    if (DevToolsStatsFormatter._secondsProps.includes(key))
      return `${value.toFixed()} secs`;
    return value;
  };

  /** Converts the input stats to another JSON object with the appropriate units setup for various fields */
  public static toFormattedJson(stats: any) {
    // Serialize the stats to a string with a replacer that sets up units during the serialization
    const statsStr = JSON.stringify(stats, DevToolsStatsFormatter._replacer);

    // Deserialize back to JSON
    return JSON.parse(statsStr);
  }
}

/**
 * Internal diagnostic utility
 * @internal
 */
export class DevTools {

  /** Receives a ping and returns true */
  public static ping(): boolean {
    Logger.logInfo(loggerCategory, "Received ping at backend");
    return true;
  }

  private static hrtimeToMS(hrtime: any) {
    return hrtime[0] * 1000 + hrtime[1] / 1000000;
  }

  private static bytesToMegaBytes(bytes: number): number {
    const megaBytes = bytes / Math.pow(1024, 2);
    return Math.round(megaBytes * 100) / 100;
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
    // Create a clone
    const srcCpus = os.cpus();
    const cpus = new Array<os.CpuInfo>(srcCpus.length);
    let ii = 0;
    for (const srcCpu of srcCpus)
      cpus[ii++] = { ...srcCpu };

    // Evaluate cpu usage as percentages
    for (const cpu of Object.values(cpus)) {
      const total = Object.values(cpu.times).reduce((_total: number, currValue) => _total += currValue, 0);
      const cpuTimes = cpu.times as StringIndexedObject<number>;
      for (const type of Object.keys(cpuTimes)) {
        const cpuPercent = Math.round(100 * cpuTimes[type] / total);
        cpuTimes[type] = cpuPercent;
      }
    }
    return cpus;
  }

  private static evaluateMemoryUsage() {
    // Create a clone
    const memUsage = { ...process.memoryUsage() } as NodeJS.MemoryUsage;
    const memUsageObj = (memUsage as any) as StringIndexedObject<number>;
    // Evaluate memory usage as mega bytes
    for (const type of Object.keys(memUsageObj)) {
      memUsageObj[type] = this.bytesToMegaBytes(memUsageObj[type]);
    }
    return memUsage;
  }

  private static evaluateProcessStats(): DevToolsProcessStats {
    return {
      uptime: process.uptime(),
      pid: process.pid,
      ppid: process.ppid,
      memoryUsage: this.evaluateMemoryUsage(),
    } as DevToolsProcessStats;
  }

  private static evaluateOsStats(): DevToolsOsStats {
    return {
      platform: os.platform(),
      hostname: os.hostname(),
      totalmem: this.bytesToMegaBytes(os.totalmem()),
      freemem: this.bytesToMegaBytes(os.freemem()),
      uptime: os.uptime(),
      cpus: this.evaluateCpus(),
      cpuUsage: this.evaluateCpuUsage(),
    } as DevToolsOsStats;
  }

  /** Returns JSON object with backend statistics */
  public static stats(): DevToolsStats {
    try {
      const stats = {
        os: this.evaluateOsStats(),
        process: this.evaluateProcessStats(),
      } as DevToolsStats;
      return stats;
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
    IModelHost.platform.clearLogLevelCache();
    return oldLevel;
  }

  /** Obtains the backend application and iTwin.js Core versions */
  public static versions() {
    return {
      application: IModelHost.applicationVersion,
      iTwinJs: require("../../package.json").version, // eslint-disable-line @typescript-eslint/no-var-requires
    };
  }
}
