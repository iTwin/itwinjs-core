/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BeEvent, BentleyStatus } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../../RpcInterface";
import { RpcOperation } from "./RpcOperation";
import { RpcInvocation } from "./RpcInvocation";
import { RpcProtocol, RpcProtocolEvent } from "./RpcProtocol";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcMarshaling } from "./RpcMarshaling";
import { CURRENT_REQUEST } from "./RpcRegistry";
import { aggregateLoad, RpcNotFoundResponse } from "./RpcControl";
import { IModelToken } from "../../IModel";
import { IModelError } from "../../IModelError";

const emptyBuffer = new Uint8Array(0);

/** Supplies an IModelToken for an RPC request. */
export type RpcRequestTokenSupplier_T = (request: RpcRequest) => IModelToken | undefined;

/** Supplies a unique identifier for an RPC request. */
export type RpcRequestIdSupplier_T = (request: RpcRequest) => string;

/** Supplies the initial retry interval for an RPC request. */
export type RpcRequestInitialRetryIntervalSupplier_T = (configuration: RpcConfiguration) => number;

/** Notification callback for an RPC request. */
export type RpcRequestCallback_T = (request: RpcRequest) => void;

/** Runtime information related to the operation load of one or more RPC interfaces. */
export interface RpcOperationsProfile {
  readonly lastRequest: number;
  readonly lastResponse: number;
}

/** The status of an RPC operation request. */
export enum RpcRequestStatus {
  Unknown,
  Created,
  Submitted,
  Provisioning,
  Pending,
  Resolved,
  Rejected,
  Enqueued,
  Acknowledged,
  Finalized,
  Disposed,
  NotFound,
}

/** RPC request event types. */
export enum RpcRequestEvent {
  StatusChanged,
  PendingUpdateReceived,
}

/** RPC request response types. */
export enum RpcResponseType {
  Unknown,
  Text,
  Binary,
}

/** Handles RPC request events. */
export type RpcRequestEventHandler = (type: RpcRequestEvent, request: RpcRequest) => void;

/** Resolves "not found" responses for RPC requests. */
export type RpcRequestNotFoundHandler = (request: RpcRequest, response: RpcNotFoundResponse, resubmit: () => void, reject: (reason: any) => void) => void;

/** A RPC operation request. */
export class RpcRequest<TResponse = any> {
  private _resolve: (value?: TResponse | PromiseLike<TResponse> | undefined) => void = () => undefined;
  private _reject: (reason?: any) => void = () => undefined;
  private _created: number = 0;
  private _lastSubmitted: number = 0;
  private _lastUpdated: number = 0;
  private _status: RpcRequestStatus = RpcRequestStatus.Unknown;
  private _extendedStatus: string = "";
  private _connecting: boolean = false;
  private _active: boolean = true;

  /** Events raised by RpcRequest. See [[RpcRequestEvent]] */
  public static readonly events: BeEvent<RpcRequestEventHandler> = new BeEvent();

  /** Resolvers for "not found" requests. See [[RpcRequestNotFoundHandler]] */
  public static readonly notFoundHandlers: BeEvent<RpcRequestNotFoundHandler> = new BeEvent();

  /** The aggregate operations profile of all active RPC interfaces. */
  public static get aggregateLoad(): RpcOperationsProfile { return aggregateLoad; }

  /**
   * The request for the current RPC operation.
   * @note The return value of this function is only reliable if program control was received from a RPC interface class member function that directly returns the result of calling RpcInterface.forward.
   */
  public static current(context: RpcInterface): RpcRequest {
    return (context as any)[CURRENT_REQUEST];
  }

  /** The unique identifier of this request. */
  public readonly id: string;

  /** The operation for this request. */
  public readonly operation: RpcOperation;

  /** The parameters for this request. */
  public parameters: any[];

  /** The RPC client instance for this request. */
  public readonly client: RpcInterface;

  /** Convenience access to the protocol of this request. */
  public readonly protocol: RpcProtocol;

  /** The implementation response for this request. */
  public readonly response: Promise<TResponse>;

  /** The status of this request. */
  public get status() { return this._status; }

