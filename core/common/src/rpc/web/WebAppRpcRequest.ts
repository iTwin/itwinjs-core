/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { Buffer } from "buffer";
import { IModelError, ServerError, ServerTimeoutError } from "../../IModelError";
import { RpcInterface } from "../../RpcInterface";
import { RpcContentType, RpcProtocolEvent, RpcRequestStatus, RpcResponseCacheControl, WEB_RPC_CONSTANTS } from "../core/RpcConstants";
import { SerializedRpcActivity } from "../core/RpcInvocation";
import { MarshalingBinaryMarker, RpcSerializedValue } from "../core/RpcMarshaling";
import { RpcProtocol, RpcRequestFulfillment, SerializedRpcOperation, SerializedRpcRequest } from "../core/RpcProtocol";
import { RpcRequest } from "../core/RpcRequest";
import { RpcMultipartParser } from "./multipart/RpcMultipartParser";
import { ReadableFormData, RpcMultipart } from "./RpcMultipart";
import { HttpServerRequest, HttpServerResponse, WebAppRpcProtocol } from "./WebAppRpcProtocol";

/** @internal */
export type HttpMethod_T = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace"; // eslint-disable-line @typescript-eslint/naming-convention

/** A web application RPC request.
 * @internal
 */
export class WebAppRpcRequest extends RpcRequest {
  private _loading: boolean = false;
  private _request: RequestInit = {};
  private _pathSuffix: string = "";
  private get _headers() { return this._request.headers as { [key: string]: string }; }

  /** The maximum size permitted for an encoded component in a URL.
   * Note that some backends limit the total cumulative request size. Our current node backends accept requests with a max size of 16 kb.
   * In addition to the url size, an authorization header may also add considerably to the request size.
   * @note This is used for features like encoding the payload of a cacheable request in the URL.
   */
  public static maxUrlComponentSize = 1024 * 8;

  /** The HTTP method for this request. */
  public override method: HttpMethod_T;

  /** Convenience access to the protocol of this request. */
  public override readonly protocol: WebAppRpcProtocol = this.client.configuration.protocol as any;

  /** Standardized access to metadata about the request (useful for purposes such as logging). */
  public metadata = { status: 0, message: "" };

  /** Parse headers */
  private static parseHeaders(protocol: WebAppRpcProtocol, req: HttpServerRequest): SerializedRpcActivity {
    const headerNames: SerializedRpcActivity = protocol.serializedClientRequestContextHeaderNames;
    const parsedHeaders: SerializedRpcActivity = {
      id: req.header(headerNames.id) || "",
      applicationId: req.header(headerNames.applicationId) || "",
      applicationVersion: req.header(headerNames.applicationVersion) || "",
      sessionId: req.header(headerNames.sessionId) || "",
      authorization: (headerNames.authorization ? req.header(headerNames.authorization) : "") ?? "",
    };
    return parsedHeaders;
  }

  /** Parses a request. */
  public static async parseRequest(protocol: WebAppRpcProtocol, req: HttpServerRequest): Promise<SerializedRpcRequest> {
    const operation = protocol.getOperationFromPath(req.url!);

    const parsedHeaders = this.parseHeaders(protocol, req);

    const request: SerializedRpcRequest = {
      ...parsedHeaders,
      operation: {
        interfaceDefinition: operation.interfaceDefinition,
        operationName: operation.operationName,
        interfaceVersion: operation.interfaceVersion,
      },
      method: req.method,
      path: req.url!,
      parameters: operation.encodedRequest ? WebAppRpcRequest.parseFromPath(operation) : await WebAppRpcRequest.parseFromBody(req),
      caching: operation.encodedRequest ? RpcResponseCacheControl.Immutable : RpcResponseCacheControl.None,
    };

    request.ip = req.ip;

    request.protocolVersion = 0;

    if (protocol.protocolVersionHeaderName) {
      const version = req.header(protocol.protocolVersionHeaderName);
      if (version) {
        request.protocolVersion = parseInt(version, 10);
      }
    }

    if (!request.id) {
      throw new IModelError(BentleyStatus.ERROR, `Invalid request: Missing required activity ID.`);
    }

    return request;
  }

