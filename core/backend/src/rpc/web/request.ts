/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import {
  BentleyStatus,
  HttpServerRequest,
  IModelError,
  MarshalingBinaryMarker,
  RpcContentType,
  RpcMultipart,
  RpcResponseCacheControl,
  RpcSerializedValue,
  SerializedRpcActivity,
  SerializedRpcOperation,
  SerializedRpcRequest,
  WEB_RPC_CONSTANTS,
  WebAppRpcProtocol,
} from "@itwin/core-common";

/* eslint-disable deprecation/deprecation */

function parseHeaders(protocol: WebAppRpcProtocol, req: HttpServerRequest): SerializedRpcActivity {
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

function parseFromPath(operation: SerializedRpcOperation): RpcSerializedValue {
  const decoded = operation.encodedRequest ? Buffer.from(operation.encodedRequest, "base64").toString("binary") : "";
  return RpcSerializedValue.create(decoded);
}

async function parseFromBody(req: HttpServerRequest): Promise<RpcSerializedValue> {
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

/** @internal @deprecated */
export async function parseRequest(protocol: WebAppRpcProtocol, req: HttpServerRequest): Promise<SerializedRpcRequest> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const operation = protocol.getOperationFromPath(req.url!);

  const parsedHeaders = parseHeaders(protocol, req);

  const request: SerializedRpcRequest = {
    ...parsedHeaders,
    operation: {
      interfaceDefinition: operation.interfaceDefinition,
      operationName: operation.operationName,
      interfaceVersion: operation.interfaceVersion,
    },
    method: req.method,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    path: req.url!,
    parameters: operation.encodedRequest ? parseFromPath(operation) : await parseFromBody(req),
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
