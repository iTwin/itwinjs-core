/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BeEvent } from "@bentley/bentleyjs-core";
import { RpcRequest } from "./RpcRequest";
import { RpcInvocation } from "./RpcInvocation";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcOperation } from "./RpcOperation";
import { RpcMarshaling, RpcSerializedValue } from "./RpcMarshaling";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcResponseCacheControl, RpcRequestStatus, RpcProtocolEvent } from "./RpcConstants";

/** A serialized RPC operation descriptor. */
export interface SerializedRpcOperation {
  interfaceDefinition: string;
  operationName: string;
  interfaceVersion: string;
  encodedRequest?: string;
}

/** A serialized RPC operation request. */
export interface SerializedRpcRequest {
  id: string;
  authorization: string;
  version: string;
  operation: SerializedRpcOperation;
  method: string;
  path: string;
  parameters: RpcSerializedValue;
  caching: RpcResponseCacheControl;
}

/** An RPCD operation request fulfillment. */
export interface RpcRequestFulfillment {
  /** The RPC interface for the request. */
  interfaceName: string;

  /** The id for the request. */
  id: string;

  /** The result for the request. */
  result: RpcSerializedValue;

  /** The unserialized result for the request. */
  rawResult: any;

  /** A protocol-specific status code value for the request. */
  status: number;
}

/** @hidden */
export namespace RpcRequestFulfillment {
  export function forUnknownError(request: SerializedRpcRequest, error: any): RpcRequestFulfillment {
    const result = RpcMarshaling.serialize(request.operation.interfaceDefinition, undefined, error);

    return {
      interfaceName: request.operation.interfaceDefinition,
      id: request.id,
      result,
      rawResult: error,
      status: RpcRequestStatus.Rejected,
    };
  }
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

  /** The name of the version header. */
  public get versionHeaderName() { return this.configuration.applicationVersionKey; }

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

  /** Override to supply the protocol-specific path value for an RPC operation. */
  public supplyPathForOperation(operation: RpcOperation, _request: RpcRequest | undefined): string {
    return JSON.stringify(operation);
  }

  /** Override to supply the operation for a protocol-specific path value. */
  public getOperationFromPath(path: string): SerializedRpcOperation {
    return JSON.parse(path);
  }

  /** Obtains the implementation result on the backend for an RPC operation request. */
  public async fulfill(request: SerializedRpcRequest): Promise<RpcRequestFulfillment> {
    return new (this.invocationType)(this, request).fulfillment;
  }

  /** Serializes a request. */
  public serialize(request: RpcRequest): SerializedRpcRequest {
    return {
      id: request.id,
      authorization: this.configuration.applicationAuthorizationValue || "",
      version: RpcConfiguration.applicationVersionValue || "",
      operation: {
        interfaceDefinition: request.operation.interfaceDefinition.name,
        operationName: request.operation.operationName,
        interfaceVersion: request.operation.interfaceVersion,
      },
      method: request.method,
      path: request.path,
      parameters: RpcMarshaling.serialize(request.operation, request.protocol, request.parameters),
      caching: RpcResponseCacheControl.None,
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
