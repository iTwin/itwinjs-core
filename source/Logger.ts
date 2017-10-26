/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GetMetaDataFunction } from "./IModelError";

/** Defines the *signature* for a log function. */
export type LogFunction = (message: string, metaData?: GetMetaDataFunction) => void;

 /** Class for configuring logging messages generated from this framework. */
export class Logger {
  private static _logError: LogFunction | undefined;
  private static _logWarning: LogFunction | undefined;
  private static _logInfo: LogFunction | undefined;

  /** Initialize the logger streams. Should be called at application initialization time. */
  public static initialize(logError: LogFunction | undefined, logWarning?: LogFunction | undefined, logInfo?: LogFunction | undefined): void {
    Logger._logError = logError;
    Logger._logWarning = logWarning;
    Logger._logInfo = logInfo;
  }

  /** Log the specified message to the **error** stream. */
  public static logError(message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logError)
      Logger._logError(message, metaData);
  }

  /** Log the specified message to the **warning** stream. */
  public static logWarning(message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logWarning)
      Logger._logWarning(message, metaData);
  }

  /** Log the specified message to the **info** stream. */
  public static logInfo(message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logInfo)
      Logger._logInfo(message, metaData);
  }
}
