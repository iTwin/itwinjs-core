/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

import { Writable } from "stream";
import * as domain from "domain";

// tslint:disable-next-line:no-var-requires
const bunyan = require("bunyan");
// tslint:disable-next-line:no-var-requires
const post = require("request-promise");

export interface GenericPost {
    postasync(config: any, jsonbody: any): Promise<number>;
}

/** fluentd logging server configuration. */
export interface IFluentdConfig {
    /** The URL of the fluentd server to connect to. Defaults to localhost. */
    fluentdHost?: string;
    /** The port of the fluentd server. Defaults to 9880. */
    fluentdPort?: number;
    /** fluentd server request timeout. Defaults to 1500. */
    fluentdTimeout?: number;
    /** The URL of the seq server to send logs. Defaults to localhost. */
    seqServerUrl?: string;
    /** The port of the seq server. Defaults to 5341. */
    seqServerPort?: number;
    /** The API Key to use when sending logs to Seq */
    seqApiKey?: string;
}

export class PostFluentd implements GenericPost {
    private generateOptions(config: IFluentdConfig, jsonbody: any): any {
        const customHeaders: any = {};
        customHeaders["content-type"] = "application/json";
        customHeaders["seq-server"] = config.seqServerUrl;
        customHeaders["seq-apikey"] = config.seqApiKey;
        customHeaders["seq-port"] = config.seqServerPort;
        // TODO: Handle SEQ_PORT (on fluentd side as well) and use kabab case instead of snake case.
        return {
            uri: config.fluentdHost + ":" + config.fluentdPort + "/seqlogging",
            body: jsonbody,
            headers: JSON.parse(JSON.stringify(customHeaders)),
            resolveWithFullResponse: true,
            timeout: config.fluentdTimeout,
        };
    }
    public async postasync(config: any, jsonbody: any): Promise<number> {
        const response = await post(this.generateOptions(config, jsonbody));
        return response.statusCode || -1;
    }
}

export class FluentdLoggerStream extends Writable {
    private _fluentdParams: IFluentdConfig;
    constructor(fluentdParams: IFluentdConfig) {
        super();
        this._fluentdParams = fluentdParams;
    }

    private mapLevelToString(level: any): any {
        let response: string;
        switch (level) {
            case bunyan.TRACE: {
                response = "Trace";
                break;
            }
            case bunyan.DEBUG: {
                response = "Debug";
                break;
            }
            case bunyan.INFO: {
                response = "Information";
                break;
            }
            case bunyan.WARN: {
                response = "Warning";
                break;
            }
            case bunyan.ERROR: {
                response = "Error";
                break;
            }
            case bunyan.FATAL: {
                response = "Fatal";
                break;
            }
            default: {
                response = "Information";
            }
        }
        return response;
    }

    // tslint:disable-next-line:naming-convention
    public _writev(chunks: Array<{ chunk: any, encoding: string }>, callback: (err?: Error) => void): void {
        for (const entry of chunks) {
            this._write(entry.chunk, entry.encoding, callback);
        }
    }

    // tslint:disable-next-line:naming-convention
    public _write(chunk: any, encoding: string, callback: (err?: Error) => void): void {
        // we create a domain to catch errors from the socket. Major errors like CONNECTION not made is sent to bunyan
        const fluentdDomain: domain.Domain = domain.create();
        fluentdDomain.on("error", (errEvent: Error) => {
            this.emit("error", new Error(`Fluentd domain error -- , ${errEvent.message}`));
            callback(errEvent);
        });

        fluentdDomain.run(() => {
            // generate a valid json as body
            let packet: any;
            try {
                packet = JSON.parse(chunk);
                if (packet.hasOwnProperty("level")) {
                    packet.level = this.mapLevelToString(chunk.level);
                }
                packet = JSON.stringify(packet);
            } catch (error) {
                this.emit("error", new Error(`Error: ${error}, Encoding: ${encoding}`));
                packet = JSON.stringify(chunk);
            }

            // Post to fluentd -- async
            const poster = new PostFluentd();
            Promise.resolve(poster.postasync(this._fluentdParams, packet))
                .then((res) => { if (res === -1 || res !== 200) { throw new Error("invalid response from fluentd"); } })
                .catch((err) => { this.emit("error", new Error(`Fluentd post error --  ${err.message}`)); });
            callback();
        });
    }
}
