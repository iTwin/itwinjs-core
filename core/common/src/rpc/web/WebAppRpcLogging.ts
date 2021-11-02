/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Logger } from "@itwin/core-bentley";
import { CommonLoggerCategory } from "../../CommonLoggerCategory";
import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcProtocolEvent } from "../core/RpcConstants";
import { RpcInvocation } from "../core/RpcInvocation";
import { RpcOperation } from "../core/RpcOperation";
import { SerializedRpcOperation, SerializedRpcRequest } from "../core/RpcProtocol";
import { RpcRequest } from "../core/RpcRequest";
import { WebAppRpcRequest } from "./WebAppRpcRequest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
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

/** @internal */
export class WebAppRpcLogging {
  public static async logProtocolEvent(event: RpcProtocolEvent, object: RpcRequest | RpcInvocation): Promise<void> {
    if (object instanceof WebAppRpcRequest) {
      switch (event) {
        case RpcProtocolEvent.RequestCreated: return WebAppRpcLogging.logRequest(CommonLoggerCategory.RpcInterfaceFrontend, "RpcInterface.frontend.request", object);
        case RpcProtocolEvent.ResponseLoaded: return WebAppRpcLogging.logResponse(CommonLoggerCategory.RpcInterfaceFrontend, "RpcInterface.frontend.response", object, object.metadata.status, object.elapsed);
        case RpcProtocolEvent.ConnectionErrorReceived: return WebAppRpcLogging.logErrorFrontend("RpcInterface.frontend.connectionError", object);
        case RpcProtocolEvent.ConnectionAborted: return WebAppRpcLogging.logErrorFrontend("RpcInterface.frontend.connectionAborted", object);
      }
    } else if (object instanceof RpcInvocation) {
      switch (event) {
        case RpcProtocolEvent.RequestReceived: return WebAppRpcLogging.logRequest(CommonLoggerCategory.RpcInterfaceBackend, "RpcInterface.backend.request", object.request);
        case RpcProtocolEvent.BackendErrorOccurred: return WebAppRpcLogging.logErrorBackend("RpcInterface.backend.error", object);
        case RpcProtocolEvent.BackendResponseCreated: return WebAppRpcLogging.logResponse(CommonLoggerCategory.RpcInterfaceBackend, "RpcInterface.backend.response", object.request, object.status, object.elapsed);
      }
    }
  }

  private static getRpcInterfaceName(g: string | RpcInterfaceDefinition): string {
    return (typeof g === "string") ? g : g.interfaceName;
  }

  private static findPathIds(path: string) {
    let iTwinId = "";
    let iModelId = "";

    const tokens = path.split("/");
    for (let i = 0; i !== tokens.length; ++i) {
      // For backwards compatibility, find old "context" or current "iTwin" terminology
      if ((/^context$/i).test(tokens[i]) || (/^itwin$/i).test(tokens[i])) {
        iTwinId = tokens[i + 1] || "";
      }

      if ((/^imodel$/i).test(tokens[i])) {
        iModelId = tokens[i + 1] || "";
      }
    }

    return { iTwinId, iModelId };
  }

  private static buildOperationDescriptor(operation: RpcOperation | SerializedRpcOperation): string {
    if (!operation) {
      return "unknown.unknown";
    }

    const interfaceName = typeof (operation.interfaceDefinition) === "string" ? operation.interfaceDefinition : operation.interfaceDefinition.interfaceName;
    const operationName = operation.operationName;
    return `${interfaceName}.${operationName}`;
  }

  private static logRequest(loggerCategory: string, message: string, object: WebAppRpcRequest | SerializedRpcRequest): void {
    const operationDescriptor = WebAppRpcLogging.buildOperationDescriptor(object.operation);
    const pathIds = WebAppRpcLogging.findPathIds(object.path);

    Logger.logTrace(loggerCategory, `${message}.${operationDescriptor}`, () => ({
      method: object.method,
      path: object.path,
      operation: object.operation.operationName,
      rpcInterface: WebAppRpcLogging.getRpcInterfaceName(object.operation.interfaceDefinition),
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: object.id, // eslint-disable-line @typescript-eslint/naming-convention
      TimeElapsed: ("elapsed" in object) ? object.elapsed : 0, // eslint-disable-line @typescript-eslint/naming-convention
      MachineName: getHostname(), // eslint-disable-line @typescript-eslint/naming-convention
      ...pathIds,
    }));
  }

  private static logResponse(loggerCategory: string, message: string, object: WebAppRpcRequest | SerializedRpcRequest, status: number, elapsed: number): void {
    const operationDescriptor = WebAppRpcLogging.buildOperationDescriptor(object.operation);
    const pathIds = WebAppRpcLogging.findPathIds(object.path);

    Logger.logTrace(loggerCategory, `${message}.${operationDescriptor}`, () => ({
      method: object.method,
      path: object.path,
      operation: object.operation.operationName,
      rpcInterface: WebAppRpcLogging.getRpcInterfaceName(object.operation.interfaceDefinition),
      status,
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: object.id, // eslint-disable-line @typescript-eslint/naming-convention
      TimeElapsed: elapsed, // eslint-disable-line @typescript-eslint/naming-convention
      MachineName: getHostname(), // eslint-disable-line @typescript-eslint/naming-convention
      ...pathIds,
    }));
  }

  private static logErrorFrontend(message: string, request: WebAppRpcRequest): void {
    const operationDescriptor = WebAppRpcLogging.buildOperationDescriptor(request.operation);
    const pathIds = WebAppRpcLogging.findPathIds(request.path);

    Logger.logInfo(CommonLoggerCategory.RpcInterfaceFrontend, `${message}.${operationDescriptor}`, () => ({
      method: request.method,
      path: request.path,
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: request.id, // eslint-disable-line @typescript-eslint/naming-convention
      MachineName: getHostname(), // eslint-disable-line @typescript-eslint/naming-convention
      ...pathIds,
    }));
  }

  private static async logErrorBackend(message: string, invocation: RpcInvocation): Promise<void> {
    const operationDescriptor = WebAppRpcLogging.buildOperationDescriptor(invocation.operation);
    const pathIds = WebAppRpcLogging.findPathIds(invocation.request.path);
    const result = await invocation.result;
    const errorMessage = result.message ? result.message : result.objects; // Can be an error or an RpcSerializedValue

    Logger.logInfo(CommonLoggerCategory.RpcInterfaceBackend, `${message}.${operationDescriptor}`, () => ({
      method: invocation.request.method,
      path: invocation.request.path,
      status: invocation.status,
      errorMessage,
      // Alert! The following properties are required by Bentley DevOps standards. Do not change their names!
      ActivityId: invocation.request.id, // eslint-disable-line @typescript-eslint/naming-convention
      MachineName: getHostname(), // eslint-disable-line @typescript-eslint/naming-convention
      ...pathIds,
    }));
  }
}
