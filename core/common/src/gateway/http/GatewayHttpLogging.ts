/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayRequest } from "../core/GatewayRequest";
import { GatewayProtocolEvent, SerializedGatewayRequest } from "../core/GatewayProtocol";
import { GatewayInvocation } from "../core/GatewayInvocation";
import { GatewayHttpRequest } from "./GatewayHttpRequest";
import { Logger } from "@bentley/bentleyjs-core";
import { ServerError } from "../../IModelError";
import { GatewayDefinition } from "../../Gateway";

const loggingCategory = "imodeljs-gateway.GatewayHttpProtocol";

/** @hidden @internal */
export class GatewayHttpLogging {
  public static logProtocolEvent(event: GatewayProtocolEvent, object: GatewayRequest | GatewayInvocation): void {
    if (object instanceof GatewayHttpRequest) {
      switch (event) {
        case GatewayProtocolEvent.RequestCreated: return GatewayHttpLogging.logRequest("Gateway.frontend.request", object);
        case GatewayProtocolEvent.ResponseLoaded: return GatewayHttpLogging.logResponse("Gateway.frontend.response", object, object.getResponseStatusCode());
        case GatewayProtocolEvent.ConnectionErrorReceived: return GatewayHttpLogging.logErrorFrontend("Gateway.frontend.connectionError", object);
        case GatewayProtocolEvent.ConnectionAborted: return GatewayHttpLogging.logErrorFrontend("Gateway.frontend.connectionAborted", object);
      }
    } else if (object instanceof GatewayInvocation) {
      switch (event) {
        case GatewayProtocolEvent.RequestReceived: return GatewayHttpLogging.logRequest("Gateway.backend.request", object.request);
        case GatewayProtocolEvent.BackendErrorOccurred: return GatewayHttpLogging.logErrorBackend("Gateway.backend.error", object);
        case GatewayProtocolEvent.BackendResponseCreated: return GatewayHttpLogging.logResponse("Gateway.backend.response", object.request, object.status);
      }
    }
  }

  public static supplyError(event: GatewayProtocolEvent, request: GatewayRequest): Error {
    switch (event) {
      case GatewayProtocolEvent.BackendErrorReceived: return new ServerError(request.getResponseStatusCode(), request.getResponseText());
      case GatewayProtocolEvent.ConnectionErrorReceived: return new ServerError(-1, "Connection error.");
      case GatewayProtocolEvent.ConnectionAborted: return new ServerError(-1, "Connection aborted.");
      default: return new ServerError(request.getResponseStatusCode(), "Unhandled response.");
    }
  }

  private static getGatewayName(g: string | GatewayDefinition): string {
    return (typeof g === "string") ? g : g.name;
  }

  public static logRequest(message: string, object: GatewayHttpRequest | SerializedGatewayRequest): void {
    Logger.logTrace(loggingCategory, message, () => ({ method: object.method, path: object.path, operation: object.operation.name, gateway: GatewayHttpLogging.getGatewayName(object.operation.gateway) }));
  }

  private static logResponse(message: string, object: GatewayHttpRequest | SerializedGatewayRequest, status: number): void {
    Logger.logTrace(loggingCategory, message, () => ({ method: object.method, path: object.path, operation: object.operation.name, gateway: GatewayHttpLogging.getGatewayName(object.operation.gateway), status }));
  }

  private static logErrorFrontend(message: string, request: GatewayHttpRequest): void {
    Logger.logInfo(loggingCategory, message, () => ({ method: request.method, path: request.path }));
  }

  private static logErrorBackend(message: string, invocation: GatewayInvocation): void {
    Logger.logInfo(loggingCategory, message, () => ({ method: invocation.request.method, path: invocation.request.path, status: invocation.status, error: invocation.result }));
  }
}
