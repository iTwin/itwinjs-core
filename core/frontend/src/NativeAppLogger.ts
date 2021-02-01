/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { GetMetaDataFunction, Logger, LogLevel } from "@bentley/bentleyjs-core";
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
  private static log(level: LogLevel, category: string, message: string, getMetaData?: GetMetaDataFunction) {
    this._messages.push({ timestamp: Date.now(), level, category, message, metaData: getMetaData ? getMetaData() : {} });
    this.flushToBackend();
  }
  public static logError(category: string, message: string, getMetaData?: GetMetaDataFunction) {
    this.log(LogLevel.Error, category, message, getMetaData);
  }
  public static logInfo(category: string, message: string, getMetaData?: GetMetaDataFunction) {
    this.log(LogLevel.Info, category, message, getMetaData);
  }
  public static logTrace(category: string, message: string, getMetaData?: GetMetaDataFunction) {
    this.log(LogLevel.Trace, category, message, getMetaData);
  }
  public static logWarning(category: string, message: string, getMetaData?: GetMetaDataFunction) {
    this.log(LogLevel.Warning, category, message, getMetaData);
  }
  public static async flush(): Promise<void> {
    this.flushToBackend();
    if (this._onFlushed) {
      return this._onFlushed;
    }
  }
  public static initialize() {
    const errCb = (category: string, message: string, getMetaData?: GetMetaDataFunction) => this.logError(category, message, getMetaData);
    const warnCb = (category: string, message: string, getMetaData?: GetMetaDataFunction) => this.logWarning(category, message, getMetaData);
    const infoCb = (category: string, message: string, getMetaData?: GetMetaDataFunction) => this.logInfo(category, message, getMetaData);
    const traceCb = (category: string, message: string, getMetaData?: GetMetaDataFunction) => this.logTrace(category, message, getMetaData);

    Logger.initialize(errCb, warnCb, infoCb, traceCb);
  }
}
