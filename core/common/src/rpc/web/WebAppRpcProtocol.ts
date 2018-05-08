/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcOperation } from "../core/RpcOperation";
import { RpcRequest, RpcRequestStatus } from "../core/RpcRequest";
import { RpcProtocol, RpcProtocolEvent } from "../core/RpcProtocol";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { RpcInvocation } from "../core/RpcInvocation";
import { WebAppRpcRequest } from "./WebAppRpcRequest";
import { OpenAPIInfo, OpenAPIParameter, RpcOpenAPIDescription } from "./OpenAPI";
import { WebAppRpcLogging } from "./WebAppRpcLogging";

/** An http server request object. */
export interface HttpServerRequest {
  body: string;
  path: string;
  method: string;
  header: (field: string) => string | undefined;
}

/** An http server response object. */
export interface HttpServerResponse {
  send(body?: any): HttpServerResponse;
  status(code: number): HttpServerResponse;
}

/** The HTTP application protocol. */
export abstract class WebAppRpcProtocol extends RpcProtocol {
  /** Convenience handler for an RPC operation post request for an http server. */
  public async handleOperationPostRequest(req: HttpServerRequest, res: HttpServerResponse) {
    const request = WebAppRpcRequest.deserialize(this, req);
    const fulfillment = await this.fulfill(request);
    res.status(fulfillment.status).send(fulfillment.result);
  }

  /** Convenience handler for an OpenAPI description request for an http server. */
  public handleOpenApiDescriptionRequest(_req: HttpServerRequest, res: HttpServerResponse) {
    const description = JSON.stringify(this.openAPIDescription);
    res.send(description);
  }

  /** The OpenAPI-compatible info object for this protocol. */
  public abstract info: OpenAPIInfo;

  /** An optional prefix for RPC operation URI paths. */
  public pathPrefix: string = "";

  /** The RPC request class for this protocol. */
  public readonly requestType = WebAppRpcRequest;

  /** Supplies the status corresponding to a protocol-specific code value. */
  public getStatus(code: number): RpcRequestStatus {
    switch (code) {
      case 202: return RpcRequestStatus.Provisioning;
      case 409: return RpcRequestStatus.Pending;
      case 200: return RpcRequestStatus.Resolved;
      case 500: return RpcRequestStatus.Rejected;
      default: return RpcRequestStatus.Unknown;
    }
  }

  /** Supplies the protocol-specific code corresponding to a status value. */
  public getCode(status: RpcRequestStatus): number {
    switch (status) {
      case RpcRequestStatus.Provisioning: return 202;
      case RpcRequestStatus.Pending: return 409;
      case RpcRequestStatus.Resolved: return 200;
      case RpcRequestStatus.Rejected: return 500;
      default: return 501;
    }
  }

  /** An OpenAPI-compatible description of this protocol. */
  public get openAPIDescription() { return new RpcOpenAPIDescription(this); }

  /** Supplies the HTTP verb for an RPC operation. */
  public supplyMethodForOperation(_operation: RpcOperation): "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace" {
    return "post";
  }

  /** Returns the OpenAPI-compatible URI path parameters for an RPC operation. */
  public abstract supplyPathParametersForOperation(_operation: RpcOperation): OpenAPIParameter[];

  /** Returns an HTTP request object for an RPC operation request. */
  public supplyConnectionForRequest(): XMLHttpRequest {
    return new XMLHttpRequest();
  }

  /** Supplies error objects for protocol events. */
  public supplyErrorForEvent(event: RpcProtocolEvent, object: RpcRequest | RpcInvocation): Error {
    if (object instanceof WebAppRpcRequest) {
      return WebAppRpcLogging.supplyError(event, object);
    } else {
      return super.supplyErrorForEvent(event, object);
    }
  }

  /** Constructs an http protocol. */
  public constructor(configuration: RpcConfiguration) {
    super(configuration);
    this.events.addListener(WebAppRpcLogging.logProtocolEvent);
  }
}
