/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iTwinServiceClients
 */
import * as _ from "lodash";
import * as https from "https";
import * as sarequest from "superagent";
import { BentleyError, GetMetaDataFunction, HttpStatus, Logger, LogLevel } from "@itwin/core-bentley";

const loggerCategory: string = "core-mobile-backend.Request";

/** @internal */
export const requestIdHeaderName = "X-Correlation-Id";

/** @internal */
export interface RequestQueryStringifyOptions {
  delimiter?: string;
  encode?: boolean;
}

/** Option to control the time outs
 * Use a short response timeout to detect unresponsive networks quickly, and a long deadline to give time for downloads on slow,
 * but reliable, networks. Note that both of these timers limit how long uploads of attached files are allowed to take. Use long
 * timeouts if you're uploading files.
 * @internal
 */
export interface RequestTimeoutOptions {
  /** Sets a deadline (in milliseconds) for the entire request (including all uploads, redirects, server processing time) to complete.
   * If the response isn't fully downloaded within that time, the request will be aborted
   */
  deadline?: number;

  /** Sets maximum time (in milliseconds) to wait for the first byte to arrive from the server, but it does not limit how long the entire
   * download can take. Response timeout should be at least few seconds longer than just the time it takes the server to respond, because
   * it also includes time to make DNS lookup, TCP/IP and TLS connections, and time to upload request data.
   */
  response?: number;
}

/** @internal */
export interface RequestOptions {
  method: string;
  headers?: any; // {Mas-App-Guid, Mas-UUid, User-Agent}
  body?: any;
  responseType?: string;
  timeout?: RequestTimeoutOptions; // Optional timeouts. If unspecified, an arbitrary default is setup.
  stream?: any; // Optional stream to read the response to/from (only for NodeJs applications)
  readStream?: any; // Optional stream to read input from (only for NodeJs applications)
  buffer?: any;
  parser?: any;
  accept?: string;
  redirects?: number;
  errorCallback?: (response: any) => ResponseError;
  retryCallback?: (error: any, response: any) => boolean;
  progressCallback?: ProgressCallback;
  agent?: https.Agent;
  retries?: number;
  useCorsProxy?: boolean;
}

/** Response object if the request was successful. Note that the status within the range of 200-299 are considered as a success.
 * @internal
 */
export interface Response {
  body: any; // Parsed body of response
  text: string | undefined; // Returned for responseType:text
  header: any; // Parsed headers of response
  status: number; // Status code of response
}

/** @internal */
export interface ProgressInfo {
  percent?: number;
  total?: number;
  loaded: number;
}

/** @internal */
export type ProgressCallback = (progress: ProgressInfo) => void;

/** Error object that's thrown/rejected if the Request fails due to a network error, or if the status is *not* in the range of 200-299 (inclusive)
 * @internal
 */
export class ResponseError extends BentleyError {
  protected _data?: any;
  public status?: number;
  public description?: string;
  public constructor(errorNumber: number | HttpStatus, message?: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
  }

  /**
   * Parses error from server's response
   * @param response Http response from the server.
   * @returns Parsed error.
   * @internal
   */
  public static parse(response: any, log = true): ResponseError {
    const error = new ResponseError(ResponseError.parseHttpStatus(response.statusType));
    if (!response) {
      error.message = "Couldn't get response object.";
      return error;
    }

    if (response.response) {
      if (response.response.error) {
        error.name = response.response.error.name || error.name;
        error.description = response.response.error.message;
      }
      if (response.response.res) {
        error.message = response.response.res.statusMessage;
      }
      if (response.response.body && Object.keys(response.response.body).length > 0) {
        error._data = {};
        _.merge(error._data, response.response.body);
      } else {
        error._data = response.response.text;
      }
    }

    error.status = response.status || response.statusCode;
    error.name = response.code || response.name || error.name;
    error.message = error.message || response.message || response.statusMessage;

    if (log)
      error.log();

    return error;
  }

  /**
   * Decides whether request should be retried or not
   * @param error Error returned by request
   * @param response Response returned by request
   * @internal
   */
  public static shouldRetry(error: any, response: any): boolean {
    if (error !== undefined && error !== null) {
      if ((error.status === undefined || error.status === null) && (error.res === undefined || error.res === null)) {
        return true;
      }
    }
    return (response !== undefined && response.statusType === HttpStatus.ServerError);
  }

  /**
   * @internal
   */
  public static parseHttpStatus(statusType: number): HttpStatus {
    switch (statusType) {
      case 1:
        return HttpStatus.Info;
      case 2:
        return HttpStatus.Success;
      case 3:
        return HttpStatus.Redirection;
      case 4:
        return HttpStatus.ClientError;
      case 5:
        return HttpStatus.ServerError;
      default:
        return HttpStatus.Success;
    }
  }

  /**
   * @internal
   */
  public logMessage(): string {
    return `${this.status} ${this.name}: ${this.message}`;
  }

