/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcRequestFulfillment } from "../core/RpcProtocol";
import { RpcRequest } from "../core/RpcRequest";
import { MobileRpcProtocol } from "./MobileRpcProtocol";
import { RpcSerializedValue } from "../core/RpcMarshaling";

export class MobileRpcRequest extends RpcRequest {
  private _res: (value: number) => void = () => undefined;
  private _fulfillment: RpcRequestFulfillment | undefined = undefined;

  /** Convenience access to the protocol of this request. */
  public readonly protocol: MobileRpcProtocol = this.client.configuration.protocol as any;

  /** Sends the request. */
  protected async send(): Promise<number> {
    this.protocol.requests.set(this.id, this);
    const parts = await MobileRpcProtocol.encodeRequest(this);
    this.protocol.sendToBackend(parts);
    return new Promise<number>((resolve) => { this._res = resolve; });
  }

  /** Loads the request. */
  protected async load(): Promise<RpcSerializedValue> {
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
