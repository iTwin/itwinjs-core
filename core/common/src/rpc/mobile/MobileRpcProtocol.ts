/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcProtocol, SerializedRpcRequest, RpcRequestFulfillment } from "../core/RpcProtocol";
import { MobileRpcConfiguration } from "./MobileRpcManager";
import { MobileRpcRequest } from "./MobileRpcRequest";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { RpcSerializedValue } from "../core/RpcMarshaling";
import { RpcEndpoint } from "../core/RpcConstants";
/** @hidden */
declare var bentley: any;

/** @hidden */
export const CHANNEL = "@bentley/imodeljs-mobilegateway";

/** @hidden */
export const interop = (() => {
  let mobilegateway = null;

  if (typeof window === "undefined" && typeof (bentley) !== "undefined") {
    // tslint:disable-next-line:no-eval
    mobilegateway = bentley.imodeljs.servicesTier.require(CHANNEL);
  }

  return mobilegateway;
})();

export type MobileRpcChunks = Array<string | Uint8Array>;

interface MobileRpcGateway {
  handler: (payload: ArrayBuffer | string) => void;
  sendString: (message: string) => void;
  sendBinary: (message: Uint8Array) => void;
  port: number;
}

/** RPC interface protocol for an Mobile-based application. */
export class MobileRpcProtocol extends RpcProtocol {
  public socket: WebSocket = (undefined as any);
  public requests: Map<string, MobileRpcRequest> = new Map();
  private _pending: MobileRpcChunks[] = [];
  private _capacity: number = 1;
  private _sendInterval: number | undefined = undefined;
  private _sendIntervalHandler = () => this.trySend();
  public readonly requestType = MobileRpcRequest;
  private _partialRequest: SerializedRpcRequest | undefined = undefined;
  private _partialFulfillment: RpcRequestFulfillment | undefined = undefined;
  private _partialData: Uint8Array[] = [];

  public static async encodeRequest(request: MobileRpcRequest): Promise<MobileRpcChunks> {
    const serialized = await request.protocol.serialize(request);
    const data = serialized.parameters.data;
    serialized.parameters.data = data.map((v) => v.byteLength) as any[];
    return [JSON.stringify(serialized), ...data];
  }

  private static encodeResponse(fulfillment: RpcRequestFulfillment): MobileRpcChunks {
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
  }

  private initializeFrontend() {
    if (typeof (WebSocket) === "undefined") {
      throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on frontend require websocket to work");
    }

    this.socket = new WebSocket(`ws://localhost:${window.location.hash.substr(1)}`);
    this.socket.binaryType = "arraybuffer";
    this.socket.addEventListener("message", async (event) => this.handleMessageFromBackend(event.data));
    this.socket.addEventListener("open", (_event) => this.scheduleSend());
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
    const mobilegateway: MobileRpcGateway = interop as MobileRpcGateway;
    if (mobilegateway === undefined || mobilegateway == null) {
      throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on backend require native bridge to be setup");
    }

    mobilegateway.handler = (payload) => this.handleMessageFromFrontend(payload);
    (self as any).__imodeljs_mobilegateway_handler__ = mobilegateway.handler;
  }

  private handleMessageFromFrontend(data: string | ArrayBuffer) {
    if (typeof (data) === "string") {
      this.handleStringFromFrontend(data);
    } else {
      this.handleBinaryFromFrontend(data);
    }
  }

  private handleStringFromFrontend(data: string) {
    if (this._partialRequest) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (already receiving request).");
    }

    const request = JSON.parse(data) as SerializedRpcRequest;
    this._partialRequest = request;

    if (!request.parameters.data.length) {
      this.notifyRequest(); // tslint:disable-line:no-floating-promises
    }
  }

  private handleBinaryFromFrontend(data: ArrayBuffer) {
    const request = this._partialRequest;
    if (!request) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (no request received).");
    }

    this._partialData.push(new Uint8Array(data));
    if (this._partialData.length === request.parameters.data.length) {
      this.notifyRequest(); // tslint:disable-line:no-floating-promises
    }
  }

  private async notifyRequest() {
    const request = this._partialRequest;
    if (!request) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid state (no request exists).");
    }

    this.consumePartialData(request.parameters);
    this._partialRequest = undefined;

    const fulfillment = await this.fulfill(request);
    const response = MobileRpcProtocol.encodeResponse(fulfillment);
    this.sendToFrontend(response);
  }

  public sendToBackend(message: MobileRpcChunks): void {
    this._pending.push(message);
    this.scheduleSend();
  }

  private sendToFrontend(message: MobileRpcChunks): void {
    const mobilegateway: MobileRpcGateway = interop as MobileRpcGateway;

    for (const chunk of message) {
      if (typeof (chunk) === "string") {
        mobilegateway.sendString(chunk);
      } else {
        mobilegateway.sendBinary(chunk);
      }
    }
  }
}
