/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import type { RpcPushChannel, RpcRequestFulfillment } from "@itwin/core-common";
import { RpcMarshaling, RpcPushConnection, RpcPushTransport } from "@itwin/core-common";
import type { BackendIpcTransport, FrontendIpcTransport } from "./ElectronIpcTransport";

const PUSH = "__push__";

/** @internal */
export class ElectronPushTransport extends RpcPushTransport {
  private _ipc: FrontendIpcTransport;
  private _last: number = -1;

  public get last() { return this._last; }

  public constructor(ipc: FrontendIpcTransport) {
    super();
    this._ipc = ipc;
  }

  public consume(response: RpcRequestFulfillment): boolean {
    if (response.interfaceName !== PUSH) {
      return false;
    }

    this._last = response.status;

    if (this.onMessage) {
      const messageData = RpcMarshaling.deserialize(this._ipc.protocol, response.result);
      this.onMessage(response.id, messageData);
    }

    return true;
  }
}

/** @internal */
export class ElectronPushConnection<T> extends RpcPushConnection<T> {
  private _ipc: BackendIpcTransport;
  private _next: number = -1;

  public constructor(channel: RpcPushChannel<T>, client: unknown, ipc: BackendIpcTransport) {
    super(channel, client);
    this._ipc = ipc;
  }

  public async send(messageData: any) {
    const result = await RpcMarshaling.serialize(this._ipc.protocol, messageData);
    const fulfillment: RpcRequestFulfillment = { result, rawResult: messageData, interfaceName: PUSH, id: this.channel.id, status: ++this._next };
    this._ipc.sendResponse(fulfillment, undefined);
  }
}
