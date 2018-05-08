/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcRequest } from "../core/RpcRequest";
import { RpcProtocolEvent, RpcRequestFulfillment } from "../core/RpcProtocol";
import { ElectronRpcProtocol, CHANNEL, interop } from "./ElectronRpcProtocol";

export class ElectronRpcRequest extends RpcRequest {
  /** Convenience access to the protocol of this request. */
  public readonly protocol: ElectronRpcProtocol = this.interfaceInstance.configuration.protocol as any;

  /** The fulfillment of this request. */
  public fulfillment: RpcRequestFulfillment = { result: "", status: 0, id: "", interfaceName: "" };

  /** Sends the request. */
  protected send(): void {
    try {
      const request = this.protocol.serialize(this);
      interop.ipcRenderer.send(CHANNEL, request);
    } catch (e) {
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionErrorReceived, this);
    }
  }

  /** Supplies response status code. */
  public getResponseStatusCode(): number {
    return this.fulfillment.status;
  }

  /** Supplies response text. */
  public getResponseText(): string {
    return this.fulfillment.result || "";
  }
}
