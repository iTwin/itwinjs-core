/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcRequest } from "../core/RpcRequest";
import { RpcRequestFulfillment } from "../core/RpcProtocol";
import { ElectronRpcProtocol } from "./ElectronRpcProtocol";
import { RpcProtocolEvent } from "../core/RpcConstants";
import { ipcTransport } from "./ElectronIpcTransport";

export class ElectronRpcRequest extends RpcRequest {
  private _res: (value: number) => void = () => undefined;
  private _fulfillment: RpcRequestFulfillment | undefined = undefined;

  /** Convenience access to the protocol of this request. */
  public readonly protocol: ElectronRpcProtocol = this.client.configuration.protocol as any;

  /** Sends the request. */
  protected async send() {
    try {
      this.protocol.requests.set(this.id, this);
      const request = await this.protocol.serialize(this);
      ipcTransport!.sendRequest(request);
    } catch (e) {
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionErrorReceived, this);
    }

    return new Promise<number>((resolve) => { this._res = resolve; });
  }

  /** Loads the request. */
  protected async load() {
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

  /** @internal */
  public notifyResponse(fulfillment: RpcRequestFulfillment) {
    this._fulfillment = fulfillment;
    this._res(fulfillment.status);
  }
}