  /** Extended status information for this request (if available). */
  public get extendedStatus() { return this._extendedStatus; }

  /** The last submission for this request. */
  public get lastSubmitted() { return this._lastSubmitted; }

  /** The last status update received for this request. */
  public get lastUpdated() { return this._lastUpdated; }

  /** The target interval (in milliseconds) between submission attempts for this request. */
  public retryInterval: number;

  /** Whether this request is finalized. */
  public get finalized() { return this.status === RpcRequestStatus.Finalized; }

  /** Whether a connection is active for this request. */
  public get connecting() { return this._connecting; }

  /** Whether this request is pending. */
  public get pending(): boolean {
    switch (this.status) {
      case RpcRequestStatus.Submitted:
      case RpcRequestStatus.Provisioning:
      case RpcRequestStatus.Pending: {
        return true;
      }

      default: {
        return false;
      }
    }
  }

  /** The elapsed time for this request. */
  public get elapsed(): number {
    return this._lastUpdated - this._created;
  }

  /** Finds the first parameter of a given type if present. */
  public findParameterOfType<T>(constructor: { new(...args: any[]): T }): T | undefined {
    for (const param of this.parameters) {
      if (param instanceof constructor)
        return param;
    }

    return undefined;
  }

  /** Constructs an RPC request. */
  public constructor(client: RpcInterface, operation: string, parameters: any[]) {
    this._created = new Date().getTime();
    this.client = client;
    this.protocol = client.configuration.protocol;
    this.operation = RpcOperation.lookup(client.constructor as any, operation);
    this.parameters = this.processParameters(parameters, operation);
    this.retryInterval = this.operation.policy.retryInterval(client.configuration);
    this.response = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject; });
    this.id = this.operation.policy.requestId(this);
    this.protocol.events.addListener(this.handleProtocolEvent, this);
    this.setStatus(RpcRequestStatus.Created);
    this.operation.policy.requestCallback(this);
  }

  private processParameters(parameters: any[], _operationName: string) {
    return parameters;
  }

  /** Override to initialize the request communication channel. */
  protected initializeChannel(): void { }

  /** Override to send the request. */
  protected send(): void { }

  /** Override to set request header values. */
  protected setHeader(_name: string, _value: string): void { }

  /** Override to supply response status code. */
  public getResponseStatusCode(): number { return 0; }

  /** Override to supply response text. */
  public getResponseText(): string { return ""; }

  /** Override to supply response bytes. */
  public getResponseBytes(): Uint8Array { return emptyBuffer; }

  /** Override to supply response type. */
  public getResponseType(): RpcResponseType { return RpcResponseType.Unknown; }

  protected setLastUpdatedTime() { this._lastUpdated = new Date().getTime(); }

  /* @hidden */
  public submit(): void {
    if (!this._active)
      return;

    this._lastSubmitted = new Date().getTime();

    if (this.status === RpcRequestStatus.Created || this.status === RpcRequestStatus.NotFound) {
      this.setStatus(RpcRequestStatus.Submitted);
    }

    try {
      this._connecting = true;
      this.protocol.events.raiseEvent(RpcProtocolEvent.RequestCreated, this);
      this.initializeChannel();
      this.setHeaders();
      this.send();
      this.operation.policy.sentCallback(this);
    } catch (e) {
      this._connecting = false;
      this.reject(e);
    }
  }

  private handleProtocolEvent(event: RpcProtocolEvent, object: RpcRequest | RpcInvocation): void {
    if (object !== this)
      return;

    switch (event) {
      case RpcProtocolEvent.ResponseLoaded: {
        this._connecting = false;
        return this.handleResponse();
      }

      case RpcProtocolEvent.AcknowledgementReceived: {
        return this.acknowledge();
      }

      case RpcProtocolEvent.BackendErrorReceived: {
        this._connecting = false;
        return;
      }

      case RpcProtocolEvent.ConnectionAborted:
      case RpcProtocolEvent.ConnectionErrorReceived:
      case RpcProtocolEvent.UnknownErrorReceived: {
        this._connecting = false;
        return this.reject(this.protocol.supplyErrorForEvent(event, this));
      }
    }
  }

  private handleResponse(): void {
    const code = this.getResponseStatusCode();
    const status = this.protocol.getStatus(code);

    switch (status) {
      case RpcRequestStatus.Resolved: {
        const type = this.getResponseType();
        if (type === RpcResponseType.Text) {
          try {
            const result: TResponse = RpcMarshaling.deserialize(this.operation, this.protocol, this.getResponseText());
            return this.resolve(result);
          } catch (err) {
            return this.reject(err);
          }
        } else if (type === RpcResponseType.Binary) {
          const result: TResponse = this.getResponseBytes() as any; // ts bug? why necessary to cast?
          return this.resolve(result);
        } else {
          throw new IModelError(BentleyStatus.ERROR, "Unknown response content type.");
        }
      }

      case RpcRequestStatus.Rejected: {
        this.protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorReceived, this);

        try {
          const localError = new Error();
          const backendError = RpcMarshaling.deserialize(this.operation, this.protocol, this.getResponseText());
          localError.name = backendError.name;
          localError.message = backendError.message;

          const localStack = localError.stack;
          const remoteStack = backendError.stack;
          backendError.stack = `${localStack}\n${remoteStack}`;

          return this.reject(backendError);
        } catch (err) {
          return this.reject(err);
        }
      }

      case RpcRequestStatus.Provisioning:
      case RpcRequestStatus.Pending: {
        return this.setPending(status, this.getResponseText());
      }

      case RpcRequestStatus.NotFound: {
        const response = RpcMarshaling.deserialize(this.operation, this.protocol, this.getResponseText());
        this.setStatus(status);

        let resubmitted = false;
        RpcRequest.notFoundHandlers.raiseEvent(this, response, () => {
          if (resubmitted)
            throw new IModelError(BentleyStatus.ERROR, `Already resubmitted using this handler.`);

          resubmitted = true;
          this.submit();
        }, (reason: any) => this.reject(reason));
        return;
      }
    }
  }

  private resolve(value: TResponse): void {
    if (!this._active)
      return;

    this._active = false;
    this.setLastUpdatedTime();
    this._resolve(value);
    this.setStatus(RpcRequestStatus.Resolved);

    if (this.operation.policy.requiresAcknowledgement) {
      this.enqueue();
    } else {
      this.finalize();
    }
  }

  private reject(reason: any): void {
    if (!this._active)
      return;

    this._active = false;
    this.setLastUpdatedTime();
    this._reject(reason);
    this.setStatus(RpcRequestStatus.Rejected);
    this.finalize();
  }

  private enqueue(): void {
    this.setStatus(RpcRequestStatus.Enqueued);
  }

  private acknowledge(): void {
    this.setStatus(RpcRequestStatus.Acknowledged);
    this.finalize();
  }

  private finalize(): void {
    this.setStatus(RpcRequestStatus.Finalized);
  }

  /** @hidden */
  public dispose(): void {
    this.setStatus(RpcRequestStatus.Disposed);
    this.protocol.events.removeListener(this.handleProtocolEvent, this);

    const client = this.client as any;
    if (client[CURRENT_REQUEST] === this) {
      client[CURRENT_REQUEST] = undefined;
    }
  }

  private setPending(status: RpcRequestStatus.Provisioning | RpcRequestStatus.Pending, extendedStatus: string): void {
    if (!this._active)
      return;

    this.setLastUpdatedTime();
    this._extendedStatus = extendedStatus;
    this.setStatus(status);
    RpcRequest.events.raiseEvent(RpcRequestEvent.PendingUpdateReceived, this);
  }

  private setHeaders(): void {
    this.setHeader(this.protocol.requestIdHeaderName, this.id);

    if (this.protocol.authorizationHeaderName) {
      this.setHeader(this.protocol.authorizationHeaderName, this.protocol.configuration.applicationAuthorizationValue);
    }
  }

  private setStatus(status: RpcRequestStatus): void {
    if (this._status === status)
      return;

    this._status = status;
    RpcRequest.events.raiseEvent(RpcRequestEvent.StatusChanged, this);
  }
}
