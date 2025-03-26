/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcMultipart, WebAppRpcLogging, WebAppRpcRequest } from "@itwin/core-common";
import { appendToMultipartForm, createMultipartStream, parseMultipartRequest } from "./rpc/multipart.js";
import { initializeTracing } from "./rpc/tracing.js";
import { WebAppRpcLoggingBackend } from "./rpc/web/logging.js";
import { parseRequest } from "./rpc/web/request.js";
import { sendResponse } from "./rpc/web/response.js";

let initialized = false;
/** @internal */
export function initializeRpcBackend(enableOpenTelemetry: boolean = false) {
  if (initialized)
    return;

  initializeTracing(enableOpenTelemetry);

  RpcMultipart.platform.createStream = createMultipartStream;
  RpcMultipart.platform.parseRequest = parseMultipartRequest;
  RpcMultipart.platform.appendToForm = appendToMultipartForm;

  WebAppRpcRequest.backend.sendResponse = sendResponse;
  WebAppRpcRequest.backend.parseRequest = parseRequest;

  WebAppRpcLogging.initializeBackend(new WebAppRpcLoggingBackend());

  initialized = true;
}