  /**
   * Logs this error
   * @internal
   */
  public log(): void {
    Logger.logError(loggerCategory, this.logMessage(), () => this.getMetaData());
  }
}

const logResponse = (req: sarequest.SuperAgentRequest, startTime: number) => (res: sarequest.Response) => {
  const elapsed = new Date().getTime() - startTime;
  const elapsedTime = `${elapsed}ms`;
  Logger.logTrace(loggerCategory, `${req.method.toUpperCase()} ${res.status} ${req.url} (${elapsedTime})`);
};

const logRequest = (req: sarequest.SuperAgentRequest): sarequest.SuperAgentRequest => {
  const startTime = new Date().getTime();
  return req.on("response", logResponse(req, startTime));
};

/** Wrapper around making HTTP requests with the specific options.
 *
 * Usable in both a browser and node based environment.
 *
 * @param url Server URL to address the request
 * @param options Options to pass to the request
 * @returns Resolves to the response from the server
 * @throws ResponseError if the request fails due to network issues, or if the returned status is *outside* the range of 200-299 (inclusive)
 * @internal
 */
export async function request(url: string, options: RequestOptions): Promise<Response> {
  let sareq: sarequest.SuperAgentRequest = sarequest(options.method, url);
  if (options.retries)
    sareq = sareq.retry(options.retries, options.retryCallback);

  if (Logger.isEnabled(loggerCategory, LogLevel.Trace))
    sareq = sareq.use(logRequest);

  if (options.headers)
    sareq = sareq.set(options.headers);

  Logger.logInfo(loggerCategory, url);

  if (options.accept)
    sareq = sareq.accept(options.accept);

  if (options.body)
    sareq = sareq.send(options.body);

  if (options.timeout)
    sareq = sareq.timeout(options.timeout);

  if (options.responseType)
    sareq = sareq.responseType(options.responseType);

  if (options.redirects)
    sareq = sareq.redirects(options.redirects);
  else
    sareq = sareq.redirects(0);

  if (options.buffer)
    sareq = sareq.buffer(options.buffer);

  if (options.parser)
    sareq = sareq.parse(options.parser);

  /** Default to any globally supplied proxy, unless an agent is specified in this call */
  if (options.agent)
    sareq = sareq.agent(options.agent);

  if (options.progressCallback) {
    sareq = sareq.on("progress", (event: sarequest.ProgressEvent) => {
      if (event) {
        options.progressCallback!({
          loaded: event.loaded,
          total: event.total,
          percent: event.percent,
        });
      }
    });
  }

  const errorCallback = options.errorCallback ? options.errorCallback : (response: any) => ResponseError.parse(response);

  if (options.readStream) {
    if (typeof window !== "undefined")
      throw new Error("This option is not supported on browsers");

    return new Promise<Response>((resolve, reject) => {
      sareq = sareq.type("blob");
      options
        .readStream
        .pipe(sareq)
        .on("error", (error: any) => {
          const parsedError = errorCallback(error);
          reject(parsedError);
        })
        .on("end", () => {
          const retResponse: Response = {
            status: 201,
            header: undefined,
            body: undefined,
            text: undefined,
          };
          resolve(retResponse);
        });
    });
  }

  if (options.stream) {
    if (typeof window !== "undefined")
      throw new Error("This option is not supported on browsers");

    return new Promise<Response>((resolve, reject) => {
      sareq
        .on("response", (res: any) => {
          if (res.statusCode !== 200) {
            const parsedError = errorCallback(res);
            reject(parsedError);
            return;
          }
        })
        .pipe(options.stream)
        .on("error", (error: any) => {
          const parsedError = errorCallback(error);
          reject(parsedError);
        })
        .on("finish", () => {
          const retResponse: Response = {
            status: 200,
            header: undefined,
            body: undefined,
            text: undefined,
          };
          resolve(retResponse);
        });
    });
  }

  // console.log("%s %s %s", url, options.method, queryStr);

  /**
  * Note:
  * Javascript's fetch returns status.OK if error is between 200-299 inclusive, and doesn't reject in this case.
  * Fetch only rejects if there's some network issue (permissions issue or similar)
  * Superagent rejects network issues, and errors outside the range of 200-299. We are currently using
  * superagent, but may eventually switch to JavaScript's fetch library.
  */
  try {
    const response = await sareq;
    const retResponse: Response = {
      body: response.body,
      text: response.text,
      header: response.header,
      status: response.status,
    };
    return retResponse;
  } catch (error) {
    const parsedError = errorCallback(error);
    throw parsedError;
  }
}

/**
 * fetch json from HTTP request
 * @param url server URL to address the request
 * @internal
 */
export async function getJson(url: string): Promise<any> {
  const options: RequestOptions = {
    method: "GET",
    responseType: "json",
  };
  const data = await request(url, options);
  return data.body;
}
