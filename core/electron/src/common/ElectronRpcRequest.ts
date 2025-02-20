/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RpcProtocolEvent, RpcRequest, RpcRequestFulfillment } from "@itwin/core-common";
import { ElectronRpcProtocol } from "./ElectronRpcProtocol";

/** @internal */
export class ElectronRpcRequest extends RpcRequest {
  private _res: (value: number) => void = () => undefined;
  private _fulfillment: RpcRequestFulfillment | undefined = undefined;

  /** Convenience access to the protocol of this request. */
  public override readonly protocol: ElectronRpcProtocol = this.client.configuration.protocol as any;

  /** Sends the request. */
  protected async send() {
    try {
      this.protocol.requests.set(this.id, this);
      const request = await this.protocol.serialize(this);
      this.protocol.transport.sendRequest(request);
    } catch {
      this.protocol.events.raiseEvent(RpcProtocolEvent.ConnectionErrorReceived, this); // eslint-disable-line @typescript-eslint/no-deprecated
    }

    return new Promise<number>((resolve) => {
      this._res = resolve;
    });
  }

  /** Loads the request. */
  protected async load() {
    const fulfillment = this._fulfillment;
    if (!fulfillment) {
      throw new Error("No request fulfillment available.");
    }

    return fulfillment.result;
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

  /** @internal */
  public override[Symbol.dispose]() {
    this.protocol.requests.delete(this.id);
    super[Symbol.dispose]();
  }
}
