/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcMarshaling, RpcPushChannel, RpcPushConnection, RpcPushTransport, RpcRequestFulfillment } from "@itwin/core-common";
import { MobileEventLoop } from "./MobileEventLoop";
import { MobileRpcProtocol } from "./MobileRpcProtocol";

const PUSH = "__push__";

/** @internal */
export class MobilePushTransport extends RpcPushTransport {
  private _protocol: MobileRpcProtocol;
  private _last: number = -1;

  public get last() { return this._last; }

  public constructor(protocol: MobileRpcProtocol) {
    super();
    this._protocol = protocol;
  }

  public consume(response: RpcRequestFulfillment): boolean {
    if (response.interfaceName !== PUSH) {
      return false;
    }

    this._last = response.status;

    if (this.onMessage) {
      const messageData = RpcMarshaling.deserialize(this._protocol, response.result);
      this.onMessage(response.id, messageData);
    }

    return true;
  }
}

/** @internal */
export class MobilePushConnection<T> extends RpcPushConnection<T> {
  private _protocol: MobileRpcProtocol;
  private _next: number = -1;

  public constructor(channel: RpcPushChannel<T>, client: unknown, protocol: MobileRpcProtocol) {
    super(channel, client);
    this._protocol = protocol;
  }

  public async send(messageData: any) {
    MobileEventLoop.addTask();
    const result = await RpcMarshaling.serialize(this._protocol, messageData);
    MobileEventLoop.removeTask();

    const fulfillment: RpcRequestFulfillment = { result, rawResult: messageData, interfaceName: PUSH, id: this.channel.id, status: ++this._next };
    const encoded = MobileRpcProtocol.encodeResponse(fulfillment);
    this._protocol.sendToFrontend(encoded);
  }
}
