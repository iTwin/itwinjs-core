/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

import { BentleyError, IModelStatus, LoggingMetaData } from "./BentleyError";
import { BentleyLoggerCategory } from "./BentleyLoggerCategory";
import { IDisposable } from "./Disposable";

/** Defines the *signature* for a log function.
 * @public
 */
export type LogFunction = (category: string, message: string, metaData: LoggingMetaData) => void;

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
  protected static _logError: LogFunction | undefined;
  protected static _logWarning: LogFunction | undefined;
  protected static _logInfo: LogFunction | undefined;
  protected static _logTrace: LogFunction | undefined;
  private static _categoryFilter: Map<string, LogLevel> = new Map<string, LogLevel>();
  private static _minLevel: LogLevel | undefined = undefined;

  /** Should the call stack be included when an exception is logged?  */
  public static logExceptionCallstacks = false;

  /** All static metadata is combined with per-call metadata and stringified in every log message.
   * Static metadata can either be an object or a function that returns an object.
   * Use a key to identify entries in the map so the can be removed individually.
   * @internal */
  public static staticMetaData = new Map<string, LoggingMetaData>();

  /** Initialize the logger streams. Should be called at application initialization time. */
  public static initialize(logError?: LogFunction, logWarning?: LogFunction, logInfo?: LogFunction, logTrace?: LogFunction): void {
    Logger._logError = logError;
    Logger._logWarning = logWarning;
    Logger._logInfo = logInfo;
    Logger._logTrace = logTrace;
    Logger.turnOffLevelDefault();
    Logger.turnOffCategories();
  }

  /** Initialize the logger to output to the console. */
  public static initializeToConsole(): void {
    const logConsole = (level: string) => (category: string, message: string, metaData: LoggingMetaData) =>
      console.log(`${level} | ${category} | ${message} ${Logger.stringifyMetaData(metaData)}`); // eslint-disable-line no-console

    Logger.initialize(logConsole("Error"), logConsole("Warning"), logConsole("Info"), logConsole("Trace"));
  }

  /** stringify the metadata for a log message by merging the supplied metadata with all static metadata into one object that is then `JSON.stringify`ed. */
  public static stringifyMetaData(metaData?: LoggingMetaData): string {
    const metaObj = {};
    for (const meta of Logger.staticMetaData) {
      const val = BentleyError.getMetaData(meta[1]);
      if (val)
        Object.assign(metaObj, val);
    }
    Object.assign(metaObj, BentleyError.getMetaData(metaData)); // do this last so user supplied values take precedence
    return Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : "";
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

  private static isLogLevel(v: string) {
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
    if (parent !== -1)
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
  public static logError(category: string, message: string, metaData?: LoggingMetaData): void {
    if (Logger._logError && Logger.isEnabled(category, LogLevel.Error))
      Logger._logError(category, message, metaData);
  }

  private static getExceptionMessage(err: unknown): string {
    const stack = Logger.logExceptionCallstacks ? `\n${BentleyError.getErrorStack(err)}` : "";
    return BentleyError.getErrorMessage(err) + stack;
  }

  /** Log the specified exception. The special "ExceptionType" property will be added as metadata,
   * in addition to any other metadata that may be supplied by the caller, unless the
   * metadata supplied by the caller already includes this property.
   * @param category  The category of the message.
   * @param err  The exception object.
   * @param log The logger output function to use - defaults to Logger.logError
   * @param metaData  Optional data for the message
   */
  public static logException(category: string, err: any, log: LogFunction = Logger.logError): void {
    log(category, Logger.getExceptionMessage(err), () => {
      return { ...BentleyError.getErrorMetadata(err), exceptionType: err.constructor.name };
    });
  }

  /** Log the specified message to the **warning** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logWarning(category: string, message: string, metaData?: LoggingMetaData): void {
    if (Logger._logWarning && Logger.isEnabled(category, LogLevel.Warning))
      Logger._logWarning(category, message, metaData);
  }

  /** Log the specified message to the **info** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logInfo(category: string, message: string, metaData?: LoggingMetaData): void {
    if (Logger._logInfo && Logger.isEnabled(category, LogLevel.Info))
      Logger._logInfo(category, message, metaData);
  }

  /** Log the specified message to the **trace** stream.
   * @param category  The category of the message.
   * @param message  The message.
   * @param metaData  Optional data for the message
   */
  public static logTrace(category: string, message: string, metaData?: LoggingMetaData): void {
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
  private _metaData?: LoggingMetaData;
  private _startTimeStamp: number;

  public constructor(operation: string, metaData?: LoggingMetaData) {
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
      const mdata = this._metaData ? BentleyError.getMetaData(this._metaData) : {};
      return {
        ...mdata, TimeElapsed: endTimeStamp - this._startTimeStamp, // eslint-disable-line @typescript-eslint/naming-convention
      };
    });
  }

  public dispose(): void {
    this.logMessage();
  }
}

