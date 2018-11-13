/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

// tslint:disable-next-line:no-var-requires
const bunyan = require("bunyan");
import { FluentdLoggerStream, IFluentdConfig } from "./FluentdLoggerStream";
import { BentleyError, IModelStatus } from "./BentleyError";

/** Helps to configure the bentleyjs-core Logger to use fluentd and seq.
 * Note: The app must depend on the bunyan, request and request-promise packages.
 */
export class FluentdBunyanLoggerConfig {
    /** Create a bunyan logger that streams to fluentd
     * ```
     * BunyanLoggerConfig.logToBunyan(FluentdBunyanLoggerConfig.createBunyanFluentdLogger(fluentdConfig));
     * ```
     * See [[BunyanLoggerConfig.logToBunyan]]
     */
    public static createBunyanFluentdLogger(fluentdConfig: IFluentdConfig, loggerName: string): any {
        if (fluentdConfig === undefined) {
            fluentdConfig = {};
        }
        const params: IFluentdConfig = {};
        params.fluentdHost = (fluentdConfig.fluentdHost || "http://localhost");
        params.fluentdPort = (fluentdConfig.fluentdPort || 9880);
        params.fluentdTimeout = (fluentdConfig.fluentdTimeout || 1500);
        params.seqServerUrl = (fluentdConfig.seqServerUrl || "http://localhost");
        params.seqServerPort = (fluentdConfig.seqServerPort || 5341);
        params.seqApiKey = (fluentdConfig.seqApiKey || "InvalidApiKey");

        // nb: Define only one bunyan stream! Otherwise, we will get logging messages coming out multiple times, once for each stream. (https://github.com/trentm/node-bunyan/issues/334)
        // this one stream must accept messages at all levels. That is why we set it to "trace". That is just its lower limit.
        // const tracelevel: any = "trace";

        return bunyan.createLogger({
            name: loggerName,
            streams: [
                { stream: new FluentdLoggerStream(params), level: 10 },
            ],
        });
    }

    /** Check that the specified object is a valid SeqConfig. This is useful when reading a config from a .json file. */
    public static validateProps(fluentdConfig: any): void {
        const validProps: string[] = ["host", "port"];
        for (const prop of Object.keys(fluentdConfig)) {
            if (!validProps.includes(prop)) {
                throw new BentleyError(IModelStatus.BadArg, "unrecognized fluentdConfig property: " + prop);
            }
        }
    }
}
