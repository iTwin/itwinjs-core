/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import type { LoggingMetaData} from "@itwin/core-bentley";
import { BentleyError, Logger, LogLevel } from "@itwin/core-bentley";
import { IpcApp } from "./IpcApp";

/**
 * Describe log message
 * @internal
 */
interface LogMessage {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  metaData: any;
}
/**
 * NativeAppLogger send log message from frontend to backend. It works on native app only.
 * @internal
 */
export class NativeAppLogger {
  private static _messages: LogMessage[] = [];
  private static _onFlushed: Promise<void> | undefined;
  private static flushToBackend() {
    if (!this._onFlushed && this._messages.length > 0) {
      this._onFlushed = new Promise<void>(() => { this._onFlushed = undefined; });
      const messages = this._messages;
      this._messages = [];
      setTimeout(async () => this.flushBucket(messages));
    }
  }
  private static async flushBucket(messages: LogMessage[]): Promise<void> {
    try {
      while (messages.length > 0) {
        const msg: LogMessage = messages.shift()!;
        await IpcApp.callIpcHost("log", msg.timestamp, msg.level, msg.category, msg.message, { ...msg.metaData });
      }
    } finally {
      // Put back unsent messages.
      this._messages.unshift(...messages);
      if (this._messages.length > 0) {
        this.flushToBackend();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Promise.resolve(this._onFlushed);
      }
    }
  }
  private static log(level: LogLevel, category: string, message: string, metaData: LoggingMetaData) {
    this._messages.push({ timestamp: Date.now(), level, category, message, metaData: BentleyError.getMetaData(metaData) });
    this.flushToBackend();
  }
  public static logError(category: string, message: string, metaData: LoggingMetaData) {
    this.log(LogLevel.Error, category, message, metaData);
  }
  public static logInfo(category: string, message: string, metaData: LoggingMetaData) {
    this.log(LogLevel.Info, category, message, metaData);
  }
  public static logTrace(category: string, message: string, metaData: LoggingMetaData) {
    this.log(LogLevel.Trace, category, message, metaData);
  }
  public static logWarning(category: string, message: string, metaData: LoggingMetaData) {
    this.log(LogLevel.Warning, category, message, metaData);
  }
  public static async flush(): Promise<void> {
    this.flushToBackend();
    if (this._onFlushed) {
      return this._onFlushed;
    }
  }
  public static initialize() {
    const errCb = (category: string, message: string, metaData: LoggingMetaData) => this.logError(category, message, metaData);
    const warnCb = (category: string, message: string, metaData: LoggingMetaData) => this.logWarning(category, message, metaData);
    const infoCb = (category: string, message: string, metaData: LoggingMetaData) => this.logInfo(category, message, metaData);
    const traceCb = (category: string, message: string, metaData: LoggingMetaData) => this.logTrace(category, message, metaData);

    Logger.initialize(errCb, warnCb, infoCb, traceCb);
  }
}
