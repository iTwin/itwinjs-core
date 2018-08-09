/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcRequest, RpcResponseType } from "../core/RpcRequest";
import { RpcProtocolEvent, RpcRequestFulfillment } from "../core/RpcProtocol";
import { ElectronRpcProtocol, CHANNEL, interop } from "./ElectronRpcProtocol";

export class ElectronRpcRequest extends RpcRequest {
  /** Convenience access to the protocol of this request. */
  public readonly protocol: ElectronRpcProtocol = this.client.configuration.protocol as any;

  /** The fulfillment of this request. */
  public fulfillment: RpcRequestFulfillment = { result: "", status: 0, id: "", interfaceName: "", type: RpcResponseType.Unknown };

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
    const result = this.fulfillment.result;
    if (typeof (result) === "string") {
      return result;
    } else {
      return super.getResponseText();
    }
  }

  /** Supplies response bytes. */
  public getResponseBytes(): Uint8Array {
    const result = this.fulfillment.result;
    if (typeof (result) !== "string") {
      return result;
    } else {
      return super.getResponseBytes();
    }
  }

  /** Supplies response type. */
  public getResponseType(): RpcResponseType {
    return this.fulfillment.type;
  }
}
