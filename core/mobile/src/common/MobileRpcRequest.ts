/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterface, RpcRequest, RpcRequestFulfillment, RpcSerializedValue } from "@itwin/core-common";
import { MobileRpcProtocol } from "./MobileRpcProtocol";

/** @internal */
export class MobileRpcRequest extends RpcRequest {
  private _res: (value: number) => void = () => undefined;
  private _rejectSend?: (reason: unknown) => void;
  private _fulfillment: RpcRequestFulfillment | undefined = undefined;
  private _generation = 0;

  /** Convenience access to the protocol of this request. */
  public override readonly protocol: MobileRpcProtocol;

  public constructor(client: RpcInterface, operation: string, parameters: any[], protocol = client.configuration.protocol as MobileRpcProtocol) {
    super(client, operation, parameters);
    this.protocol = protocol;
  }

  public override cancel(): void {
    ++this._generation;
    super.cancel();
    this.protocol.cancelRequest(this);
    this._rejectSend = undefined;
  }

  protected override async setHeaders(): Promise<void> {
    const generation = this._generation;
    await super.setHeaders();
    if (generation !== this._generation || RpcRequest.activeRequests.get(this.id) !== this)
      throw new Error("Mobile RPC submission canceled.");
  }

  /** Sends the request. */
  protected async send(): Promise<number> {
    if (RpcRequest.activeRequests.get(this.id) !== this)
      throw new Error("Mobile RPC submission canceled.");

    return new Promise<number>((resolve, reject) => {
      this._res = resolve;
      this._rejectSend = reject;
      this.protocol.requests.set(this.id, this);
      MobileRpcProtocol.encodeRequest(this).then((parts) => {
        if (this.protocol.requests.get(this.id) === this && this._rejectSend === reject)
          this.protocol.sendToBackend(parts, this);
      }).catch((error: unknown) => {
        if (this._rejectSend === reject)
          this.protocol.requests.delete(this.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  public notifyConnectionError(error: Error): void {
    const rejectSend = this._rejectSend;
    this.cancel();
    this.reject(error);
    rejectSend?.(error);
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
