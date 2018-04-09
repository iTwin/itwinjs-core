/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { Logger } from "@bentley/bentleyjs-core";
import { Gateway } from "../../Gateway";
import { GatewayOperation } from "./GatewayOperation";
import { GatewayRegistry } from "./GatewayRegistry";
import { GatewayRequestStatus } from "./GatewayRequest";
import { GatewayProtocol, GatewayProtocolEvent, SerializedGatewayRequest, GatewayRequestFulfillment } from "./GatewayProtocol";
import { GatewayMarshaling } from "./GatewayMarshaling";
import { GatewayPendingResponse } from "./GatewayControl";

/** A gateway operation invocation in response to a request. */
export class GatewayInvocation {
  private _threw: boolean;
  private _pending: boolean = false;

  /** The received request. */
  public readonly request: SerializedGatewayRequest;

  /** The operation of the request. */
  public readonly operation: GatewayOperation;

  /** The implementation response. */
  public readonly result: Promise<any>;

  /** Whether an exception occured. */
  public get threw() { return this._threw; }

  /** The fulfillment for this request. */
  public readonly fulfillment: Promise<GatewayRequestFulfillment>;

  /** The status for this request. */
  public get status(): GatewayRequestStatus {
    if (this.threw) {
      return GatewayRequestStatus.Rejected;
    } else {
      if (this._pending)
        return GatewayRequestStatus.Pending;
      else
        return GatewayRequestStatus.Resolved;
    }
  }

  /** Constructs an invocation. */
  public constructor(protocol: GatewayProtocol, request: SerializedGatewayRequest) {
    protocol.events.raiseEvent(GatewayProtocolEvent.RequestReceived, this);
    this.request = request;
    this.operation = GatewayOperation.lookup(request.operation.gateway, request.operation.name);

    try {
      this._threw = false;

      const parameters = GatewayMarshaling.deserialize(this.operation, protocol, request.parameters);
      const impl = GatewayRegistry.instance.getImplementationForGateway(this.operation.gateway);
      const op = this.lookupOperationFunction(impl);
      this.result = op.call(impl, ...parameters, this);
    } catch (error) {
      this._threw = true;
      this.result = Promise.reject(error);
      protocol.events.raiseEvent(GatewayProtocolEvent.BackendErrorOccurred, this);
    }

    this.fulfillment = this.result.then((value) => {
      const result = GatewayMarshaling.serialize(this.operation, protocol, value);
      const status = protocol.getCode(this.status);
      protocol.events.raiseEvent(GatewayProtocolEvent.BackendResponseCreated, this);
      return { result, status };
    }, (reason) => {
      if (reason instanceof GatewayPendingResponse) {
        this._pending = true;
        protocol.events.raiseEvent(GatewayProtocolEvent.BackendReportedPending, this);
        return { result: reason.message, status: protocol.getCode(this.status) };
      }

      this._threw = true;
      const result = this.supplyErrorMessage(reason);
      const status = protocol.getCode(this.status);
      protocol.events.raiseEvent(GatewayProtocolEvent.BackendErrorOccurred, this);
      return { result, status };
    });
  }

  /** Supplies the error message for an invocation result. */
  protected supplyErrorMessage(error: any): string {
    let message = "";
    if (error instanceof Error) {
      message = `${error.toString()} ${error.stack}`;
    } else if (error.hasOwnProperty("message")) {
      message = error.message;
    } else {
      message = JSON.stringify(error);
    }

    return message;
  }

  private lookupOperationFunction(implementation: Gateway): (...args: any[]) => any {
    const func = (implementation as any)[this.operation.name];
    if (!func || typeof (func) !== "function") {
      throw new IModelError(BentleyStatus.ERROR, `Gateway class "${implementation.constructor.name}" does not implement operation "${this.operation.name}".`, Logger.logError, "imodeljs-backend.Gateway");
    }

    return func;
  }
}
