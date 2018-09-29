/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcRequestFulfillment } from "../core/RpcProtocol";
import { RpcRequest, RpcResponseType } from "../core/RpcRequest";
import { MobileRpcProtocol } from "./MobileRpcProtocol";

export class MobileRpcRequest extends RpcRequest {
  protected initializeChannel(): void { }
  protected setHeader(_name: string, _value: string): void { }

  /** Convenience access to the protocol of this request. */
  public readonly protocol: MobileRpcProtocol = this.client.configuration.protocol as any;

  /** The fulfillment of this request. */
  public fulfillment: RpcRequestFulfillment = { result: "", status: 0, id: "", interfaceName: "", type: RpcResponseType.Unknown };

  /** Sends the request. */
  protected send(): void {
    this.protocol.map.set(this.id, this);
    const serialized = JSON.stringify(this.protocol.serialize(this));
    if (this.protocol.socket.readyState === WebSocket.OPEN)
      this.protocol.socket.send(serialized);
    else
      this.protocol.pending.push(serialized);
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
