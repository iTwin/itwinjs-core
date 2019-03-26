/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BeEvent, BentleyStatus, Guid, SerializedClientRequestContext } from "@bentley/bentleyjs-core";
import { RpcInterface } from "../../RpcInterface";
import { RpcOperation } from "./RpcOperation";
import { RpcProtocol } from "./RpcProtocol";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcMarshaling, RpcSerializedValue } from "./RpcMarshaling";
import { CURRENT_REQUEST } from "./RpcRegistry";
import { RpcNotFoundResponse } from "./RpcControl";
import { IModelToken } from "../../IModel";
import { IModelError } from "../../IModelError";
import { RpcResponseCacheControl, RpcRequestEvent, RpcRequestStatus, RpcProtocolEvent } from "./RpcConstants";

const aggregateLoad = { lastRequest: 0, lastResponse: 0 };

export class ResponseLike implements Response {
  private _data: Promise<any>;
  public get body() { return null; }
  public async arrayBuffer(): Promise<ArrayBuffer> { return this._data; }
  public async blob(): Promise<Blob> { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); }
  public async formData(): Promise<FormData> { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); }
  public async json(): Promise<any> { return this._data; }
  public async text(): Promise<string> { return this._data; }
  public get bodyUsed() { return false; }
  public get headers(): Headers { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); }
  public get ok(): boolean { return this.status >= 200 && this.status <= 299; }
  public get redirected() { return false; }
  public get status() { return 200; }
  public get statusText() { return ""; }
  public get trailer(): Promise<Headers> { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); }
  public get type(): ResponseType { return "basic"; }
  public get url() { return ""; }
  public clone() { return Object.assign({}, this); }

  public constructor(data: any) {
    this._data = Promise.resolve(data);
  }
}

/** Supplies an IModelToken for an RPC request. */
export type RpcRequestTokenSupplier_T = (request: RpcRequest) => IModelToken | undefined;

/** Supplies the initial retry interval for an RPC request. */
export type RpcRequestInitialRetryIntervalSupplier_T = (configuration: RpcConfiguration) => number;

/** Notification callback for an RPC request. */
export type RpcRequestCallback_T = (request: RpcRequest) => void;

/** Determines if caching is permitted for a RPC response. */
export type RpcResponseCachingCallback_T = (request: RpcRequest) => RpcResponseCacheControl;

/** Runtime information related to the operation load of one or more RPC interfaces.
 * @public
 */
export interface RpcOperationsProfile {
  readonly lastRequest: number;
  readonly lastResponse: number;
}

/** Handles RPC request events. */
export type RpcRequestEventHandler = (type: RpcRequestEvent, request: RpcRequest) => void;

/** Resolves "not found" responses for RPC requests. */
export type RpcRequestNotFoundHandler = (request: RpcRequest, response: RpcNotFoundResponse, resubmit: () => void, reject: (reason: any) => void) => void;

/** A RPC operation request.
 * @public
 */
export abstract class RpcRequest<TResponse = any> {
  private _resolve: (value?: TResponse | PromiseLike<TResponse> | undefined) => void = () => undefined;
  protected _resolveRaw: (value?: Response | PromiseLike<Response> | undefined) => void = () => undefined;
  private _reject: (reason?: any) => void = () => undefined;
  private _rejectRaw: (reason?: any) => void = () => undefined;
  private _created: number = 0;
  private _lastSubmitted: number = 0;
  private _lastUpdated: number = 0;
  private _status: RpcRequestStatus = RpcRequestStatus.Unknown;
  private _extendedStatus: string = "";
  private _connecting: boolean = false;
  private _active: boolean = true;
  private _hasRawListener = false;
  private _raw: ArrayBuffer | string | undefined = undefined;
  protected _response: Response | undefined = undefined;
  protected _rawPromise: Promise<Response>;

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

  /** Whether a connection is active for this request. */
  public get connecting() { return this._connecting; }

