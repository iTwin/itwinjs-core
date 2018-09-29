/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

import { BentleyError, IModelStatus } from "./BentleyError";

// tslint:disable-next-line:no-var-requires
const seq = require("bunyan-seq");
// tslint:disable-next-line:no-var-requires
const bunyan = require("bunyan");

/** seq logging server configuration. */
export interface SeqConfig {
  /** The URL of the seq server to connect to. Defaults to localhost. */
  hostURL?: string;
  /** The port of the seq server. Defaults to 5341. */
  port?: number;
  /** The API Key to use when connecting to Seq */
  apiKey?: string;
  /** The maximum batch size to send to Seq (should not exceed Settings > System > Raw ingestion payload limit) */
  batchSizeLimit?: number;
  /** The time in milliseconds that the logger will wait for additional events before sending a batch to Seq */
  maxBatchingTime?: number;
  /** If true, error events raised by the stream will propagate as 'error' events on the Bunyan logger object. */
  reemitErrorEvents?: boolean;
}

/** Helps to configure the bentleyjs-core Logger to use bunyan and seq.
 * Note: The app must depend on the bunyan and bunyan-seq packages.
 */
export class SeqLoggerConfig {

  /** Create a bunyan logger that streams to seq.
   * ```
   * BunyanLoggerConfig.logToBunyan(SeqLoggerConfig.createBunyanSeqLogger(seqConfig));
   * ```
   * See [[BunyanLoggerConfig.logToBunyan]]
   */
  public static createBunyanSeqLogger(seqConfig: SeqConfig, loggerName: string): any {
    if (seqConfig === undefined)
      seqConfig = {};

    const seqStreamParams: any = {};
    seqStreamParams.serverUrl = (seqConfig.hostURL || "http://localhost") + ":" + (seqConfig.port || 5341);

    if (seqConfig.apiKey !== undefined)
      seqStreamParams.apiKey = seqConfig.apiKey;

    if (seqConfig.batchSizeLimit !== undefined)
      seqStreamParams.batchSizeLimit = seqConfig.batchSizeLimit;

    if (seqConfig.maxBatchingTime !== undefined)
      seqStreamParams.maxBatchingTime = seqConfig.maxBatchingTime;

    if (seqConfig.reemitErrorEvents !== undefined)
      seqStreamParams.reemitErrorEvents = seqConfig.reemitErrorEvents;

    // NB: Define only one bunyan stream! Otherwise, we will get logging messages coming out multiple times, once for each stream. (https://github.com/trentm/node-bunyan/issues/334)
    // This one stream must accept messages at all levels. That is why we set it to "trace". That is just its lower limit.
    seqStreamParams.level = "trace";

    const bunyanLogger = bunyan.createLogger({
      name: loggerName,
      streams: [
        seq.createStream(seqStreamParams),
      ],
    });
    return bunyanLogger;
  }

  /** Check that the specified object is a valid SeqConfig. This is useful when reading a config from a .json file. */
  public static validateProps(seqConfig: any) {
    const validProps = ["hostURL", "port"];
    for (const prop of Object.keys(seqConfig)) {
      if (!validProps.includes(prop))
        throw new BentleyError(IModelStatus.BadArg, "unrecognized SeqConfig property: " + prop);
    }
  }
}
