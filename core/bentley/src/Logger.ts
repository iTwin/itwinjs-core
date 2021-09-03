/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

import { BeEvent } from "./BeEvent";
import { BentleyError, GetMetaDataFunction, IModelStatus } from "./BentleyError";
import { BentleyLoggerCategory } from "./BentleyLoggerCategory";
import { addClientRequestContext, ClientRequestContext } from "./ClientRequestContext";
import { IDisposable } from "./Disposable";

/** Defines the *signature* for a log function.
 * @public
 */
export type LogFunction = (category: string, message: string, metaData?: GetMetaDataFunction) => void;

/** Defines log filter intercept.
 * @internal
 * */
export type LogIntercept = (level: LogLevel, category: string, message: string, metaData?: GetMetaDataFunction) => boolean;

/** Use to categorize logging messages by severity.
 * @public
 */
export enum LogLevel {
  /** Tracing and debugging - low level */
  Trace,
  /** Information - mid level */
  Info,
  /** Warnings - high level */
  Warning,
  /** Errors - highest level */
  Error,
  /** Higher than any real logging level. This is used to turn a category off. */
  None,
}

/** Identifies a logging category and the LogLevel that should be used for it. The LogLevel is specified by its string name.
 * @public
 */
export interface LoggerCategoryAndLevel {
  category: string;
  logLevel: string;
}

/** Specifies logging levels, including the default logging level and a set of categories and levels for them.
 * @public
 */
export interface LoggerLevelsConfig {
  defaultLevel?: string;
  categoryLevels?: LoggerCategoryAndLevel[];
}

/** Logger allows libraries and apps to report potentially useful information about operations, and it allows apps and users to control
 * how or if the logged information is displayed or collected. See [Learning about Logging]($docs/learning/common/Logging.md).
 * @public
 */
export class Logger {
  private static _logError: LogFunction | undefined;
  private static _logWarning: LogFunction | undefined;
  private static _logInfo: LogFunction | undefined;
  private static _logTrace: LogFunction | undefined;
  private static _logIntercept: LogIntercept | undefined;
  private static _categoryFilter: Map<string, LogLevel> = new Map<string, LogLevel>();
  private static _minLevel: LogLevel | undefined = undefined;
  private static _logExceptionCallstacks = false;
  private static _makeMetaDataEvent: BeEvent<(...arg: any[]) => void> = new BeEvent<(...arg: any[]) => void>();

  /** Initialize the logger streams. Should be called at application initialization time. */
  public static initialize(logError: LogFunction | undefined, logWarning?: LogFunction | undefined, logInfo?: LogFunction | undefined, logTrace?: LogFunction | undefined): void {
    Logger._logError = logError;
    Logger._logWarning = logWarning;
    Logger._logInfo = logInfo;
    Logger._logTrace = logTrace;
    Logger.turnOffLevelDefault();
    Logger.turnOffCategories();
    Logger.clearMetaDataSources();
    Logger.registerMetaDataSource(addClientRequestContext);
  }

  /**
   * Gets raw callbacks which can be use to forward logging
   * @internal
   */
  public static logRaw(level: LogLevel, category: string, message: string, getMetaData?: GetMetaDataFunction): void {
    switch (level) {
      case LogLevel.Error:
        if (this._logError)
          this._logError(category, message, getMetaData);
        break;
      case LogLevel.Info:
        if (this._logInfo)
          this._logInfo(category, message, getMetaData);
        break;
      case LogLevel.Trace:
        if (this._logTrace)
          this._logTrace(category, message, getMetaData);
        break;
      case LogLevel.Warning:
        if (this._logWarning)
          this._logWarning(category, message, getMetaData);
        break;
    }
  }
  /** Register a log intercept that get call called before log is forwarded to log functions.
   * @internal
   */
  public static setIntercept(logIntercept?: LogIntercept) {
    Logger._logIntercept = logIntercept;
  }

