/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcRequest, RpcRequestEvent, RpcRequestStatus } from "./RpcRequest";
import { RpcProtocol, RpcProtocolEvent } from "./RpcProtocol";
import { RpcInvocation } from "./RpcInvocation";
import * as uuidv4 from "uuid/v4";

// tslint:disable:space-before-function-paren
let obtainLock = 0;

/** @hidden @internal */
export const aggregateLoad = { lastRequest: 0, lastResponse: 0 };

/** An RPC operation control response. */
export abstract class RpcControlResponse {
}

/** A pending RPC operation response. */
export class RpcPendingResponse extends RpcControlResponse {
  /** Extended status regarding the pending operation. */
  public message: string;

  /** Constructs a pending response. */
  public constructor(message: string = "") {
    super();
    this.message = message;
  }
}

/** Manages requests and responses for an RPC configuration. */
export class RpcControlChannel {
  private configuration: RpcConfiguration;
  private pendingInterval: any = undefined;
  private disposeInterval: any = undefined;
  private pending: RpcRequest[] = [];

  /** @hidden @internal */
  public requests: Map<string, RpcRequest> = new Map();

  private pendingLock: number = 0;

  private constructor(configuration: RpcConfiguration) {
    this.configuration = configuration;
    RpcRequest.events.addListener(this.requestEventHandler, this);
    RpcProtocol.events.addListener(this.protocolEventHandler, this);

    class Channel extends RpcInterface {
      public static readonly version = "1.0.0";
      public static readonly types = () => [];
      public static readonly id = uuidv4();
    }

    Object.defineProperty(Channel, "name", { value: Channel.id });

    class ChannelImpl extends RpcInterface {
    }

    Object.defineProperty(ChannelImpl, "name", { value: Channel.id });

    RpcConfiguration.assign(Channel, () => configuration.constructor as any);
    RpcManager.registerImpl(Channel, ChannelImpl);
    RpcManager.initializeInterface(Channel);

    // const channel = RpcManager.getClientForInterface(Channel);
  }

  /** @hidden @internal */
  public static obtain(configuration: RpcConfiguration): RpcControlChannel {
    if (obtainLock)
      return undefined as any;

    ++obtainLock;
    const channel = new RpcControlChannel(configuration);
    --obtainLock;

    return channel;
  }

  private protocolEventHandler(type: RpcProtocolEvent, object: RpcRequest | RpcInvocation): void {
    if (type === RpcProtocolEvent.ReleaseResources) {
      this.disposeIntervalHandler();
      return;
    }

    if (object.protocol.configuration !== this.configuration)
      return;

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
  }

  private requestEventHandler(type: RpcRequestEvent, request: RpcRequest): void {
    if (request.protocol.configuration !== this.configuration)
      return;

    if (type !== RpcRequestEvent.StatusChanged)
      return;

    switch (request.status) {
      case RpcRequestStatus.Created: {
        this.requests.set(request.id, request);
        this.setDisposeInterval();
        break;
      }

      case RpcRequestStatus.Submitted: {
        aggregateLoad.lastRequest = request.lastSubmitted;
        break;
      }

      case RpcRequestStatus.Provisioning:
      case RpcRequestStatus.Pending:
      case RpcRequestStatus.Resolved:
      case RpcRequestStatus.Rejected: {
        aggregateLoad.lastResponse = request.lastUpdated;
        break;
      }
    }

    if (request.client.configuration.controlChannel !== this)
      return;

    switch (request.status) {
      case RpcRequestStatus.Submitted: {
        this.enqueuePending(request);
        break;
      }

      case RpcRequestStatus.Resolved: {
        this.dequeuePending(request);
        break;
      }

      case RpcRequestStatus.Rejected: {
        this.dequeuePending(request);
        break;
      }
    }
  }

  private enqueuePending(request: RpcRequest) {
    this.pending.push(request);
    this.setPendingInterval();
  }

  private dequeuePending(request: RpcRequest) {
    if (this.pendingLock)
      return;

    const i = this.pending.indexOf(request);
    this.pending.splice(i, 1);
    this.clearPendingInterval();
  }

  private pendingIntervalHandler = function (this: RpcControlChannel) {
    const now = new Date().getTime();

    ++this.pendingLock;

    for (const request of this.pending) {
      if (request.connecting || (request.lastSubmitted + request.retryInterval) > now) {
        continue;
      }

      request.submit();
    }

    --this.pendingLock;

    this.cleanupPendingQueue();
  }.bind(this);

  private cleanupPendingQueue() {
    if (this.pendingLock)
      return;

    let i = this.pending.length;
    while (i--) {
      if (!this.pending[i].pending) {
        this.pending.splice(i, 1);
      }
    }

    this.clearPendingInterval();
  }

  private setPendingInterval() {
    if (this.pendingInterval)
      return;

    this.pendingInterval = setInterval(this.pendingIntervalHandler, 0);
  }

  private clearPendingInterval() {
    if (!this.pending.length) {
      clearInterval(this.pendingInterval);
      this.pendingInterval = undefined;
    }
  }

  private disposeIntervalHandler = function (this: RpcControlChannel) {
    this.requests.forEach((value, key, _map) => {
      if (value.status === RpcRequestStatus.Finalized) {
        value.dispose();
        this.requests.delete(key);
      }
    });

    if (!this.requests.size) {
      clearInterval(this.disposeInterval);
      this.disposeInterval = undefined;
    }
  }.bind(this);

  private setDisposeInterval() {
    if (this.disposeInterval)
      return;

    this.disposeInterval = setInterval(this.disposeIntervalHandler, 60000);
  }
}
