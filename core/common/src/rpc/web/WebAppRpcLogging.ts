/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcRequest } from "../core/RpcRequest";
import { RpcProtocolEvent, SerializedRpcRequest } from "../core/RpcProtocol";
import { RpcInvocation } from "../core/RpcInvocation";
import { WebAppRpcRequest } from "./WebAppRpcRequest";
import { Logger } from "@bentley/bentleyjs-core";
import { ServerError } from "../../IModelError";
import { RpcInterfaceDefinition } from "../../RpcInterface";

const loggingCategory = "imodeljs-rpc.WebAppRpcProtocol";

// tslint:disable-next-line:no-var-requires
const os = (typeof (process) !== "undefined") ? require("os") : undefined;
function getHostname(): string {
  if (os !== undefined) {
    return os.hostname();
  } else {
    if (typeof (window) !== "undefined") {
      return window.location.host;
    } else {
      return "imodeljs-mobile";
    }
  }
}

/** @hidden */
export class WebAppRpcLogging {
  public static logProtocolEvent(event: RpcProtocolEvent, object: RpcRequest | RpcInvocation): void {
    if (object instanceof WebAppRpcRequest) {
      switch (event) {
        case RpcProtocolEvent.RequestCreated: return WebAppRpcLogging.logRequest("RpcInterface.frontend.request", object);
        case RpcProtocolEvent.ResponseLoaded: return WebAppRpcLogging.logResponse("RpcInterface.frontend.response", object, object.getResponseStatusCode(), object.elapsed);
        case RpcProtocolEvent.ConnectionErrorReceived: return WebAppRpcLogging.logErrorFrontend("RpcInterface.frontend.connectionError", object);
        case RpcProtocolEvent.ConnectionAborted: return WebAppRpcLogging.logErrorFrontend("RpcInterface.frontend.connectionAborted", object);
      }
    } else if (object instanceof RpcInvocation) {
      switch (event) {
        case RpcProtocolEvent.RequestReceived: return WebAppRpcLogging.logRequest("RpcInterface.backend.request", object.request);
        case RpcProtocolEvent.BackendErrorOccurred: return WebAppRpcLogging.logErrorBackend("RpcInterface.backend.error", object);
        case RpcProtocolEvent.BackendResponseCreated: return WebAppRpcLogging.logResponse("RpcInterface.backend.response", object.request, object.status, object.elapsed);
      }
    }
  }

  public static supplyError(event: RpcProtocolEvent, request: RpcRequest): Error {
    switch (event) {
      case RpcProtocolEvent.BackendErrorReceived: return new ServerError(request.getResponseStatusCode(), request.getResponseText());
      case RpcProtocolEvent.ConnectionErrorReceived: return new ServerError(-1, "Connection error.");
      case RpcProtocolEvent.ConnectionAborted: return new ServerError(-1, "Connection aborted.");
      default: return new ServerError(request.getResponseStatusCode(), "Unhandled response.");
    }
  }

  private static getRpcInterfaceName(g: string | RpcInterfaceDefinition): string {
    return (typeof g === "string") ? g : g.name;
  }

  public static logRequest(message: string, object: WebAppRpcRequest | SerializedRpcRequest): void {
    Logger.logTrace(loggingCategory, message, () => ({
      method: object.method,
      path: object.path,
      operation: object.operation.operationName,
      rpcInterface: WebAppRpcLogging.getRpcInterfaceName(object.operation.interfaceDefinition),
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: object.id,
      TimeElapsed: ("elapsed" in object) ? object.elapsed : 0,
      MachineName: getHostname(),
    }));
  }

  private static logResponse(message: string, object: WebAppRpcRequest | SerializedRpcRequest, status: number, elapsed: number): void {
    Logger.logTrace(loggingCategory, message, () => ({
      method: object.method,
      path: object.path,
      operation: object.operation.operationName,
      rpcInterface: WebAppRpcLogging.getRpcInterfaceName(object.operation.interfaceDefinition),
      status,
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: object.id,
      TimeElapsed: elapsed,
      MachineName: getHostname(),
    }));
  }

  private static logErrorFrontend(message: string, request: WebAppRpcRequest): void {
    Logger.logInfo(loggingCategory, message, () => ({
      method: request.method,
      path: request.path,
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: request.id,
      MachineName: getHostname(),
    }));
  }

  private static logErrorBackend(message: string, invocation: RpcInvocation): void {
    Logger.logInfo(loggingCategory, message, () => ({
      method: invocation.request.method,
      path: invocation.request.path,
      status: invocation.status,
      error: invocation.result,
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: invocation.request.id,
      MachineName: getHostname(),
    }));
  }
}
