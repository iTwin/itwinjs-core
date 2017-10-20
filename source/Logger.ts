/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GetMetaDataFunction, IModelError } from "./IModelError";

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

  /** Log the error and then call Promise.reject passing the specified error. */
  public static logErrorAndReject(error: IModelError): Promise<never> {
    Logger.logError(error.toDebugString(), error.hasMetaData() ? error.getMetaData : undefined);
    return Promise.reject(error);
  }

  /** Log the error before throwing it. */
  public static logErrorAndThrow(error: IModelError): void {
    Logger.logError(error.toDebugString(), error.hasMetaData() ? error.getMetaData : undefined);
    throw error;
  }

  /** Log the specified message to the **warning** stream. */
  public static logWarning(message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logWarning)
      Logger._logWarning(message, metaData);
  }

  /** Log the warning and then call Promise.reject passing the specified warning. */
  public static logWarningAndReject(warning: IModelError): Promise<never> {
    Logger.logWarning(warning.toDebugString(), warning.hasMetaData() ? warning.getMetaData : undefined);
    return Promise.reject(warning);
  }

  /** Log the warning before throwing it. */
  public static logWarningAndThrow(warning: IModelError): void {
    Logger.logWarning(warning.toDebugString(), warning.hasMetaData() ? warning.getMetaData : undefined);
    throw warning;
  }

  /** Log the specified message to the **info** stream. */
  public static logInfo(message: string, metaData?: GetMetaDataFunction): void {
    if (Logger._logInfo)
      Logger._logInfo(message, metaData);
  }
}
