/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayOperation } from "../core/GatewayOperation";
import { GatewayRequest, GatewayRequestStatus } from "../core/GatewayRequest";
import { GatewayProtocol, GatewayProtocolEvent } from "../core/GatewayProtocol";
import { GatewayConfiguration } from "../core/GatewayConfiguration";
import { GatewayInvocation } from "../core/GatewayInvocation";
import { GatewayHttpRequest } from "./GatewayHttpRequest";
import { OpenAPIInfo, OpenAPIParameter, GatewayOpenAPIDescription } from "./OpenAPI";
import { GatewayHttpLogging } from "./GatewayHttpLogging";

/** @module Gateway */

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
export abstract class GatewayHttpProtocol extends GatewayProtocol {
  /** Convenience handler for a gateway operation post request for an http server. */
  public async handleOperationPostRequest(req: HttpServerRequest, res: HttpServerResponse) {
    const request = GatewayHttpRequest.deserialize(this, req);
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

  /** An optional prefix for gateway operation URI paths. */
  public pathPrefix: string = "";

  /** The gateway request class for this protocol. */
  public readonly requestType = GatewayHttpRequest;

  /** Supplies the status corresponding to a protocol-specific code value. */
  public getStatus(code: number): GatewayRequestStatus {
    switch (code) {
      case 202: return GatewayRequestStatus.Provisioning;
      case 409: return GatewayRequestStatus.Pending;
      case 200: return GatewayRequestStatus.Resolved;
      case 500: return GatewayRequestStatus.Rejected;
      default: return GatewayRequestStatus.Unknown;
    }
  }

  /** Supplies the protocol-specific code corresponding to a status value. */
  public getCode(status: GatewayRequestStatus): number {
    switch (status) {
      case GatewayRequestStatus.Provisioning: return 202;
      case GatewayRequestStatus.Pending: return 409;
      case GatewayRequestStatus.Resolved: return 200;
      case GatewayRequestStatus.Rejected: return 500;
      default: return 501;
    }
  }

  /** An OpenAPI-compatible description of this protocol. */
  public get openAPIDescription() { return new GatewayOpenAPIDescription(this); }

  /** Supplies the HTTP verb for a gateway operation. */
  public supplyMethodForOperation(_operation: GatewayOperation): "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace" {
    return "post";
  }

  /** Returns the OpenAPI-compatible URI path parameters for a gateway operation. */
  public abstract supplyPathParametersForOperation(_operation: GatewayOperation): OpenAPIParameter[];

  /** Returns an HTTP request object for a gateway operation request. */
  public supplyConnectionForRequest(): XMLHttpRequest {
    return new XMLHttpRequest();
  }

  /** Supplies error objects for protocol events. */
  public supplyErrorForEvent(event: GatewayProtocolEvent, object: GatewayRequest | GatewayInvocation): Error {
    if (object instanceof GatewayHttpRequest) {
      return GatewayHttpLogging.supplyError(event, object);
    } else {
      return super.supplyErrorForEvent(event, object);
    }
  }

  /** Constructs an http protocol. */
  public constructor(configuration: GatewayConfiguration) {
    super(configuration);
    this.events.addListener(GatewayHttpLogging.logProtocolEvent);
  }
}
