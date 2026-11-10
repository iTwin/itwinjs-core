/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcRequest, RpcRequestFulfillment, RpcSerializedValue } from "@itwin/core-common";
import { MobileRpcProtocol } from "./MobileRpcProtocol";

/** @internal */
export class MobileRpcRequest extends RpcRequest {
  private _res: (value: number) => void = () => undefined;
  private _rejectSend?: (reason: unknown) => void;
  private _fulfillment: RpcRequestFulfillment | undefined = undefined;

  /** Convenience access to the protocol of this request. */
  public override readonly protocol: MobileRpcProtocol = this.client.configuration.protocol as any;

  /** Sends the request. */
  protected async send(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this._res = resolve;
      this._rejectSend = reject;
      this.protocol.requests.set(this.id, this);
      MobileRpcProtocol.encodeRequest(this).then((parts) => {
        if (this.protocol.requests.get(this.id) === this && this._rejectSend === reject)
          this.protocol.sendToBackend(parts);
      }).catch((error: unknown) => {
        if (this._rejectSend === reject)
          this.protocol.requests.delete(this.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  public notifyConnectionError(error: Error): void {
    this.cancel();
    this.reject(error);
    this._rejectSend?.(error);
    this._rejectSend = undefined;
  }

  /** Loads the request. */
  protected async load(): Promise<RpcSerializedValue> {
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
}
