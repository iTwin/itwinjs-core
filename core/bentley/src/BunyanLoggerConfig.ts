/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

// tslint:disable-next-line:no-var-requires
const bunyan = require("bunyan");
import { GetMetaDataFunction } from "./BentleyError";
import { LogFunction, Logger } from "./Logger";

/** Helps to configure the bentleyjs-core Logger to use bunyan.
 * To use bunyan for logging output, the app should depend on the bunyan package.
 * The app should create a bunyan logger and then call [[BunyanLoggerConfig.logToBunyan]] to
 * direct [[Logger]] output to the bunyan logger.
 *
 * To log to the console in bunyan format, the app can call the [[BunyanLoggerConfig.logToStdoutViaBunyan]] helper method.
 * You can then pipe the output through the bunyan command-line program to format and filter it.
 *
 * See [[SeqLoggerConfig]] to log to a seq server using bunyan.
 */
export class BunyanLoggerConfig {
  // Generate metadata for a bunyan record. If nothing else, it must contain the message category.
  // Also make sure that Logger gets a change to add its required metadata.
  private static makeBunyanMetaData(category: string, getMetaData?: GetMetaDataFunction) {
    let mdata = Logger.makeMetaData(getMetaData);
    if (!mdata)
      mdata = {};
    if (!mdata.hasOwnProperty("loggerCategory"))      // (don't use the name "category". That could mean something (else) in the caller's metadata.)
      mdata.loggerCategory = category;
    return mdata;
  }

  /** Initialize the logger streams to stdout/stderr using bunyan format. Should be called at application initialization time. */
  public static logToStdoutViaBunyan(loggerName: string): void {
    const blgr = bunyan.createLogger({
      name: loggerName,
      streams: [
        { stream: process.stdout, level: "trace" }, // Use only one stream! Otherwise, we will get logging messages coming out multiple times, once for each stream. (https://github.com/trentm/node-bunyan/issues/334)
      ],
    });
    this.logToBunyan(blgr);
  }

  /** Initialize the logger streams to the specified bunyan logger. */
  public static logToBunyan(blgr: any) {
    // Map between iModel.js LogFunction signature and bunyan logger
    const errorLogger: LogFunction = (category: string, message: string, getMetaData?: GetMetaDataFunction): void => blgr.error(BunyanLoggerConfig.makeBunyanMetaData(category, getMetaData), message);
    const warningLogger: LogFunction = (category: string, message: string, getMetaData?: GetMetaDataFunction): void => blgr.warn(BunyanLoggerConfig.makeBunyanMetaData(category, getMetaData), message);
    const infoLogger: LogFunction = (category: string, message: string, getMetaData?: GetMetaDataFunction): void => blgr.info(BunyanLoggerConfig.makeBunyanMetaData(category, getMetaData), message);
    const traceLogger: LogFunction = (category: string, message: string, getMetaData?: GetMetaDataFunction): void => blgr.trace(BunyanLoggerConfig.makeBunyanMetaData(category, getMetaData), message);
    Logger.initialize(errorLogger, warningLogger, infoLogger, traceLogger);
  }

}
