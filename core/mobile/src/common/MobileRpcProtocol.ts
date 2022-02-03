/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus } from "@itwin/core-bentley";
import type { RpcRequestFulfillment, RpcSerializedValue,
  SerializedRpcRequest} from "@itwin/core-common";
import {
  IModelError, IpcWebSocket, RpcEndpoint, RpcProtocol, RpcPushChannel, RpcPushConnection, RpcRequest,
} from "@itwin/core-common";
import { MobileEventLoop } from "./MobileEventLoop";
import { MobileIpcTransport } from "./MobileIpc";
import { MobilePushConnection, MobilePushTransport } from "./MobilePush";
import { MobileRpcConfiguration } from "./MobileRpcManager";
import { MobileRpcRequest } from "./MobileRpcRequest";

/** @beta */
export type MobileRpcChunks = Array<string | Uint8Array>;

/** @beta */
export interface MobileRpcGateway {
  handler: (payload: ArrayBuffer | string, connectionId: number) => void;
  sendString: (message: string, connectionId: number) => void;
  sendBinary: (message: Uint8Array, connectionId: number) => void;
  port: number;
  connectionId: number;
}

/** RPC interface protocol for an Mobile-based application.
 * @beta
 */
export class MobileRpcProtocol extends RpcProtocol {
  public socket: WebSocket = (undefined as any);
  public requests: Map<string, MobileRpcRequest> = new Map();
  private _pending: MobileRpcChunks[] = [];
  private _capacity: number = Number.MAX_SAFE_INTEGER;
  private _sendInterval: number | undefined = undefined;
  private _sendIntervalHandler = () => this.trySend();
  public readonly requestType = MobileRpcRequest;
  private _partialRequest: SerializedRpcRequest | undefined = undefined;
  private _partialFulfillment: RpcRequestFulfillment | undefined = undefined;
  private _partialData: Uint8Array[] = [];
  private _port: number = 0;
  private _transport?: MobilePushTransport;
  private _ipc: MobileIpcTransport;
  public static obtainInterop(): MobileRpcGateway { throw new IModelError(BentleyStatus.ERROR, "Not implemented."); }

  public static async encodeRequest(request: MobileRpcRequest): Promise<MobileRpcChunks> {
    const serialized = await request.protocol.serialize(request);
    const data = serialized.parameters.data;
    serialized.parameters.data = data.map((v) => v.byteLength) as any[];
    return [JSON.stringify(serialized), ...data];
  }

  public static encodeResponse(fulfillment: RpcRequestFulfillment): MobileRpcChunks {
    const data = fulfillment.result.data;
    fulfillment.result.data = data.map((v) => v.byteLength) as any[];
    const raw = fulfillment.rawResult;
    fulfillment.rawResult = undefined;
    const encoded = [JSON.stringify(fulfillment), ...data];
    fulfillment.rawResult = raw;
    return encoded;
  }

  constructor(configuration: MobileRpcConfiguration, endPoint: RpcEndpoint) {
    super(configuration);

    if (endPoint === RpcEndpoint.Frontend) {
      this.initializeFrontend();
    } else if (endPoint === RpcEndpoint.Backend) {
      this.initializeBackend();
    }

    this._ipc = new MobileIpcTransport(this);
    IpcWebSocket.transport = this._ipc;
  }

  private initializeFrontend() {
    if (typeof (WebSocket) === "undefined") {
      throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on frontend require websocket to work");
    }
    if (!MobileRpcConfiguration.args.port) {
      throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol require 'port' parameter");
    }

    this._port = MobileRpcConfiguration.args.port;
    this.connect(this._port, false);

    (window as any)._imodeljs_rpc_reconnect = (port: number) => {
      this.socket.close();
      window.location.hash = window.location.hash.replace(`port=${this._port}`, `port=${port}`);
      this._port = port;
      this.connect(port, true);
    };

    const transport = new MobilePushTransport(this);
    this._transport = transport;
    RpcPushChannel.setup(transport);
  }

  private connect(port: number, reset: boolean) {
    const socket = new WebSocket(`ws://localhost:${port}`);
    socket.binaryType = "arraybuffer";
    this.connectMessageHandler(socket);
    this.connectOpenHandler(socket, reset);
    this.connectErrorHandler(socket);
    this.socket = socket;
  }

  private connectMessageHandler(socket: WebSocket) {
    socket.addEventListener("message", async (event) => {
      if (this.socket !== socket) {
        return;
      }

      this.handleMessageFromBackend(event.data);
    });
  }

  private connectOpenHandler(socket: WebSocket, reset: boolean) {
    socket.addEventListener("open", (_event) => {
      if (this.socket !== socket) {
        return;
      }

      if (reset) {
        this.reset();

        const requests = new Map(RpcRequest.activeRequests);
        requests.forEach((req) => {
          req.cancel();
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          req.submit();
        });
      }

      this.scheduleSend();
    });
  }

  private connectErrorHandler(socket: WebSocket) {
    socket.addEventListener("error", (_event) => {
      if (this.socket !== socket) {
        return;
      }

      throw new IModelError(BentleyStatus.ERROR, "Socket error.");
    });
  }

