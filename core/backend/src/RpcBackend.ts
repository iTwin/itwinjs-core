/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcMultipart, WebAppRpcRequest } from "@itwin/core-common";
import { appendToMultipartForm, createMultipartStream, parseMultipartRequest } from "./rpc/multipart";
import { initializeTracing } from "./rpc/tracing";
import { parseRequest } from "./rpc/web/request";
import { sendResponse } from "./rpc/web/response";

export { RpcTrace } from "./rpc/tracing";

let initialized = false;
/** @internal */
export function initializeRpcBackend(enableOpenTelemetry: boolean = false) {
  if (initialized)
    return;

  initialized = true;

  initializeTracing(enableOpenTelemetry);

  RpcMultipart.backend.createStream = createMultipartStream;
  RpcMultipart.backend.parseRequest = parseMultipartRequest;
  RpcMultipart.backend.appendToForm = appendToMultipartForm;

  WebAppRpcRequest.backend.sendResponse = sendResponse;
  WebAppRpcRequest.backend.parseRequest = parseRequest;
}
