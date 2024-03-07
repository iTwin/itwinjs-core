/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger } from "@itwin/core-bentley";
import {
  CommonLoggerCategory,
  HttpServerRequest,
  HttpServerResponse,
  ReadableFormData,
  RpcContentType,
  RpcMultipart,
  RpcProtocol,
  RpcRequestFulfillment,
  RpcRequestStatus,
  RpcResponseCacheControl,
  SerializedRpcRequest,
  WEB_RPC_CONSTANTS,
  WebAppRpcProtocol,
  WebAppRpcRequest,
} from "@itwin/core-common";

/* eslint-disable deprecation/deprecation */

function configureResponse(protocol: WebAppRpcProtocol, request: SerializedRpcRequest, fulfillment: RpcRequestFulfillment, res: HttpServerResponse) {
  const success = protocol.getStatus(fulfillment.status) === RpcRequestStatus.Resolved;
  // TODO: Use stale-while-revalidate in cache headers. This needs to be tested, and does not currently have support in the router/caching-service.
  // This will allow browsers to use stale cached responses while also revalidating with the router, allowing us to start up a backend if necessary.

  // RPC Caching Service uses the s-maxage header to determine the TTL for the redis cache.
  const oneHourInSeconds = 3600;
  if (success && request.caching === RpcResponseCacheControl.Immutable) {
    // If response size is > 50 MB, do not cache it.
    if (fulfillment.result.objects.length > (50 * 10 ** 7)) {
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

function configureText(fulfillment: RpcRequestFulfillment, res: HttpServerResponse): string {
  res.set(WEB_RPC_CONSTANTS.CONTENT, WEB_RPC_CONSTANTS.TEXT);
  return (fulfillment.status === 204) ? "" : fulfillment.result.objects;
}

function configureBinary(fulfillment: RpcRequestFulfillment, res: HttpServerResponse): Buffer {
  res.set(WEB_RPC_CONSTANTS.CONTENT, WEB_RPC_CONSTANTS.BINARY);
  const data = fulfillment.result.data[0];
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

function configureMultipart(fulfillment: RpcRequestFulfillment, res: HttpServerResponse): ReadableFormData {
  const response = RpcMultipart.createStream(fulfillment.result);
  const headers = response.getHeaders();
  for (const header in headers) {
    if (headers.hasOwnProperty(header)) {
      res.set(header, headers[header]);
    }
  }

  return response;
}

function configureStream(fulfillment: RpcRequestFulfillment) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return fulfillment.result.stream!;
}

/** @internal */
export async function sendResponse(protocol: WebAppRpcProtocol, request: SerializedRpcRequest, fulfillment: RpcRequestFulfillment, req: HttpServerRequest, res: HttpServerResponse) {
  logResponse(request, fulfillment.status, fulfillment.rawResult);

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
    responseBody = configureBinary(fulfillment, res);
  } else if (transportType === RpcContentType.Multipart) {
    responseBody = configureMultipart(fulfillment, res);
  } else if (transportType === RpcContentType.Stream) {
    responseBody = configureStream(fulfillment);
  } else {
    responseBody = configureText(fulfillment, res);
  }

  configureResponse(protocol, request, fulfillment, res);
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

function logResponse(request: SerializedRpcRequest, statusCode: number, resultObj: unknown) {
  const metadata = {
    ActivityId: request.id, // eslint-disable-line @typescript-eslint/naming-convention
    method: request.method,
    path: request.path,
    operation: request.operation,
    statusCode,
    error: resultObj instanceof Error ? resultObj : undefined,
  };

  if (statusCode < 400)
    Logger.logInfo(CommonLoggerCategory.RpcInterfaceBackend, "RPC over HTTP success response", metadata);
  else
    Logger.logError(CommonLoggerCategory.RpcInterfaceBackend, "RPC over HTTP failure response", metadata);
}
