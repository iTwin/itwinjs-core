/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "../../Gateway";
import { GatewayConfiguration } from "./GatewayConfiguration";
import { GatewayRequest, GatewayRequestEvent, GatewayRequestStatus } from "./GatewayRequest";
import { GatewayProtocol, GatewayProtocolEvent } from "./GatewayProtocol";
import { GatewayInvocation } from "./GatewayInvocation";
import * as uuidv4 from "uuid/v4";

// tslint:disable:space-before-function-paren
let obtainLock = 0;

/** @hidden @internal */
export const aggregateLoad = { lastRequest: 0, lastResponse: 0 };

/** Manages requests and responses for a gateway configuration. */
export class GatewayControlChannel {
  private pendingInterval: any = undefined;
  private pending: GatewayRequest[] = [];
  private pendingLock: number = 0;

  private constructor(configuration: GatewayConfiguration) {
    GatewayRequest.events.addListener(this.requestEventHandler, this);
    GatewayProtocol.events.addListener(this.protocolEventHandler, this);

    class Channel extends Gateway {
      public static readonly version = "1.0.0";
      public static readonly types = () => [];
      public static readonly id = uuidv4();
    }

    Object.defineProperty(Channel, "name", { value: Channel.id });

    class ChannelImpl extends Gateway {
    }

    Object.defineProperty(ChannelImpl, "name", { value: Channel.id });

    GatewayConfiguration.assign(Channel, () => configuration.constructor as any);
    Gateway.registerImplementation(Channel, ChannelImpl);
    Gateway.initialize(Channel);

    // const channel = Gateway.getProxyForGateway(Channel);
  }

  /** @hidden @internal */
  public static obtain(configuration: GatewayConfiguration): GatewayControlChannel {
    if (obtainLock)
      return undefined as any;

    ++obtainLock;
    const channel = new GatewayControlChannel(configuration);
    --obtainLock;

    return channel;
  }

  private protocolEventHandler(type: GatewayProtocolEvent, _object: GatewayRequest | GatewayInvocation): void {
    const now = new Date().getTime();

    switch (type) {
      case GatewayProtocolEvent.RequestReceived: {
        aggregateLoad.lastRequest = now;
        break;
      }

      case GatewayProtocolEvent.BackendErrorOccurred:
      case GatewayProtocolEvent.BackendResponseCreated: {
        aggregateLoad.lastResponse = now;
        break;
      }
    }
  }

  private requestEventHandler(type: GatewayRequestEvent, request: GatewayRequest): void {
    if (type !== GatewayRequestEvent.StatusChanged)
      return;

    switch (request.status) {
      case GatewayRequestStatus.Submitted: {
        aggregateLoad.lastRequest = request.lastSubmitted;
        break;
      }
      case GatewayRequestStatus.Resolved:
      case GatewayRequestStatus.Rejected: {
        aggregateLoad.lastResponse = request.lastUpdated;
        break;
      }
    }

    if (request.gateway.configuration.controlChannel !== this)
      return;

    switch (request.status) {
      case GatewayRequestStatus.Submitted: {
        this.enqueuePending(request);
        break;
      }

      case GatewayRequestStatus.Resolved: {
        this.dequeuePending(request);
        break;
      }

      case GatewayRequestStatus.Rejected: {
        this.dequeuePending(request);
        break;
      }
    }
  }

  private enqueuePending(request: GatewayRequest) {
    this.pending.push(request);
    this.setPendingInterval();
  }

  private dequeuePending(request: GatewayRequest) {
    if (this.pendingLock)
      return;

    const i = this.pending.indexOf(request);
    this.pending.splice(i, 1);
    this.clearPendingInterval();
  }

  private pendingIntervalHandler = function (this: GatewayControlChannel) {
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
}