  /** Whether this request is pending. */
  public get pending(): boolean {
    switch (this.status) {
      case RpcRequestStatus.Submitted:
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

  /** A protocol-specific path identifier for this request. */
  public path: string;

  /** A protocol-specific method identifier for this request. */
  public method: string;

  /** Finds the first parameter of a given type if present. */
  public findParameterOfType<T>(requestConstructor: { new(...args: any[]): T }): T | undefined {
    for (const param of this.parameters) {
      if (param instanceof requestConstructor)
        return param;
    }

    return undefined;
  }

  /** The raw implementation response for this request. */
  public get rawResponse(): Promise<Response> {
    this._hasRawListener = true;
    return this._rawPromise;
  }

  /** Constructs an RPC request. */
  public constructor(client: RpcInterface, operation: string, parameters: any[]) {
    this._created = new Date().getTime();
    this.path = "";
    this.method = "";
    this.client = client;
    this.protocol = client.configuration.protocol;
    this.operation = RpcOperation.lookup(client.constructor as any, operation);
    this.parameters = parameters;
    this.retryInterval = this.operation.policy.retryInterval(client.configuration);
    this.response = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject; });
    this._rawPromise = new Promise((resolve, reject) => { this._resolveRaw = resolve; this._rejectRaw = reject; });
    this.id = RpcConfiguration.requestContext.getId(this) || Guid.createValue();
    this.setStatus(RpcRequestStatus.Created);
    this.operation.policy.requestCallback(this);
  }

  /** Override to send the request. */
  protected abstract send(): Promise<number>;

  /** Override to load response value. */
  protected abstract load(): Promise<RpcSerializedValue>;

  /** Override to set request header values. */
  protected abstract setHeader(name: string, value: string): void;

  /** Sets the last updated time for the request. */
  protected setLastUpdatedTime() {
    this._lastUpdated = new Date().getTime();
  }

