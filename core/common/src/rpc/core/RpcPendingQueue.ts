/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcRequestEvent, RpcRequestStatus } from "./RpcConstants";
import { RpcRequest } from "./RpcRequest";

/** Manages pending RPC requests and responses.
 * @internal
 */
export class RpcPendingQueue {
  public static instance: RpcPendingQueue;

  public static initialize() {
    if (!RpcPendingQueue.instance) {
      RpcPendingQueue.instance = new RpcPendingQueue();
    }
  }

  private _pendingInterval: any = undefined;
  private _pending: RpcRequest[] = [];
  private _pendingLock: number = 0;

  private constructor() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    RpcRequest.events.addListener(this.requestEventHandler, this);
  }

  private requestEventHandler(type: RpcRequestEvent, request: RpcRequest): void {
    if (type !== RpcRequestEvent.StatusChanged)
      return;

    switch (request.status) {
      case RpcRequestStatus.Submitted: {
        this.enqueuePending(request);
        break;
      }

      case RpcRequestStatus.Resolved:
      case RpcRequestStatus.Rejected:
      case RpcRequestStatus.NotFound:
      case RpcRequestStatus.Cancelled: {
        this.dequeuePending(request);
        break;
      }
    }
  }

  private enqueuePending(request: RpcRequest) {
    this._pending.push(request);
    this.setPendingInterval();
  }

  private dequeuePending(request: RpcRequest) {
    if (this._pendingLock)
      return;

    const i = this._pending.indexOf(request);
    this._pending.splice(i, 1);
    this.clearPendingInterval();
  }

  private _pendingIntervalHandler = function (this: RpcPendingQueue) {
    const now = new Date().getTime();

    ++this._pendingLock;

    for (const request of this._pending) {
      const retry = request.retryAfter ?? request.retryInterval;
      if (request.connecting || (request.lastSubmitted + retry) > now) {
        continue;
      }

      request.submit(); // eslint-disable-line @typescript-eslint/no-floating-promises
    }

    --this._pendingLock;

    this.cleanupPendingQueue();
  }.bind(this);

  private cleanupPendingQueue() {
    if (this._pendingLock)
      return;

    let i = this._pending.length;
    while (i--) {
      if (!this._pending[i].pending && !RpcRequestStatus.isTransientError(this._pending[i].status)) {
        this._pending.splice(i, 1);
      }
    }

    this.clearPendingInterval();
  }

  private setPendingInterval() {
    if (this._pendingInterval)
      return;

    this._pendingInterval = setInterval(this._pendingIntervalHandler, 0);
  }

  private clearPendingInterval() {
    if (!this._pending.length) {
      clearInterval(this._pendingInterval);
      this._pendingInterval = undefined;
    }
  }
}
