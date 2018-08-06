/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { Logger } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../../RpcInterface";
import { RpcOperation } from "./RpcOperation";
import { RpcRegistry, CURRENT_INVOCATION } from "./RpcRegistry";
import { RpcRequestStatus, RpcResponseType } from "./RpcRequest";
import { RpcProtocol, RpcProtocolEvent, SerializedRpcRequest, RpcRequestFulfillment } from "./RpcProtocol";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcMarshaling } from "./RpcMarshaling";
import { RpcPendingResponse, RpcNotFoundResponse } from "./RpcControl";

/** Notification callback for an RPC invocation. */
export type RpcInvocationCallback_T = (invocation: RpcInvocation) => void;

/** An RPC operation invocation in response to a request. */
export class RpcInvocation {
  private _threw: boolean = false;
  private _pending: boolean = false;
  private _notFound: boolean = false;
  private _timeIn: number = 0;
  private _timeOut: number = 0;

  /** The protocol for this invocation. */
  public readonly protocol: RpcProtocol;

  /** The received request. */
  public readonly request: SerializedRpcRequest;

  /** The operation of the request. */
  public readonly operation: RpcOperation = undefined as any;

  /** The implementation response. */
  public readonly result: Promise<any>;

  /** The fulfillment for this request. */
  public readonly fulfillment: Promise<RpcRequestFulfillment>;

  /** The status for this request. */
  public get status(): RpcRequestStatus {
    if (this._threw) {
      return RpcRequestStatus.Rejected;
    } else {
      if (this._pending)
        return RpcRequestStatus.Pending;
      else if (this._notFound)
        return RpcRequestStatus.NotFound;
      else
        return RpcRequestStatus.Resolved;
    }
  }

  /** The elapsed time for this invocation. */
  public get elapsed(): number {
    return this._timeOut - this._timeIn;
  }

  /**
   * The invocation for the current RPC operation.
   * @note The return value of this function is only reliable in an RPC interface class member function where program control was received from the RpcInvocation constructor function.
   */
  public static current(context: RpcInterface): RpcInvocation {
    return (context as any)[CURRENT_INVOCATION];
  }

  /** Constructs an invocation. */
  public constructor(protocol: RpcProtocol, request: SerializedRpcRequest) {
    this._timeIn = new Date().getTime();
    this.protocol = protocol;
    this.request = request;

    try {
      try {
        this.operation = RpcOperation.lookup(this.request.operation.interfaceDefinition, this.request.operation.operationName);

        const backend = this.operation.interfaceVersion;
        const frontend = this.request.operation.interfaceVersion;
        if (backend !== frontend) {
          throw new IModelError(BentleyStatus.ERROR, `Backend version ${backend} does not match frontend version ${frontend} for RPC interface ${this.operation.operationName}.`);
        }
      } catch (error) {
        if (this.handleUnknownOperation(error)) {
          this.operation = RpcOperation.lookup(this.request.operation.interfaceDefinition, this.request.operation.operationName);
        } else {
          throw error;
        }
      }

      this.operation.policy.invocationCallback(this);
      protocol.events.raiseEvent(RpcProtocolEvent.RequestReceived, this);
      this.result = this.resolve();
    } catch (error) {
      this.result = this.reject(error);
    }

    this.fulfillment = this.result.then((value) => this.fulfillResolved(value), (reason) => this.fulfillRejected(reason));
  }

  private handleUnknownOperation(error: any): boolean {
    return this.protocol.configuration.controlChannel.handleUnknownOperation(this, error);
  }

  private resolve(): Promise<any> {
    const parameters = RpcMarshaling.deserialize(this.operation, this.protocol, this.request.parameters);
    const impl = RpcRegistry.instance.getImplForInterface(this.operation.interfaceDefinition);
    (impl as any)[CURRENT_INVOCATION] = this;
    const op = this.lookupOperationFunction(impl);
    return Promise.resolve(op.call(impl, ...parameters));
  }

  private reject(error: any): Promise<any> {
    this._threw = true;
    this.protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorOccurred, this);
    return Promise.reject(error);
  }

  private fulfillResolved(value: any): RpcRequestFulfillment {
    this._timeOut = new Date().getTime();
    this.protocol.events.raiseEvent(RpcProtocolEvent.BackendResponseCreated, this);

    if (value instanceof Uint8Array) {
      return this.fulfill(value, RpcResponseType.Binary);
    } else {
      const result = RpcMarshaling.serialize(this.operation, this.protocol, value);
      return this.fulfill(result, RpcResponseType.Text);
    }
  }

  private fulfillRejected(reason: any): RpcRequestFulfillment {
    this._timeOut = new Date().getTime();
    if (!RpcConfiguration.developmentMode)
      reason.stack = undefined;

    let result = RpcMarshaling.serialize(this.operation, this.protocol, reason);

    if (reason instanceof RpcPendingResponse) {
      this._pending = true;
      result = reason.message;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendReportedPending, this);
    } else if (reason instanceof RpcNotFoundResponse) {
      this._notFound = true;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendReportedNotFound, this);
    } else {
      this._threw = true;
      this.protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorOccurred, this);
    }

    return this.fulfill(result, RpcResponseType.Text);
  }

  private fulfill(result: string | Uint8Array, type: RpcResponseType): RpcRequestFulfillment {
    const fulfillment = {
      result,
      status: this.protocol.getCode(this.status),
      id: this.request.id,
      interfaceName: this.operation.interfaceDefinition.name,
      type,
    };

    return fulfillment;
  }

  private lookupOperationFunction(implementation: RpcInterface): (...args: any[]) => any {
    const func = (implementation as any)[this.operation.operationName];
    if (!func || typeof (func) !== "function") {
      throw new IModelError(BentleyStatus.ERROR, `RPC interface class "${implementation.constructor.name}" does not implement operation "${this.operation.operationName}".`, Logger.logError, "imodeljs-backend.RpcInterface");
    }

    return func;
  }
}
