/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@bentley/bentleyjs-core";
import { Gateway } from "../../Gateway";
import { GatewayOperation } from "./GatewayOperation";
import { GatewayInvocation } from "./GatewayInvocation";
import { GatewayProtocol, GatewayProtocolEvent } from "./GatewayProtocol";
import { GatewayMarshaling } from "./GatewayMarshaling";
import { OPERATION } from "./GatewayRegistry";
import { aggregateLoad } from "./GatewayControl";
import { IModelToken } from "../../IModel";

/** Supplies an IModelToken for a gateway request. */
export type GatewayRequestTokenSupplier_T = (request: GatewayRequest) => IModelToken | undefined;

/** Supplies a unique identifier for a gateway request. */
export type GatewayRequestIdSupplier_T = (request: GatewayRequest) => string;

/** Runtime information related to the operation load of one or more gateways. */
export interface GatewayOperationsProfile {
  readonly lastRequest: number;
  readonly lastResponse: number;
}

/** The status of a gateway operation request. */
export enum GatewayRequestStatus {
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
}

/** Gateway request event types. */
export enum GatewayRequestEvent {
  StatusChanged,
  PendingUpdateReceived,
}

/** Handles gateway request events. */
export type GatewayRequestEventHandler = (type: GatewayRequestEvent, request: GatewayRequest) => void;

/** A gateway operation request. */
export class GatewayRequest<TResponse = any> {
  private _resolve: (value?: TResponse | PromiseLike<TResponse> | undefined) => void = () => undefined;
  private _reject: (reason?: any) => void = () => undefined;
  private _lastSubmitted: number = 0;
  private _lastUpdated: number = 0;
  private _status: GatewayRequestStatus = GatewayRequestStatus.Unknown;
  private _extendedStatus: string = "";
  private _connecting: boolean = false;

  /** Events raised by GatewayRequest. See [[GatewayRequestEvent]] */
  public static readonly events: BeEvent<GatewayRequestEventHandler> = new BeEvent();

  /** The aggregate operations profile of all active gateways. */
  public static get aggregateLoad(): GatewayOperationsProfile { return aggregateLoad; }

  /** The unique identifier of this request. */
  public readonly id: string;

  /** The operation for this request. */
  public readonly operation: GatewayOperation;

  /** The parameters for this request. */
  public parameters: any[];

  /** The gateway class instance for this request. */
  public readonly gateway: Gateway;

  /** Convenience access to the protocol of this request. */
  public readonly protocol: GatewayProtocol;

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
  public readonly retryInterval: number;

  /** Whether this request is finalized. */
  public get finalized() { return this.status === GatewayRequestStatus.Finalized; }

  /** Whether a connection is active for this request. */
  public get connecting() { return this._connecting; }

  /** Whether this request is pending. */
  public get pending(): boolean {
    switch (this.status) {
      case GatewayRequestStatus.Submitted:
      case GatewayRequestStatus.Provisioning:
      case GatewayRequestStatus.Pending: {
        return true;
      }

      default: {
        return false;
      }
    }
  }

  /** Finds the first parameter of a given type if present. */
  public findParameterOfType<T>(constructor: { new(...args: any[]): T }): T | undefined {
    for (const param of this.parameters) {
      if (param instanceof constructor)
        return param;
    }

    return undefined;
  }

  /** Constructs a gateway request. */
  public constructor(gateway: Gateway, operation: string, parameters: any[]) {
    this.gateway = gateway;
    this.protocol = gateway.configuration.protocol;
    this.operation = (gateway.constructor.prototype as any)[operation][OPERATION];
    this.parameters = parameters;
    this.retryInterval = gateway.configuration.pendingOperationRetryInterval;
    this.response = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject; });
    this.id = this.operation.policy.requestId(this);
    this.protocol.events.addListener(this.handleProtocolEvent, this);
    this.setStatus(GatewayRequestStatus.Created);
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

  /* @hidden @internal */
  public submit(): void {
    this._lastSubmitted = new Date().getTime();

    if (this.status === GatewayRequestStatus.Created) {
      this.setStatus(GatewayRequestStatus.Submitted);
    }

    try {
      this._connecting = true;
      this.protocol.events.raiseEvent(GatewayProtocolEvent.RequestCreated, this);
      this.initializeChannel();
      this.setHeaders();
      this.send();
    } catch (e) {
      this._connecting = false;
      this.reject(e);
    }
  }

  private handleProtocolEvent(event: GatewayProtocolEvent, object: GatewayRequest | GatewayInvocation): void {
    if (object !== this)
      return;

    switch (event) {
      case GatewayProtocolEvent.ResponseLoaded: {
        this._connecting = false;
        return this.handleResponse();
      }

      case GatewayProtocolEvent.AcknowledgementReceived: return this.acknowledge();

      case GatewayProtocolEvent.BackendErrorReceived:
      case GatewayProtocolEvent.ConnectionAborted:
      case GatewayProtocolEvent.ConnectionErrorReceived:
      case GatewayProtocolEvent.UnknownErrorReceived: {
        this._connecting = false;
        return this.reject(this.protocol.supplyErrorForEvent(event, this));
      }
    }
  }

  private handleResponse(): void {
    const code = this.getResponseStatusCode();
    const status = this.protocol.getStatus(code);

    switch (status) {
      case GatewayRequestStatus.Resolved: {
        const result = GatewayMarshaling.deserialize(this.operation, this.protocol, this.getResponseText());
        return this.resolve(result);
      }

      case GatewayRequestStatus.Rejected: return this.protocol.events.raiseEvent(GatewayProtocolEvent.BackendErrorReceived, this);

      case GatewayRequestStatus.Provisioning:
      case GatewayRequestStatus.Pending: {
        return this.setPending(status, this.getResponseText());
      }
    }
  }

  private resolve(value: TResponse): void {
    this._lastUpdated = new Date().getTime();
    this._resolve(value);
    this.setStatus(GatewayRequestStatus.Resolved);

    if (this.operation.policy.requiresAcknowledgement) {
      this.enqueue();
    } else {
      this.finalize();
    }
  }

  private reject(reason: any): void {
    this._lastUpdated = new Date().getTime();
    this._reject(reason);
    this.setStatus(GatewayRequestStatus.Rejected);
    this.finalize();
  }

  private enqueue(): void {
    this.setStatus(GatewayRequestStatus.Enqueued);
  }

  private acknowledge(): void {
    this.setStatus(GatewayRequestStatus.Acknowledged);
    this.finalize();
  }

  private finalize(): void {
    this.setStatus(GatewayRequestStatus.Finalized);
  }

  private setPending(status: GatewayRequestStatus.Provisioning | GatewayRequestStatus.Pending, extendedStatus: string): void {
    this._lastUpdated = new Date().getTime();
    this._extendedStatus = extendedStatus;
    this.setStatus(status);
    GatewayRequest.events.raiseEvent(GatewayRequestEvent.PendingUpdateReceived, this);
  }

  private setHeaders(): void {
    this.setHeader(this.protocol.requestIdHeaderName, this.id);

    if (this.protocol.authorizationHeaderName) {
      this.setHeader(this.protocol.authorizationHeaderName, this.protocol.configuration.applicationAuthorizationValue);
    }
  }

  private setStatus(status: GatewayRequestStatus): void {
    if (this._status === status)
      return;

    this._status = status;
    GatewayRequest.events.raiseEvent(GatewayRequestEvent.StatusChanged, this);
  }
}
