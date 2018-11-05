/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcRequest } from "./RpcRequest";
import { RpcRequestEvent, RpcRequestStatus } from "./RpcConstants";

/** Manages pending RPC requests and responses. */
export class RpcPendingQueue {
  /** @hidden */
  public static instance: RpcPendingQueue;

  /** @hidden */
  public static initialize() {
    if (!RpcPendingQueue.instance) {
      RpcPendingQueue.instance = new RpcPendingQueue();
    }
  }

  private _pendingInterval: any = undefined;
  private _pending: RpcRequest[] = [];
  private _pendingLock: number = 0;

  private constructor() {
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
      case RpcRequestStatus.NotFound: {
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
      if (request.connecting || (request.lastSubmitted + request.retryInterval) > now) {
        continue;
      }

      request.submit();
    }

    --this._pendingLock;

    this.cleanupPendingQueue();
  }.bind(this);

  private cleanupPendingQueue() {
    if (this._pendingLock)
      return;

    let i = this._pending.length;
    while (i--) {
      if (!this._pending[i].pending) {
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
