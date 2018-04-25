/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { BeEvent } from "@bentley/bentleyjs-core";
import { GatewayRequest, GatewayRequestStatus } from "./GatewayRequest";
import { GatewayInvocation } from "./GatewayInvocation";
import { GatewayConfiguration } from "./GatewayConfiguration";
import { GatewayOperation } from "./GatewayOperation";
import { GatewayMarshaling } from "./GatewayMarshaling";

/** A serialized gateway operation descriptor. */
export interface SerializedGatewayOperation {
  gateway: string;
  name: string;
  version: string;
}

/** A serialized gateway operation request. */
export interface SerializedGatewayRequest {
  id: string;
  authorization: string;
  operation: SerializedGatewayOperation;
  method: string;
  path: string;
  parameters: string;
}

/** A gateway operation request fulfillment. */
export interface GatewayRequestFulfillment {
  /** The serialized result for the request. */
  result: string;

  /** A protocol-specific status code value for the request. */
  status: number;
}

/** Gateway protocol event types. */
export enum GatewayProtocolEvent {
  RequestCreated,
  ResponseLoaded,
  ResponseLoading,
  ConnectionErrorReceived,
  UnknownErrorReceived,
  BackendErrorReceived,
  ConnectionAborted,
  AcknowledgementReceived,
  RequestReceived,
  BackendResponseCreated,
  BackendReportedPending,
  BackendErrorOccurred,
  AcknowledgementCreated,
}

/** Handles gateway protocol events. */
export type GatewayProtocolEventHandler = (type: GatewayProtocolEvent, object: GatewayRequest | GatewayInvocation) => void;

/** An application protocol for a gateway. */
export abstract class GatewayProtocol {
  /** Events raised by all protocols. See [[GatewayProtocolEvent]] */
  public static readonly events: BeEvent<GatewayProtocolEventHandler> = new BeEvent();

  /** Events raised by the protocol. See [[GatewayProtocolEvent]] */
  public readonly events: BeEvent<GatewayProtocolEventHandler> = new BeEvent();

  /** The configuration for the protocol. */
  public readonly configuration: GatewayConfiguration;

  /** The gateway request class for this protocol. */
  public abstract readonly requestType: typeof GatewayRequest;

  /** The gateway invocation class for this protocol. */
  public readonly invocationType: typeof GatewayInvocation = GatewayInvocation;

  /** The name of the request id header. */
  public requestIdHeaderName: string = "X-RequestId";

  /** The name of the authorization header. */
  public get authorizationHeaderName() { return this.configuration.applicationAuthorizationKey; }

  /** Override to supply the status corresponding to a protocol-specific code value. */
  public getStatus(code: number): GatewayRequestStatus {
    return code;
  }

  /** Override to supply the protocol-specific code corresponding to a status value. */
  public getCode(status: GatewayRequestStatus): number {
    return status;
  }

  /** Override to supply the protocol-specific method value for a gateway operation. */
  public supplyMethodForOperation(_operation: GatewayOperation): string {
    return "";
  }

  /** Override to supply the protocol-specific path value for a gateway operation. */
  public supplyPathForOperation(operation: GatewayOperation, _request: GatewayRequest | undefined): string {
    return JSON.stringify(operation);
  }

  /** Override to supply the operation for a protocol-specific path value. */
  public getOperationFromPath(path: string): SerializedGatewayOperation {
    return JSON.parse(path);
  }

  /** Override to supply error objects for protocol events. */
  public supplyErrorForEvent(_event: GatewayProtocolEvent, _object: GatewayRequest | GatewayInvocation): Error {
    return new Error();
  }

  /** Obtains the implementation result on the backend for a gateway operation request. */
  public fulfill(request: SerializedGatewayRequest): Promise<GatewayRequestFulfillment> {
    return new (this.invocationType)(this, request).fulfillment;
  }

  /** Serializes a request. */
  public serialize(request: GatewayRequest): SerializedGatewayRequest {
    return {
      id: request.id,
      authorization: this.configuration.applicationAuthorizationValue || "",
      operation: {
        gateway: request.operation.gateway.name,
        name: request.operation.name,
        version: request.operation.version,
      },
      method: this.supplyMethodForOperation(request.operation),
      path: this.supplyPathForOperation(request.operation, request),
      parameters: GatewayMarshaling.serialize(request.operation, request.protocol, request.parameters),
    };
  }

  /** Constructs a protocol. */
  public constructor(configuration: GatewayConfiguration) {
    this.configuration = configuration;
    this.events.addListener ((type, object) => GatewayProtocol.events.raiseEvent(type, object));
  }
}