  private reset() {
    this.requests.clear();
    this._pending.length = 0;
    this._capacity = Number.MAX_SAFE_INTEGER;

    if (typeof (this._sendInterval) !== "undefined") {
      window.clearInterval(this._sendInterval);
      this._sendInterval = undefined;
    }

    this._partialRequest = undefined;
    this._partialFulfillment = undefined;
    this._partialData.length = 0;
  }

  private scheduleSend() {
    if (!this._pending.length) {
      return;
    }

    this.trySend();

    if (this._pending.length && typeof (this._sendInterval) === "undefined") {
      this._sendInterval = window.setInterval(this._sendIntervalHandler, 0);
    }
  }

  private trySend() {
    if (this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this._capacity !== 0 && this._pending.length) {
      --this._capacity;
      const next = this._pending.shift()!;
      for (const chunk of next) {
        this.socket.send(chunk);
      }
    }

    if (!this._pending.length && typeof (this._sendInterval) !== "undefined") {
      window.clearInterval(this._sendInterval);
      this._sendInterval = undefined;
    }
  }

  private handleMessageFromBackend(data: string | ArrayBuffer) {
    if (typeof (data) === "string") {
      this.handleStringFromBackend(data);
    } else {
      this.handleBinaryFromBackend(data);
    }
  }

  private handleStringFromBackend(data: string) {
    if (this._partialFulfillment) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (already receiving response).");
    }

    const response = JSON.parse(data) as RpcRequestFulfillment;
    this._partialFulfillment = response;

    if (!response.result.data.length) {
      this.notifyResponse();
    }
  }

  private handleBinaryFromBackend(data: ArrayBuffer) {
    const fulfillment = this._partialFulfillment;
    if (!fulfillment) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (no response received).");
    }

    this._partialData.push(new Uint8Array(data));
    if (this._partialData.length === fulfillment.result.data.length) {
      this.notifyResponse();
    }
  }

  private notifyResponse() {
    const response = this._partialFulfillment;
    if (!response) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (no response exists).");
    }

    ++this._capacity;
    this.consumePartialData(response.result);
    this._partialFulfillment = undefined;

    if (this._transport && this._transport.consume(response)) {
      return;
    }

    if (this._ipc.consumeResponse(response)) {
      return;
    }

    const request = this.requests.get(response.id) as MobileRpcRequest;
    this.requests.delete(response.id);
    request.notifyResponse(response);
  }

  private consumePartialData(value: RpcSerializedValue) {
    for (let i = 0, l = value.data.length; i !== l; ++i) {
      value.data[i] = this._partialData[i];
    }

    this._partialData.length = 0;
  }

  private initializeBackend() {
    const mobilegateway = MobileRpcProtocol.obtainInterop();
    if (mobilegateway === undefined || mobilegateway == null) {
      throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on backend require native bridge to be setup");
    }

    mobilegateway.handler = (payload, connectionId) => this.handleMessageFromFrontend(payload, connectionId);
    RpcPushConnection.for = (channel, client) => new MobilePushConnection(channel, client, this);
    RpcPushChannel.enabled = true;
  }

  private handleMessageFromFrontend(data: string | ArrayBuffer, connectionId: number) {
    if (typeof (data) === "string") {
      this.handleStringFromFrontend(data, connectionId);
    } else {
      this.handleBinaryFromFrontend(data, connectionId);
    }
  }

  private handleStringFromFrontend(data: string, connection: number) {
    if (this._partialRequest) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (already receiving request).");
    }

    const request = JSON.parse(data) as SerializedRpcRequest;
    this._partialRequest = request;

    if (!request.parameters.data.length) {
      this.notifyRequest(connection); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  private handleBinaryFromFrontend(data: ArrayBuffer, connection: number) {
    const request = this._partialRequest;
    if (!request) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (no request received).");
    }

    this._partialData.push(new Uint8Array(data));
    if (this._partialData.length === request.parameters.data.length) {
      this.notifyRequest(connection); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  private async notifyRequest(connection: number) {
    const request = this._partialRequest;
    if (!request) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (no request exists).");
    }

    this.consumePartialData(request.parameters);
    this._partialRequest = undefined;

    if (this._ipc.consumeRequest(request)) {
      return;
    }

    MobileEventLoop.addTask();
    const fulfillment = await this.fulfill(request);
    MobileEventLoop.removeTask();

    const response = MobileRpcProtocol.encodeResponse(fulfillment);
    this.sendToFrontend(response, connection);
  }

  public sendToBackend(message: MobileRpcChunks): void {
    this._pending.push(message);
    this.scheduleSend();
  }

  public sendToFrontend(message: MobileRpcChunks, connection?: number): void {
    const mobilegateway = MobileRpcProtocol.obtainInterop();

    for (const chunk of message) {
      if (typeof (chunk) === "string") {
        mobilegateway.sendString(chunk, connection || mobilegateway.connectionId);
      } else {
        mobilegateway.sendBinary(chunk, connection || mobilegateway.connectionId);
      }
    }
  }
}
