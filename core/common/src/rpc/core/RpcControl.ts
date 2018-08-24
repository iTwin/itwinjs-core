/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../../RpcInterface";
import { RpcManager, RpcInterfaceEndpoints } from "../../RpcManager";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcRequest, RpcRequestEvent, RpcRequestStatus } from "./RpcRequest";
import { RpcProtocol, RpcProtocolEvent } from "./RpcProtocol";
import { RpcInvocation } from "./RpcInvocation";
import { RpcOperation } from "./RpcOperation";
import { RpcRegistry } from "./RpcRegistry";
import { IModelToken } from "../../IModel";
import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";

// tslint:disable:space-before-function-paren
let obtainLock = 0;

/** @hidden */
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

/** A RPC operation response . */
export class RpcNotFoundResponse extends RpcControlResponse {
}

/** Manages requests and responses for an RPC configuration. */
export class RpcControlChannel {
  /** @hidden */
  public static channels: RpcControlChannel[] = [];
  private _configuration: RpcConfiguration;
  private _pendingInterval: any = undefined;
  private _disposeInterval: any = undefined;
  private _pending: RpcRequest[] = [];
  /** @hidden */
  public requests: Map<string, RpcRequest> = new Map();
  private _pendingLock: number = 0;
  private _initialized = false;
  private _clientActive = false;
  private _describeEndpoints: () => Promise<RpcInterfaceEndpoints[]> = undefined as any;

  private constructor(configuration: RpcConfiguration) {
    this._configuration = configuration;
    RpcRequest.events.addListener(this.requestEventHandler, this);
    RpcProtocol.events.addListener(this.protocolEventHandler, this);
    RpcControlChannel.channels.push(this);
  }

  /** @hidden */
  public describeEndpoints() {
    this.activateClient();
    return this._describeEndpoints();
  }

  /** @hidden */
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
      this._disposeIntervalHandler();
      return;
    }

    if (object.protocol.configuration !== this._configuration)
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
    if (request.protocol.configuration !== this._configuration)
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

      case RpcRequestStatus.NotFound: {
        this.dequeuePending(request);
        break;
      }
    }
  }

  private enqueuePending(request: RpcRequest) {
    this._pending.push(request);
    this.setPendingInterval();
  }

  private dequeuePending(request: RpcRequest) {
    if (this._pendingLock)
      return;

    const i = this._pending.indexOf(request);
    this._pending.splice(i, 1);
    this.clearPendingInterval();
  }

  private _pendingIntervalHandler = function (this: RpcControlChannel) {
    const now = new Date().getTime();

    ++this._pendingLock;

    for (const request of this._pending) {
      if (request.connecting || (request.lastSubmitted + request.retryInterval) > now) {
        continue;
      }

      request.submit();
    }

    --this._pendingLock;

    this.cleanupPendingQueue();
  }.bind(this);

  private cleanupPendingQueue() {
    if (this._pendingLock)
      return;

    let i = this._pending.length;
    while (i--) {
      if (!this._pending[i].pending) {
        this._pending.splice(i, 1);
      }
    }

    this.clearPendingInterval();
  }

  private setPendingInterval() {
    if (this._pendingInterval)
      return;

    this._pendingInterval = setInterval(this._pendingIntervalHandler, 0);
  }

  private clearPendingInterval() {
    if (!this._pending.length) {
      clearInterval(this._pendingInterval);
      this._pendingInterval = undefined;
    }
  }

  private _disposeIntervalHandler = function (this: RpcControlChannel) {
    this.requests.forEach((value, key, _map) => {
      if (value.status === RpcRequestStatus.Finalized) {
        value.dispose();
        this.requests.delete(key);
      }
    });

    if (!this.requests.size) {
      clearInterval(this._disposeInterval);
      this._disposeInterval = undefined;
    }
  }.bind(this);

  private setDisposeInterval() {
    if (this._disposeInterval)
      return;

    this._disposeInterval = setInterval(this._disposeIntervalHandler, 1000);
  }

  private _channelInterface = class extends RpcInterface {
    public static readonly version = "CONTROL";
    public static readonly types = () => [];
    public describeEndpoints(): Promise<RpcInterfaceEndpoints[]> { return this.forward.apply(this, arguments); }
  };

  private _channelImpl = class extends RpcInterface {
    public describeEndpoints(): Promise<RpcInterfaceEndpoints[]> {
      const endpoints: RpcInterfaceEndpoints[] = [];

      this.configuration.interfaces().forEach((definition) => {
        if (!RpcRegistry.instance.isRpcInterfaceInitialized(definition))
          return;

        const description: RpcInterfaceEndpoints = { interfaceName: definition.name, interfaceVersion: definition.version, operationNames: [], compatible: true };
        RpcOperation.forEach(definition, (operation) => description.operationNames.push(operation.operationName));
        endpoints.push(description);
      });

      return Promise.resolve(endpoints);
    }
  };

  private computeId(): string {
    const interfaces: string[] = [];
    this._configuration.interfaces().forEach((definition) => interfaces.push(`${definition.name}@${definition.version}`));
    const id = interfaces.sort().join(",");

    if (typeof (btoa) !== "undefined")
      return btoa(id);
    else if (typeof (Buffer) !== "undefined")
      return Buffer.from(id, "binary").toString("base64");
    else
      return id;
  }

  private activateClient() {
    if (this._clientActive)
      return;

    if (!this._initialized) {
      if (this._configuration.interfaces().length)
        throw new IModelError(BentleyStatus.ERROR, `Invalid state.`);

      this.initialize(); // WIP...handshakes will eliminate this scenario
    }

    this._clientActive = true;
    RpcOperation.forEach(this._channelInterface, (operation) => operation.policy.token = (_request) => RpcOperation.fallbackToken || new IModelToken("none", "none", "none", "none"));
    const client = RpcManager.getClientForInterface(this._channelInterface);
    this._describeEndpoints = () => client.describeEndpoints();
  }

  /** @hidden */
  public initialize() {
    if (this._initialized)
      throw new IModelError(BentleyStatus.ERROR, `Already initialized.`);

    this._initialized = true;

    const id = this.computeId();
    Object.defineProperty(this._channelInterface, "name", { value: id });
    Object.defineProperty(this._channelImpl, "name", { value: id });

    RpcConfiguration.assign(this._channelInterface, () => this._configuration.constructor as any);
    RpcManager.registerImpl(this._channelInterface, this._channelImpl);
    RpcManager.initializeInterface(this._channelInterface);
  }

  /** @hidden */
  public handleUnknownOperation(invocation: RpcInvocation, _error: any): boolean {
    const op = invocation.request.operation;
    if (op.interfaceVersion === "CONTROL" && op.operationName === "describeEndpoints") {
      op.interfaceDefinition = this._channelInterface.name;
      return true;
    }

    return false;
  }
}