  /** Sends the response for a web request. */
  public static async sendResponse(
    protocol: WebAppRpcProtocol,
    request: SerializedRpcRequest,
    fulfillment: RpcRequestFulfillment,
    req: HttpServerRequest,
    res: HttpServerResponse,
  ): Promise<void> {
    const versionHeader = protocol.protocolVersionHeaderName;
    if (versionHeader && RpcProtocol.protocolVersion) {
      res.set(versionHeader, RpcProtocol.protocolVersion.toString());
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Readable, Stream } = await import(/* webpackIgnore: true */ "stream");
    const { createGzip } = await import(/* webpackIgnore: true */ "zlib");

    const transportType = WebAppRpcRequest.computeTransportType(fulfillment.result, fulfillment.rawResult);
    let responseBody;
    if (transportType === RpcContentType.Binary) {
      responseBody = WebAppRpcRequest.configureBinary(fulfillment, res);
    } else if (transportType === RpcContentType.Multipart) {
      responseBody = WebAppRpcRequest.configureMultipart(fulfillment, res);
    } else if (transportType === RpcContentType.Stream) {
      responseBody = WebAppRpcRequest.configureStream(fulfillment);
    } else {
      responseBody = WebAppRpcRequest.configureText(fulfillment, res);
    }

    WebAppRpcRequest.configureResponse(protocol, request, fulfillment, res);
    res.status(fulfillment.status);

    if (fulfillment.allowCompression && req.header("Accept-Encoding")?.includes("gzip")) {
      res.set("Content-Encoding", "gzip");
      const readableResponseBody = (responseBody instanceof Stream) ? responseBody : Readable.from(responseBody);
      responseBody = readableResponseBody.pipe(createGzip());
    }

    // This check should in theory look for instances of Readable, but that would break backend implementation at
    // core/backend/src/RpcBackend.ts
    if (responseBody instanceof Stream) {
      responseBody.pipe(res);
    } else {
      res.send(responseBody);
    }
  }

  /** Determines the most efficient transport type for an RPC value. */
  protected static computeTransportType(value: RpcSerializedValue, source: any): RpcContentType {
    if (source instanceof Uint8Array || (Array.isArray(source) && source[0] instanceof Uint8Array)) {
      return RpcContentType.Binary;
    } else if (value.data.length > 0) {
      return RpcContentType.Multipart;
    } else if (value.stream) {
      return RpcContentType.Stream;
    } else {
      return RpcContentType.Text;
    }
  }

  /** Constructs a web application request. */
  public constructor(client: RpcInterface, operation: string, parameters: any[]) {
    super(client, operation, parameters);
    this.path = this.protocol.supplyPathForOperation(this.operation, this);
    this.method = "head";
    this._request.headers = {};
  }

  /** Sets request header values. */
  protected setHeader(name: string, value: string): void {
    this._headers[name] = value;
  }

  /** Sends the request. */
  protected async send(): Promise<number> {
    this._loading = true;
    await this.setupTransport();

    return new Promise<number>(async (resolve, reject) => {
      try {
        resolve(await this.performFetch());
      } catch (reason) {
        reject(new ServerError(-1, typeof (reason) === "string" ? reason : "Server connection error."));
      }
    });
  }

  protected override computeRetryAfter(attempts: number): number {
    const retryAfter = this._response && this._response.headers.get("Retry-After");
    if (retryAfter) {
      this.resetTransientFaultCount();

      const r = Number(retryAfter);
      if (Number.isFinite(r)) {
        return r * 1000;
      }

      const d = Date.parse(retryAfter);
      if (!Number.isNaN(d)) {
        return d - Date.now();
      }
    } else {
      this.recordTransientFault();
    }

    return super.computeRetryAfter(attempts);
  }

  protected override handleUnknownResponse(code: number) {
    if (this.protocol.isTimeout(code)) {
      this.reject(new ServerTimeoutError("Request timeout."));
    } else {
      this.reject(new ServerError(code, "Unknown server response code."));
    }
  }

