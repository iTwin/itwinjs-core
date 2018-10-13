/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcProtocol, RpcProtocolEvent, SerializedRpcRequest } from "../core/RpcProtocol";
import { MobileRpcConfiguration } from "./MobileRpcManager";
import { MobileRpcRequest } from "./MobileRpcRequest";
import { RpcRequestFulfillment } from "../core/RpcProtocol";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelError } from "../../IModelError";
/** @hidden */
declare var bentley: any;

/** @hidden */
export const CHANNEL = "@bentley/imodeljs-mobilegateway";

/** @hidden */
export const interop = (() => {
  let mobilegateway = null;

  if (typeof window === "undefined") {
    // tslint:disable-next-line:no-eval
    mobilegateway = bentley.imodeljs.servicesTier.require(CHANNEL);
  }

  return mobilegateway;
})();

/** EndPoint for the MobileRpcProtocol. */
export enum EndPoint {
  Frontend,
  Backend,
}

/** RPC interface protocol for an Mobile-based application. */
export class MobileRpcProtocol extends RpcProtocol {
  public socket: WebSocket = (undefined as any);
  public map: Map<string, MobileRpcRequest> = new Map();
  public pending: string[] = [];
  public readonly requestType = MobileRpcRequest;

  /** Constructs an Mobile protocol. */
  constructor(configuration: MobileRpcConfiguration, endPoint: EndPoint) {
    super(configuration);

    interface MobileResponse {
      id: string;
      fulfillment: RpcRequestFulfillment;
    }

    interface MobileGateway {
      handler: (payload: string) => void;
      send: (message: string) => void;
      port: number;
    }

    // Initialize for frontend
    if (endPoint === EndPoint.Frontend) {
      if (typeof (WebSocket) === "undefined") {
        throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on frontend require websocket to work");
      }

      this.socket = new WebSocket(`ws://localhost:${window.location.hash.substr(1)}`);
      this.socket.addEventListener("message", (event) => {
        const response: MobileResponse = JSON.parse(event.data);
        const request = this.map.get(response.id) as MobileRpcRequest;
        this.map.delete(response.id);
        request.fulfillment = response.fulfillment;
        this.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, request);
      });

      this.socket.addEventListener("open", (_event) => {
        for (const pending of this.pending) {
          this.socket.send(pending);
        }
        this.pending = [];
      });
    }

    // Initialize for backend
    if (endPoint === EndPoint.Backend) {
      const mobilegateway: MobileGateway = interop as MobileGateway;
      if (mobilegateway === undefined || mobilegateway == null) {
        throw new IModelError(BentleyStatus.ERROR, "MobileRpcProtocol on backend require native bridge to be setup");
      }

      mobilegateway.handler = async (payload) => {
        const request: SerializedRpcRequest = JSON.parse(payload);
        const fulfillment = await this.fulfill(request);
        const response: MobileResponse = { id: request.id, fulfillment };
        mobilegateway.send(JSON.stringify(response));
      };

      (self as any).__imodeljs_mobilegateway_handler__ = mobilegateway.handler;
    }
  }
}
