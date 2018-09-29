/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BeEvent } from "@bentley/bentleyjs-core";
import { RpcRequest, RpcRequestStatus, RpcResponseType } from "./RpcRequest";
import { RpcInvocation } from "./RpcInvocation";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcOperation } from "./RpcOperation";
import { RpcMarshaling } from "./RpcMarshaling";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";

/** A serialized RPC operation descriptor. */
export interface SerializedRpcOperation {
  interfaceDefinition: string;
  operationName: string;
  interfaceVersion: string;
}

/** A serialized RPC operation request. */
export interface SerializedRpcRequest {
  id: string;
  authorization: string;
  operation: SerializedRpcOperation;
  method: string;
  path: string;
  parameters: string | Uint8Array;
}

/** An RPCD operation request fulfillment. */
export interface RpcRequestFulfillment {
  /** The RPC interface for the request. */
  interfaceName: string;

  /** The id for the request. */
  id: string;

  /** The result for the request. */
  result: string | Uint8Array;

  /** A protocol-specific status code value for the request. */
  status: number;

  /** The type of the result. */
  type: RpcResponseType;
}

/** @hidden */
export namespace RpcRequestFulfillment {
  export function forUnknownError(request: SerializedRpcRequest, error: any): RpcRequestFulfillment {
    const result = RpcMarshaling.serialize(request.operation.interfaceDefinition, undefined, error);

    return {
      interfaceName: request.operation.interfaceDefinition,
      id: request.id,
      result,
      status: RpcRequestStatus.Rejected,
      type: RpcResponseType.Text,
    };
  }
}

/** RPC protocol event types. */
export enum RpcProtocolEvent {
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
  BackendReportedNotFound,
  BackendErrorOccurred,
  AcknowledgementCreated,
  ReleaseResources,
}

/** Handles RPC protocol events. */
export type RpcProtocolEventHandler = (type: RpcProtocolEvent, object: RpcRequest | RpcInvocation) => void;

/** An application protocol for an RPC interface. */
export abstract class RpcProtocol {
  /** Events raised by all protocols. See [[RpcProtocolEvent]] */
  public static readonly events: BeEvent<RpcProtocolEventHandler> = new BeEvent();

  /** Events raised by the protocol. See [[RpcProtocolEvent]] */
  public readonly events: BeEvent<RpcProtocolEventHandler> = new BeEvent();

  /** The configuration for the protocol. */
  public readonly configuration: RpcConfiguration;

  /** The RPC request class for this protocol. */
  public abstract readonly requestType: typeof RpcRequest;

  /** The RPC invocation class for this protocol. */
  public readonly invocationType: typeof RpcInvocation = RpcInvocation;

  /** The name of the request id header. */
  public requestIdHeaderName: string = "X-RequestId";

  /** The name of the authorization header. */
  public get authorizationHeaderName() { return this.configuration.applicationAuthorizationKey; }

  /** Override to supply the status corresponding to a protocol-specific code value. */
  public getStatus(code: number): RpcRequestStatus {
    return code;
  }

  /** Override to supply the protocol-specific code corresponding to a status value. */
  public getCode(status: RpcRequestStatus): number {
    return status;
  }

  /** Override to supply the protocol-specific method value for an RPC operation. */
  public supplyMethodForOperation(_operation: RpcOperation): string {
    return "";
  }

  /** Override to supply the protocol-specific path value for an RPC operation. */
  public supplyPathForOperation(operation: RpcOperation, _request: RpcRequest | undefined): string {
    return JSON.stringify(operation);
  }

  /** Override to supply the operation for a protocol-specific path value. */
  public getOperationFromPath(path: string): SerializedRpcOperation {
    return JSON.parse(path);
  }

  /** Override to supply error objects for protocol events. */
  public supplyErrorForEvent(_event: RpcProtocolEvent, _object: RpcRequest | RpcInvocation): Error {
    return new Error();
  }

  /** Obtains the implementation result on the backend for an RPC operation request. */
  public fulfill(request: SerializedRpcRequest): Promise<RpcRequestFulfillment> {
    return new (this.invocationType)(this, request).fulfillment;
  }

  /** Serializes a request. */
  public serialize(request: RpcRequest): SerializedRpcRequest {
    let parameters: string | Uint8Array;
    if (request.parameters.length === 1 && request.parameters[0] instanceof Uint8Array) {
      parameters = request.parameters[0];
    } else {
      parameters = RpcMarshaling.serialize(request.operation, request.protocol, request.parameters);
    }

    return {
      id: request.id,
      authorization: this.configuration.applicationAuthorizationValue || "",
      operation: {
        interfaceDefinition: request.operation.interfaceDefinition.name,
        operationName: request.operation.operationName,
        interfaceVersion: request.operation.interfaceVersion,
      },
      method: this.supplyMethodForOperation(request.operation),
      path: this.supplyPathForOperation(request.operation, request),
      parameters,
    };
  }

  /** Constructs a protocol. */
  public constructor(configuration: RpcConfiguration) {
    this.configuration = configuration;
    this.events.addListener((type, object) => RpcProtocol.events.raiseEvent(type, object));
  }

  /** @hidden */
  public onRpcClientInitialized(_definition: RpcInterfaceDefinition, _client: RpcInterface): void { }

  /** @hidden */
  public onRpcImplInitialized(_definition: RpcInterfaceDefinition, _impl: RpcInterface): void { }

  /** @hidden */
  public onRpcClientTerminated(_definition: RpcInterfaceDefinition, _client: RpcInterface): void { }

  /** @hidden */
  public onRpcImplTerminated(_definition: RpcInterfaceDefinition, _impl: RpcInterface): void { }
}