  /** Initialize the logger streams to the console. Should be called at application initialization time. */
  public static initializeToConsole(): void {
    /* eslint-disable no-console */
    Logger.initialize(
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log(`Error   |${category}| ${message}${Logger.formatMetaData(getMetaData)}`),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log(`Warning |${category}| ${message}${Logger.formatMetaData(getMetaData)}`),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log(`Info    |${category}| ${message}${Logger.formatMetaData(getMetaData)}`),
      (category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log(`Trace   |${category}| ${message}${Logger.formatMetaData(getMetaData)}`),
    );
    /* eslint-enable no-console */
  }

  /** Register a metadata source to the logger.
   * Source should be in the form of a callback function that adds properties to a metadata object.
   * @beta
   */
  public static registerMetaDataSource(callback: (metadata: any) => void): boolean {
    if (!this._makeMetaDataEvent.has(callback)) {
      this._makeMetaDataEvent.addListener(callback);
      return true;
    }
    return false;
  }

  /** Remove a metadata source.
   * @beta
   */
  public static removeMetaDataSource(callback: (md: any) => void) {
    return this._makeMetaDataEvent.removeListener(callback);
  }

  /** Clear all of a logger's metadata sources.
   * @beta
   */
  private static clearMetaDataSources(): void {
    this._makeMetaDataEvent.clear();
  }

  /** Add metadata from all registered sources.
   * @beta
   */
  private static addMetaDataFromSources(metaData: any): void {
    this._makeMetaDataEvent.raiseEvent(metaData);
  }

  /** @internal used by addon */
  public static getCurrentClientRequestContext(): ClientRequestContext {
    return ClientRequestContext.current;
  }

  /** @internal used by addon */
  public static setCurrentClientRequestContext(obj: any) {
    if (obj === undefined) {
      if (ClientRequestContext.current.activityId !== "")
        new ClientRequestContext("").enter();
    } else {
      if (!(obj instanceof ClientRequestContext))
        throw new TypeError(`${JSON.stringify(obj)} -- this is not an instance of ClientRequestContext`);
      obj.enter();
    }
  }

  public static set logExceptionCallstacks(b: boolean) {
    Logger._logExceptionCallstacks = b;
  }

  /** Should the callstack be included when an exception is logged?  */
  public static get logExceptionCallstacks(): boolean {
    return Logger._logExceptionCallstacks;
  }

  /** Compose the metadata for a log message.  */
  public static makeMetaData(getMetaData?: GetMetaDataFunction): any {
    const metaData: any = getMetaData ? { ...getMetaData() } : {}; // Copy object to avoid mutating the original
    Logger.addMetaDataFromSources(metaData);
    return metaData;
  }

  /** Format the metadata for a log message.  */
  private static formatMetaData(getMetaData?: GetMetaDataFunction): any {
    return getMetaData ? ` ${JSON.stringify(Logger.makeMetaData(getMetaData))}` : "";
  }

  /** Set the least severe level at which messages should be displayed by default. Call setLevel to override this default setting for specific categories. */
  public static setLevelDefault(minLevel: LogLevel): void {
    Logger._minLevel = minLevel;
  }

  /** Set the minimum logging level for the specified category. The minimum level is least severe level at which messages in the
   * specified category should be displayed.
   */
  public static setLevel(category: string, minLevel: LogLevel) {
    Logger._categoryFilter.set(category, minLevel);
  }

  /** Interpret a string as the name of a LogLevel */
  public static parseLogLevel(str: string): LogLevel {
    switch (str.toUpperCase()) {
      case "EXCEPTION": return LogLevel.Error;
      case "FATAL": return LogLevel.Error;
      case "ERROR": return LogLevel.Error;
      case "WARNING": return LogLevel.Warning;
      case "INFO": return LogLevel.Info;
      case "TRACE": return LogLevel.Trace;
      case "DEBUG": return LogLevel.Trace;
    }
    return LogLevel.None;
  }

  /** Set the log level for multiple categories at once. Also see [[validateProps]] */
  public static configureLevels(cfg: LoggerLevelsConfig) {
    Logger.validateProps(cfg);
    if (cfg.defaultLevel !== undefined) {
      this.setLevelDefault(Logger.parseLogLevel(cfg.defaultLevel));
    }
    if (cfg.categoryLevels !== undefined) {
      for (const cl of cfg.categoryLevels) {
        this.setLevel(cl.category, Logger.parseLogLevel(cl.logLevel));
      }
    }
  }

  private static isLogLevel(v: any) {
    return LogLevel.hasOwnProperty(v);
  }

  /** Check that the specified object is a valid LoggerLevelsConfig. This is useful when reading a config from a .json file. */
  public static validateProps(config: any) {
    const validProps = ["defaultLevel", "categoryLevels"];
    for (const prop of Object.keys(config)) {
      if (!validProps.includes(prop))
        throw new BentleyError(IModelStatus.BadArg, `LoggerLevelsConfig - unrecognized property: ${prop}`);
      if (prop === "defaultLevel") {
        if (!Logger.isLogLevel(config.defaultLevel))
          throw new BentleyError(IModelStatus.BadArg, `LoggerLevelsConfig.defaultLevel must be a LogLevel. Invalid value: ${JSON.stringify(config.defaultLevel)}`);
      } else if (prop === "categoryLevels") {
        const value = config[prop];
        if (!Array.isArray(value))
          throw new BentleyError(IModelStatus.BadArg, `LoggerLevelsConfig.categoryLevels must be an array. Invalid value: ${JSON.stringify(value)}`);
        for (const item of config[prop]) {
          if (!item.hasOwnProperty("category") || !item.hasOwnProperty("logLevel"))
            throw new BentleyError(IModelStatus.BadArg, `LoggerLevelsConfig.categoryLevels - each item must be a LoggerCategoryAndLevel {category: logLevel:}. Invalid value: ${JSON.stringify(item)}`);
          if (!Logger.isLogLevel(item.logLevel))
            throw new BentleyError(IModelStatus.BadArg, `LoggerLevelsConfig.categoryLevels - each item's logLevel property must be a LogLevel. Invalid value: ${JSON.stringify(item.logLevel)}`);
        }
      }
    }
  }

  /** Get the minimum logging level for the specified category. */
  public static getLevel(category: string): LogLevel | undefined {
    // Prefer the level set for this category specifically
    const minLevelForThisCategory = Logger._categoryFilter.get(category);
    if (minLevelForThisCategory !== undefined)
      return minLevelForThisCategory;

    // Fall back on the level set for the parent of this category.
    const parent = category.lastIndexOf(".");
    if ((parent !== undefined) && (parent !== -1))
      return Logger.getLevel(category.slice(0, parent));

    // Fall back on the default level.
    return Logger._minLevel;
  }

  /** Turns off the least severe level at which messages should be displayed by default.
   * This turns off logging for all messages for which no category minimum level is defined.
   */
  public static turnOffLevelDefault(): void {
    Logger._minLevel = undefined;
  }

  /** Turns off all category level filters previously defined with [[Logger.setLevel]].
   */
  public static turnOffCategories(): void {
    Logger._categoryFilter.clear();
  }

  /** Check if messages in the specified category should be displayed at this level of severity. */
  public static isEnabled(category: string, level: LogLevel): boolean {
    const minLevel = Logger.getLevel(category);
    return (minLevel !== undefined) && (level >= minLevel);
  }

  /** Log the specified message to the **error** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logError(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logIntercept) {
      if (!Logger._logIntercept(LogLevel.Error, category, message, metaData))
        return;
    }
    if (Logger._logError && Logger.isEnabled(category, LogLevel.Error))
      Logger._logError(category, message, metaData);
  }

  private static getExceptionMessage(err: Error): string {
    let msg = err.toString();
    if (Logger.logExceptionCallstacks && err.stack)
      msg += `\n${err.stack}`;
    return msg;
  }

  /** Log the specified exception. The special "ExceptionType" property will be added as metadata,
   * in addition to any other metadata that may be supplied by the caller, unless the
   * metadata supplied by the caller already includes this property.
   * @param category  The category of the message.
   * @param err  The exception object.
   * @param log The logger output function to use - defaults to Logger.logError
   * @param metaData  Optional data for the message
   */
  public static logException(category: string, err: Error, log: LogFunction = Logger.logError, metaData?: GetMetaDataFunction): void {
    log(category, Logger.getExceptionMessage(err), () => {
      const mdata = metaData ? metaData() : {};
      if (!mdata.hasOwnProperty("ExceptionType"))
        mdata.ExceptionType = err.constructor.name;
      return mdata;
    });
  }

  /** Log the specified message to the **warning** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logWarning(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logIntercept) {
      if (!Logger._logIntercept(LogLevel.Warning, category, message, metaData))
        return;
    }
    if (Logger._logWarning && Logger.isEnabled(category, LogLevel.Warning))
      Logger._logWarning(category, message, metaData);
  }

  /** Log the specified message to the **info** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logInfo(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logIntercept) {
      if (!Logger._logIntercept(LogLevel.Info, category, message, metaData))
        return;
    }
    if (Logger._logInfo && Logger.isEnabled(category, LogLevel.Info))
      Logger._logInfo(category, message, metaData);
  }

  /** Log the specified message to the **trace** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logTrace(category: string, message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logIntercept) {
      if (!Logger._logIntercept(LogLevel.Trace, category, message, metaData))
        return;
    }
    if (Logger._logTrace && Logger.isEnabled(category, LogLevel.Trace))
      Logger._logTrace(category, message, metaData);
  }
}

/** Simple performance diagnostics utility.
 * It measures the time from construction to disposal. On disposal it logs the routine name along with
 * the duration in milliseconds.
 * It also logs the routine name at construction time so that nested calls can be disambiguated.
 *
 * The timings are logged using the log category **Performance** and log severity [[LogLevel.INFO]].
 * Enable those, if you want to capture timings.
 * @public
 */
export class PerfLogger implements IDisposable {
  private static _severity: LogLevel = LogLevel.Info;

  private _operation: string;
  private _metaData?: GetMetaDataFunction;
  private _startTimeStamp: number;

  public constructor(operation: string, metaData?: GetMetaDataFunction) {
    this._operation = operation;
    this._metaData = metaData;

    if (!Logger.isEnabled(BentleyLoggerCategory.Performance, PerfLogger._severity)) {
      this._startTimeStamp = 0;
      return;
    }

    Logger.logInfo(BentleyLoggerCategory.Performance, `${this._operation},START`, this._metaData);
    this._startTimeStamp = new Date().getTime(); // take timestamp
  }

  private logMessage(): void {
    const endTimeStamp: number = new Date().getTime();
    if (!Logger.isEnabled(BentleyLoggerCategory.Performance, PerfLogger._severity))
      return;

    Logger.logInfo(BentleyLoggerCategory.Performance, `${this._operation},END`, () => {
      const mdata = this._metaData ? this._metaData() : {};
      return {
        ...mdata, TimeElapsed: endTimeStamp - this._startTimeStamp, // eslint-disable-line @typescript-eslint/naming-convention
      };
    });
  }

  public dispose(): void {
    this.logMessage();
  }
}

