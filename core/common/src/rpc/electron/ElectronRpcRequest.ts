/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcRequest } from "../core/RpcRequest";
import { RpcRequestFulfillment } from "../core/RpcProtocol";
import { ElectronRpcProtocol, CHANNEL, interop } from "./ElectronRpcProtocol";
import { RpcProtocolEvent } from "../core/RpcConstants";

export class ElectronRpcRequest extends RpcRequest {
  private _response: (value: number) => void = () => undefined;
  private _fulfillment: RpcRequestFulfillment | undefined = undefined;

  /** Convenience access to the protocol of this request. */
  public readonly protocol: ElectronRpcProtocol = this.client.configuration.protocol as any;

  /** Sends the request. */
  protected send() {
    try {
      this.protocol.requests.set(this.id, this);
      const request = this.protocol.serialize(this);
      interop.ipcRenderer.send(CHANNEL, request);
    } catch (e) {
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionErrorReceived, this);
    }

    return new Promise<number>((resolve) => { this._response = resolve; });
  }

  /** Loads the request. */
  protected load() {
    const fulfillment = this._fulfillment;
    if (!fulfillment) {
      return Promise.reject("No request fulfillment available.");
    }

    return Promise.resolve(fulfillment.result);
  }

  /** Sets request header values. */
  protected setHeader(_name: string, _value: string): void {
    // No implementation
  }

  /** @hidden */
  public notifyResponse(fulfillment: RpcRequestFulfillment) {
    this._fulfillment = fulfillment;
    this._response(fulfillment.status);
  }
}