  /* @internal */
  public async submit(): Promise<void> {
    if (!this._active)
      return;

    this._lastSubmitted = new Date().getTime();

    if (this.status === RpcRequestStatus.Created || this.status === RpcRequestStatus.NotFound) {
      this.setStatus(RpcRequestStatus.Submitted);
    }

    try {
      this._connecting = true;
      this.protocol.events.raiseEvent(RpcProtocolEvent.RequestCreated, this);
      const sent = this.setHeaders().then(() => this.send());
      this.operation.policy.sentCallback(this);
      const response: number = await sent;

      const status = this.protocol.getStatus(response);

      if (this._hasRawListener && status === RpcRequestStatus.Resolved && typeof (this._response) !== "undefined") {
        this._connecting = false;
        this.resolveRaw();
      } else {
        this.protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoading, this);

        if (status === RpcRequestStatus.Unknown) {
          this._connecting = false;
          this.handleUnknownResponse(response);
          return;
        }

        const value = await this.load();
        this.protocol.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, this);
        this._connecting = false;
        this.handleResponse(response, value);
      }
    } catch (err) {
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionErrorReceived, this, err);
      this._connecting = false;
      this.reject(err);
    }
  }

  protected handleUnknownResponse(code: number) {
    this.reject(new IModelError(BentleyStatus.ERROR, `Unknown response ${code}.`));
  }

  private handleResponse(code: number, value: RpcSerializedValue) {
    const status = this.protocol.getStatus(code);

    switch (status) {
      case RpcRequestStatus.Resolved: {
        return this.handleResolved(value);
      }

      case RpcRequestStatus.Rejected: {
        return this.handleRejected(value);
      }

      case RpcRequestStatus.Pending: {
        return this.setPending(status, value.objects);
      }

      case RpcRequestStatus.NotFound: {
        return this.handleNotFound(status, value);
      }
    }
  }

  private handleResolved(value: RpcSerializedValue) {
    try {
      this._raw = value.objects;
      const result: TResponse = RpcMarshaling.deserialize(this.operation, this.protocol, value);

      if (ArrayBuffer.isView(result)) {
        this._raw = result.buffer;
      }

      return this.resolve(result);
    } catch (err) {
      return this.reject(err);
    }
  }

  private handleRejected(value: RpcSerializedValue) {
    this.protocol.events.raiseEvent(RpcProtocolEvent.BackendErrorReceived, this);

    try {
      const localError = new Error();
      const backendError = RpcMarshaling.deserialize(this.operation, this.protocol, value);
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

  private handleNotFound(status: RpcRequestStatus, value: RpcSerializedValue) {
    const response = RpcMarshaling.deserialize(this.operation, this.protocol, value);
    this.setStatus(status);

    let resubmitted = false;
    RpcRequest.notFoundHandlers.raiseEvent(this, response, () => {
      if (resubmitted)
        throw new IModelError(BentleyStatus.ERROR, `Already resubmitted using this handler.`);

      resubmitted = true;
      this.submit(); // tslint:disable-line:no-floating-promises
    }, (reason: any) => this.reject(reason));
    return;
  }

  private resolve(result: TResponse): void {
    if (!this._active)
      return;

    this._active = false;
    this.setLastUpdatedTime();
    this._resolve(result);

    if (this._hasRawListener) {
      if (typeof (this._raw) === "undefined") {
        throw new IModelError(BentleyStatus.ERROR, "Cannot access raw response.");
      }

      this._resolveRaw(new ResponseLike(this._raw));
    }

    this.setStatus(RpcRequestStatus.Resolved);
    this.dispose();
  }

  private resolveRaw() {
    if (typeof (this._response) === "undefined") {
      throw new IModelError(BentleyStatus.ERROR, "Cannot access raw response.");
    }

    this._active = false;
    this.setLastUpdatedTime();
    this._resolveRaw(this._response);
    this.setStatus(RpcRequestStatus.Resolved);
    this.dispose();
  }

  protected reject(reason: any): void {
    if (!this._active)
      return;

    this._active = false;
    this.setLastUpdatedTime();
    this._reject(reason);

    if (this._hasRawListener) {
      this._rejectRaw(reason);
    }

    this.setStatus(RpcRequestStatus.Rejected);
    this.dispose();
  }

  /** @internal */
  public dispose(): void {
    this.setStatus(RpcRequestStatus.Disposed);
    this._raw = undefined;
    this._response = undefined;

    const client = this.client as any;
    if (client[CURRENT_REQUEST] === this) {
      client[CURRENT_REQUEST] = undefined;
    }
  }

  private setPending(status: RpcRequestStatus.Pending, extendedStatus: string): void {
    if (!this._active)
      return;

    this.setLastUpdatedTime();
    this._extendedStatus = extendedStatus;
    this.setStatus(status);
    RpcRequest.events.raiseEvent(RpcRequestEvent.PendingUpdateReceived, this);
  }

  private async setHeaders(): Promise<void> {
    const headerNames: SerializedClientRequestContext = this.protocol.serializedClientRequestContextHeaderNames;
    const headerValues: SerializedClientRequestContext = await RpcConfiguration.requestContext.serialize(this);

    if (headerNames.id)
      this.setHeader(headerNames.id, headerValues.id || this.id); // Cannot be empty

    if (headerNames.applicationVersion)
      this.setHeader(headerNames.applicationVersion, headerValues.applicationVersion);

    if (headerNames.applicationId)
      this.setHeader(headerNames.applicationId, headerValues.applicationId);

    if (headerNames.sessionId)
      this.setHeader(headerNames.sessionId, headerValues.sessionId);

    if (headerNames.authorization && headerValues.authorization)
      this.setHeader(headerNames.authorization, headerValues.authorization);

    if (headerNames.userId && headerValues.userId)
      this.setHeader(headerNames.userId, headerValues.userId);
  }

  private setStatus(status: RpcRequestStatus): void {
    if (this._status === status)
      return;

    this._status = status;
    RpcRequest.events.raiseEvent(RpcRequestEvent.StatusChanged, this);
  }
}

/** @internal */
export const initializeRpcRequest = (() => {
  let initialized = false;

  return () => {
    if (initialized) {
      return;
    }

    initialized = true;

    RpcRequest.events.addListener((type, request) => {
      if (type !== RpcRequestEvent.StatusChanged)
        return;

      switch (request.status) {
        case RpcRequestStatus.Submitted: {
          aggregateLoad.lastRequest = request.lastSubmitted;
          break;
        }

        case RpcRequestStatus.Pending:
        case RpcRequestStatus.Resolved:
        case RpcRequestStatus.Rejected: {
          aggregateLoad.lastResponse = request.lastUpdated;
          break;
        }
      }
    });

    RpcProtocol.events.addListener((type) => {
      const now = new Date().getTime();

      switch (type) {
        case RpcProtocolEvent.RequestReceived: {
          aggregateLoad.lastRequest = now;
          break;
        }

        case RpcProtocolEvent.BackendReportedPending:
        case RpcProtocolEvent.BackendErrorOccurred:
        case RpcProtocolEvent.BackendResponseCreated: {
          aggregateLoad.lastResponse = now;
          break;
        }
      }
    });
  };
})();