  protected async load(): Promise<RpcSerializedValue> {
    return new Promise<RpcSerializedValue>(async (resolve, reject) => {
      try {
        if (!this._loading)
          return;

        const response = this._response;
        if (!response) {
          reject(new IModelError(BentleyStatus.ERROR, "Invalid state."));
          return;
        }

        if (this.protocol.protocolVersionHeaderName) {
          const version = response.headers.get(this.protocol.protocolVersionHeaderName);
          if (version) {
            this.responseProtocolVersion = parseInt(version, 10);
          }
        }

        const contentType = response.headers.get(WEB_RPC_CONSTANTS.CONTENT);
        const responseType = WebAppRpcProtocol.computeContentType(contentType);

        if (responseType === RpcContentType.Binary) {
          resolve(await this.loadBinary(response));
        } else if (responseType === RpcContentType.Multipart) {
          resolve(await this.loadMultipart(response, contentType!));
        } else {
          resolve(await this.loadText(response));
        }

        this._loading = false;
        this.setLastUpdatedTime();
        this.protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, this);
      } catch (reason) {
        if (!this._loading)
          return;

        this._loading = false;
        reject(new ServerError(this.metadata.status, typeof (reason) === "string" ? reason : "Unknown server response error."));
      }
    });
  }

  /** Override to supply an alternate fetch function. */
  protected supplyFetch(): typeof fetch {
    return fetch;
  }

  /** Override to supply an alternate Request function. */
  protected supplyRequest(): typeof Request {
    return Request;
  }

  private static configureResponse(protocol: WebAppRpcProtocol, request: SerializedRpcRequest, fulfillment: RpcRequestFulfillment, res: HttpServerResponse) {
    const success = protocol.getStatus(fulfillment.status) === RpcRequestStatus.Resolved;
    // TODO: Use stale-while-revalidate in cache headers. This needs to be tested, and does not currently have support in the router/caching-service.
    // This will allow browsers to use stale cached responses while also revalidating with the router, allowing us to start up a backend if necessary.

    // RPC Caching Service uses the s-maxage header to determine the TTL for the redis cache.
    const oneHourInSeconds = 3600;
    if (success && request.caching === RpcResponseCacheControl.Immutable) {
      // If response size is > 50 MB, do not cache it.
      if (fulfillment.result.objects.length > (50 * 10**7)) {
        res.set("Cache-Control", "no-store");
      } else if (request.operation.operationName === "generateTileContent") {
        res.set("Cache-Control", "no-store");
      } else if (request.operation.operationName === "getConnectionProps") {
        // GetConnectionprops can't be cached on the browser longer than the lifespan of the backend. The lifespan of backend may shrink too. Keep it at 1 second to be safe.
        res.set("Cache-Control", `s-maxage=${oneHourInSeconds * 24}, max-age=1, immutable`);
      } else if (request.operation.operationName === "getTileCacheContainerUrl") {
        // getTileCacheContainerUrl returns a SAS with an expiry of 23:59:59. We can't exceed that time when setting the max-age.
        res.set("Cache-Control", `s-maxage=${oneHourInSeconds * 23}, max-age=${oneHourInSeconds * 23}, immutable`);
      } else {
        res.set("Cache-Control", `s-maxage=${oneHourInSeconds * 24}, max-age=${oneHourInSeconds * 48}, immutable`);
      }
    }

    if (fulfillment.retry) {
      res.set("Retry-After", fulfillment.retry);
    }
  }

  private static configureText(fulfillment: RpcRequestFulfillment, res: HttpServerResponse): string {
    res.set(WEB_RPC_CONSTANTS.CONTENT, WEB_RPC_CONSTANTS.TEXT);
    return (fulfillment.status === 204) ? "" : fulfillment.result.objects;
  }

  private static configureBinary(fulfillment: RpcRequestFulfillment, res: HttpServerResponse): Buffer {
    res.set(WEB_RPC_CONSTANTS.CONTENT, WEB_RPC_CONSTANTS.BINARY);
    const data = fulfillment.result.data[0];
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }

  private static configureMultipart(fulfillment: RpcRequestFulfillment, res: HttpServerResponse): ReadableFormData {
    const response = RpcMultipart.createStream(fulfillment.result);
    const headers = response.getHeaders();
    for (const header in headers) {
      if (headers.hasOwnProperty(header)) {
        res.set(header, headers[header]);
      }
    }

    return response;
  }

  private static configureStream(fulfillment: RpcRequestFulfillment) {
    return fulfillment.result.stream!;
  }

  private static parseFromPath(operation: SerializedRpcOperation): RpcSerializedValue {
    const decoded = operation.encodedRequest ? Buffer.from(operation.encodedRequest, "base64").toString("binary") : "";
    return RpcSerializedValue.create(decoded);
  }

  private static async parseFromBody(req: HttpServerRequest): Promise<RpcSerializedValue> {
    const contentType = WebAppRpcProtocol.computeContentType(req.header(WEB_RPC_CONSTANTS.CONTENT));
    if (contentType === RpcContentType.Binary) {
      const objects = JSON.stringify([MarshalingBinaryMarker.createDefault()]);
      const data = [req.body as Buffer];
      return RpcSerializedValue.create(objects, data);
    } else if (contentType === RpcContentType.Multipart) {
      return RpcMultipart.parseRequest(req);
    } else {
      return RpcSerializedValue.create(req.body as string);
    }
  }

  private async performFetch(): Promise<number> {
    const requestClass = this.supplyRequest();
    const fetchFunction = this.supplyFetch();

    const path = new URL(this.path, typeof (location) !== "undefined" ? location.origin : undefined);
    if (this._pathSuffix) {
      const params = new URLSearchParams();
      params.set("parameters", this._pathSuffix);
      path.search = `?${params.toString()}`;
    }

    const request = new requestClass(path.toString(), this._request);
    const response = await fetchFunction(request);
    this._response = response;
    this.metadata.status = response.status;
    return response.status;
  }

  private async loadText(response: Response) {
    const value = await response.text();
    this.metadata.message = value;
    return RpcSerializedValue.create(value);
  }

  private async loadBinary(response: Response) {
    const value = new Uint8Array(await response.arrayBuffer());
    const objects = JSON.stringify(MarshalingBinaryMarker.createDefault());
    return RpcSerializedValue.create(objects, [value]);
  }

  private async loadMultipart(response: Response, contentType: string) {
    const data = await response.arrayBuffer();
    const value = new RpcMultipartParser(contentType, Buffer.from(data)).parse();
    return value;
  }

  private async setupTransport(): Promise<void> {
    const parameters = (await this.protocol.serialize(this)).parameters;
    const transportType = WebAppRpcRequest.computeTransportType(parameters, this.parameters);

    if (transportType === RpcContentType.Binary) {
      this.setupBinaryTransport(parameters);
    } else if (transportType === RpcContentType.Multipart) {
      this.setupMultipartTransport(parameters);
    } else {
      this.setupTextTransport(parameters);
    }
  }

  private setupBinaryTransport(parameters: RpcSerializedValue) {
    this._headers[WEB_RPC_CONSTANTS.CONTENT] = WEB_RPC_CONSTANTS.BINARY;
    this._request.method = "post";
    this._request.body = parameters.data[0];
  }

  private setupMultipartTransport(parameters: RpcSerializedValue) {
    // IMPORTANT: do not set a multipart Content-Type header value. The browser does this automatically!
    delete this._headers[WEB_RPC_CONSTANTS.CONTENT];
    this._request.method = "post";
    this._request.body = RpcMultipart.createForm(parameters);
  }

  private setupTextTransport(parameters: RpcSerializedValue) {
    if (this.operation.policy.allowResponseCaching(this)) {
      const encodedBody = btoa(parameters.objects); // eslint-disable-line deprecation/deprecation
      if (encodedBody.length <= WebAppRpcRequest.maxUrlComponentSize) {
        this._request.method = "get";
        this._request.body = undefined;
        delete this._headers[WEB_RPC_CONSTANTS.CONTENT];
        this._pathSuffix = encodedBody;
        return;
      }
    }

    this._pathSuffix = "";
    this._headers[WEB_RPC_CONSTANTS.CONTENT] = WEB_RPC_CONSTANTS.TEXT;
    this._request.method = "post";
    this._request.body = parameters.objects;
  }
}
