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
import { RpcRequestStatus } from "./RpcRequest";
import { RpcProtocol, RpcProtocolEvent, SerializedRpcRequest, RpcRequestFulfillment } from "./RpcProtocol";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcMarshaling } from "./RpcMarshaling";
import { RpcPendingResponse } from "./RpcControl";

/** An RPC operation invocation in response to a request. */
export class RpcInvocation {
  private _threw: boolean;
  private _pending: boolean = false;

  /** The protocol for this invocation. */
  public readonly protocol: RpcProtocol;

  /** The received request. */
  public readonly request: SerializedRpcRequest;

  /** The operation of the request. */
  public readonly operation: RpcOperation;

  /** The implementation response. */
  public readonly result: Promise<any>;

  /** Whether an exception occured. */
  public get threw() { return this._threw; }

  /** The fulfillment for this request. */
  public readonly fulfillment: Promise<RpcRequestFulfillment>;

  /** The status for this request. */
  public get status(): RpcRequestStatus {
    if (this.threw) {
      return RpcRequestStatus.Rejected;
    } else {
      if (this._pending)
        return RpcRequestStatus.Pending;
      else
        return RpcRequestStatus.Resolved;
    }
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
    this.protocol = protocol;
    this.request = request;
    this.operation = RpcOperation.lookup(request.operation.interfaceDefinition, request.operation.operationName);
    protocol.events.raiseEvent(RpcProtocolEvent.RequestReceived, this);

    try {
      this._threw = false;

      const parameters = RpcMarshaling.deserialize(this.operation, protocol, request.parameters);
      const impl = RpcRegistry.instance.getImplForInterface(this.operation.interfaceDefinition);
      const op = this.lookupOperationFunction(impl);
      (impl as any)[CURRENT_INVOCATION] = this;
      this.result = Promise.resolve(op.call(impl, ...parameters));
    } catch (error) {
      this._threw = true;
      this.result = Promise.reject(error);
      protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorOccurred, this);
    }

    this.fulfillment = this.result.then((value) => {
      const result = RpcMarshaling.serialize(this.operation, protocol, value);
      const status = protocol.getCode(this.status);
      protocol.events.raiseEvent(RpcProtocolEvent.BackendResponseCreated, this);
      return this.createFulfillment(result, status);
    }, (reason) => {
      if (!RpcConfiguration.developmentMode)
        reason.stack = undefined;

      if (reason instanceof RpcPendingResponse) {
        this._pending = true;
        protocol.events.raiseEvent(RpcProtocolEvent.BackendReportedPending, this);
        return this.createFulfillment(reason.message, protocol.getCode(this.status));
      }

      this._threw = true;
      const result = RpcMarshaling.serialize(this.operation, protocol, reason);
      const status = protocol.getCode(this.status);
      protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorOccurred, this);
      return this.createFulfillment(result, status);
    });
  }

  private createFulfillment(result: string, status: number): RpcRequestFulfillment {
    return { result, status, id: this.request.id, interfaceName: this.operation.interfaceDefinition.name };
  }

  private lookupOperationFunction(implementation: RpcInterface): (...args: any[]) => any {
    const func = (implementation as any)[this.operation.operationName];
    if (!func || typeof (func) !== "function") {
      throw new IModelError(BentleyStatus.ERROR, `RPC interface class "${implementation.constructor.name}" does not implement operation "${this.operation.operationName}".`, Logger.logError, "imodeljs-backend.RpcInterface");
    }

    return func;
  }
}
