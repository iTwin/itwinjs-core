/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, PriorityQueue } from "@bentley/bentleyjs-core";
import { Tile, TileRequest } from "./internal";

/**
 * @beta
 */
export class TileRequestChannelHooks {
  /** Invoked when `Tile.requestContent` returns `undefined`. Return true if the request can be retried, e.g., via different channel.
   * If so, the tile will remain marked as "not loaded" and, if re-selected for display, a new TileRequest will be enqueued for it.
   * Otherwise, the tile will be marked as "failed to load" and no further requests will be made for its content.
   */
  public onNoContent(_request: TileRequest): boolean {
    return false;
  }

  /** Invoked when a request that was previously dispatched is canceled before a response is received.
   * Some channels accumulate such requests for later cancellation in [[processCancellations]].
   */
  public onActiveRequestCanceled(_request: TileRequest): void { }

  /** Invoked to do any additional work to cancel tiles accumulated by [[onActiveRequestCanceled]]. For example, a channel that requests tile content
   * over IPC may signal to the tile generation process that it should cease generating content for those tiles.
   */
  public processCancellations(): void { }
}

/**
 * @beta
 */
export interface TileRequestChannelProps {
  name: string;
  throttle: number | "http" | "rpc";
  hooks?: TileRequestChannelHooks;
}

class TileRequestQueue extends PriorityQueue<TileRequest> {
  public constructor() {
    super((lhs, rhs) => {
      const diff = lhs.tile.tree.loadPriority - rhs.tile.tree.loadPriority;
      return 0 !== diff ? diff : lhs.priority - rhs.priority;
    });
  }
}

/**
 * @internal
 */
export class TileRequestChannel {
  public readonly name: string;
  private _maxActive: number;
  private readonly _hooks?: TileRequestChannelHooks;
  private readonly _active = new Set<TileRequest>();
  private _pending = new TileRequestQueue();
  private _previouslyPending = new TileRequestQueue();
  private _numDispatched = 0;
  private _numCanceled = 0;

  public constructor(name:  string, maxActiveRequests: number, hooks?: TileRequestChannelHooks) {
    this.name = name;
    this._maxActive = maxActiveRequests;
    this._hooks = hooks;
  }

  public get numActive(): number {
    return this._active.size;
  }

  public get numPending(): number {
    return this._pending.length;
  }

  public get size(): number {
    return this.numActive + this.numPending;
  }

  public get totalDispatched(): number {
    return this._numDispatched;
  }

  public get totalCanceled(): number {
    return this._numCanceled;
  }

  public resetStatistics(): void {
    this._numDispatched = this._numCanceled = 0;
  }

  public swapPending(): void {
    const previouslyPending = this._pending;
    this._pending = this._previouslyPending;
    this._previouslyPending = previouslyPending;
  }

  public append(request: TileRequest): void {
    // ###TODO assert(request.channel === this);
    this._pending.append(request);
  }

  public process(): void {
    // Recompute priority of each request.
    for (const pending of this._pending)
      pending.priority = pending.tile.computeLoadPriority(pending.viewports);

    // Sort pending requests by priority.
    this._pending.sort();

    // Cancel any previously pending requests that are no longer needed.
    for (const queued of this._previouslyPending)
      if (queued.viewports.isEmpty)
        this.cancel(queued);

    this._previouslyPending.clear();

    // Cancel any active requests that are no longer needed.
    // NB: Do NOT remove them from the active set until their http activity has completed.
    for (const active of this._active)
      if (active.viewports.isEmpty)
        this.cancel(active);
  }

  public fill(): void {
    while (this._active.size < this._maxActive) {
      const request = this._pending.pop();
      if (!request)
        break;
      else
        this.dispatch(request);
    }
  }

  public onNoContent(request: TileRequest): boolean {
    return this._hooks ? this._hooks.onNoContent(request) : false;
  }

  public onActiveRequestCanceled(request: TileRequest): void {
    this._hooks?.onActiveRequestCanceled(request);
  }

  public processCancellations(): void {
    this._hooks?.processCancellations();
  }

  public cancelAndClearAll(): void {
    for (const active of this._active)
      active.cancel();

    for (const queued of this._pending)
      queued.cancel();

    this._active.clear();
    this._pending.clear();
  }

  private dispatch(request: TileRequest): void {
    ++this._numDispatched;
    this._active.add(request);
    request.dispatch(() => {
      this.dropActiveRequest(request);
    }).catch((_) => {
      //
    });
  }

  private cancel(request: TileRequest): void {
    request.cancel();
    ++this._numCanceled;
  }

  private dropActiveRequest(request: TileRequest): void {
    assert(this._active.has(request) || request.isCanceled);
    this._active.delete(request);
  }
}
