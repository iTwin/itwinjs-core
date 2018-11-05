/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcProtocol, SerializedRpcRequest } from "../core/RpcProtocol";
import { MobileRpcConfiguration } from "./MobileRpcManager";
import { MobileRpcRequest } from "./MobileRpcRequest";
import { RpcRequestFulfillment } from "../core/RpcProtocol";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
import { RpcSerializedValue } from "../core/RpcMarshaling";
import { RpcMultipart } from "../web/RpcMultipart";
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

/** RPC interface protocol for an Mobile-based application. */
export class MobileRpcProtocol extends RpcProtocol {
  public socket: WebSocket = (undefined as any);
  public requests: Map<string, MobileRpcRequest> = new Map();
  public pending: Blob[] = [];
  public readonly requestType = MobileRpcRequest;

  /** Encodes a request for transport. */
  public static encodeRequest(request: MobileRpcRequest): Uint8Array[] {
    const serialized = request.protocol.serialize(request);
    const data = serialized.parameters.data;
    MobileRpcProtocol._deflateData(serialized.parameters);
    return MobileRpcProtocol._encode(JSON.stringify(serialized), data);
  }

  /** Encodes a response for transport. */
  public static encodeResponse(fulfillment: RpcRequestFulfillment): Uint8Array[] {
    const data = fulfillment.result.data;
    MobileRpcProtocol._deflateData(fulfillment.result);
    return MobileRpcProtocol._encode(JSON.stringify(fulfillment), data);
  }

  /** Decodes a request from transport format. */
  public static decodeRequest(data: ArrayBuffer): SerializedRpcRequest {
    const header = MobileRpcProtocol._decodeHeader(data);
    const objectString = MobileRpcProtocol._decodeObject(header, data);
    const request = JSON.parse(objectString) as SerializedRpcRequest;
    MobileRpcProtocol._inflateData(request.parameters, data, header);
    return request;
  }

  /** Decodes a request from transport format. */
  public static decodeResponse(data: ArrayBuffer): RpcRequestFulfillment {
    const header = MobileRpcProtocol._decodeHeader(data);
    const objectString = MobileRpcProtocol._decodeObject(header, data);
    const fulfillment = JSON.parse(objectString) as RpcRequestFulfillment;
    MobileRpcProtocol._inflateData(fulfillment.result, data, header);
    return fulfillment;
  }

  private static _deflateData(value: RpcSerializedValue): void {
    value.data = value.data.map((v) => v.byteLength) as any[];
  }

  private static _inflateData(value: RpcSerializedValue, data: ArrayBuffer, offset: number): void {
    let i = offset + 4;
    for (let j = 0; j !== value.data.length; ++j) {
      const l = value.data[j] as any as number;
      value.data[j] = new Uint8Array(data, i, l);
      i += l;
    }
  }

  private static _decodeHeader(data: ArrayBuffer): number {
    return new DataView(data, 0, 4).getUint32(0);
  }

  private static _decodeObject(length: number, data: ArrayBuffer): string {
    return MobileRpcProtocol._decodeString(new Uint16Array(data, 4, length / 2));
  }

  private static _toBytes(data: ArrayBufferView): Uint8Array {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  private static _encode(object: string, data: Uint8Array[]): Uint8Array[] {
    const objectChars = MobileRpcProtocol._encodeString(object);

    const header = new DataView(new ArrayBuffer(4));
    header.setUint32(0, objectChars.byteLength);

    return [MobileRpcProtocol._toBytes(header), MobileRpcProtocol._toBytes(objectChars), ...data];
  }

  private static _decodeString(data: Uint16Array): string {
    return String.fromCharCode.apply(null, data);
  }

  private static _encodeString(value: string): Uint16Array {
    const data = new Uint16Array(new ArrayBuffer(value.length * 2));
    for (let i = 0; i !== value.length; ++i) {
      data[i] = value.charCodeAt(i);
    }

    return data;
  }

  /** Constructs an Mobile protocol. */
  constructor(configuration: MobileRpcConfiguration, endPoint: RpcEndpoint) {
    super(configuration);

    interface MobileGateway {
      handler: (payload: ArrayBuffer) => void;
      send: (message: Uint8Array[]) => void;
      port: number;
    }

    // Initialize for frontend
    if (endPoint === RpcEndpoint.Frontend) {
      if (typeof (WebSocket) === "undefined") {
        throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on frontend require websocket to work");
      }

      this.socket = new WebSocket(`ws://localhost:${window.location.hash.substr(1)}`);
      this.socket.addEventListener("message", async (event) => {
        const buf = await RpcMultipart.readFormBlob(event.data);
        const response = MobileRpcProtocol.decodeResponse(buf);
        const request = this.requests.get(response.id) as MobileRpcRequest;
        this.requests.delete(response.id);
        request.notifyResponse(response);
      });

      this.socket.addEventListener("open", (_event) => {
        for (const pending of this.pending) {
          this.socket.send(pending);
        }
        this.pending = [];
      });
    }

    // Initialize for backend
    if (endPoint === RpcEndpoint.Backend) {
      const mobilegateway: MobileGateway = interop as MobileGateway;
      if (mobilegateway === undefined || mobilegateway == null) {
        throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on backend require native bridge to be setup");
      }

      mobilegateway.handler = async (payload) => {
        const request: SerializedRpcRequest = MobileRpcProtocol.decodeRequest(payload);
        const fulfillment = await this.fulfill(request);
        const response = MobileRpcProtocol.encodeResponse(fulfillment);
        mobilegateway.send(response);
      };

      (self as any).__imodeljs_mobilegateway_handler__ = mobilegateway.handler;
    }
  }
}
