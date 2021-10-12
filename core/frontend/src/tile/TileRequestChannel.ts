/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, PriorityQueue } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { Tile, TileContent, TileRequest } from "./internal";

class TileRequestQueue extends PriorityQueue<TileRequest> {
  public constructor() {
    super((lhs, rhs) => {
      const diff = lhs.tile.tree.loadPriority - rhs.tile.tree.loadPriority;
      return 0 !== diff ? diff : lhs.priority - rhs.priority;
    });
  }
}

/** Statistics regarding the current and cumulative state of one or more [[TileRequestChannel]]s. Useful for monitoring performance and diagnosing problems.
 * @see [[TileRequestChannel.statistics]] for a specific channel's statistics.
 * @see [[TileRequestChannels.statistics]] for statistics from all channels.
 * @see [[TileAdmin.statistics]] for additional statistics.
 * @public
 */
export class TileRequestChannelStatistics {
  /** The number of queued requests that have not yet been dispatched. */
  public numPendingRequests = 0;
  /** The number of requests that have been dispatched but not yet completed. */
  public numActiveRequests = 0;
  /** The number of requests canceled during the most recent update. */
  public numCanceled = 0;
  /** The total number of completed requests during this session. */
  public totalCompletedRequests = 0;
  /** The total number of failed requests during this session. */
  public totalFailedRequests = 0;
  /** The total number of timed-out requests during this session. */
  public totalTimedOutRequests = 0;
  /** The total number of completed requests during this session which produced an empty tile.
   * These tiles also contribute to [[totalCompletedRequests]], but not to [[totalUndisplayableTiles]].
   */
  public totalEmptyTiles = 0;
  /** The total number of completed requests during this session that produced an undisplayable tile.
   * These tiles also contribute to [[totalCompletedRequests]], but not to [[totalEmptyTiles]].
   */
  public totalUndisplayableTiles = 0;
  /** The total number of tiles whose contents were not found in cloud storage cache and therefore resulted in a backend request to generate the tile content. */
  public totalCacheMisses = 0;
  /** The total number of tiles for which content requests were dispatched. */
  public totalDispatchedRequests = 0;
  /** The total number of tiles for which content requests were dispatched and then canceled on the backend before completion. */
  public totalAbortedRequests = 0;

  /** @internal */
  public addTo(stats: TileRequestChannelStatistics): void {
    for (const propName in this) { // eslint-disable-line guard-for-in
      const key = propName as keyof TileRequestChannelStatistics;
      const val = this[key];
      if (typeof val === "number") {
        // This type guard ought to suffice but doesn't.
        assert(typeof stats[key] === "number");
        (stats[key] as number) += val;
      }
    }
  }
}

/** A channel over which requests for tile content can be made. The channel may request content over HTTP, calls to the backend via IPC or RPC, or any other method like generating the content
 * on the frontend. The channel consists of a queue of pending requests and a set of "active" requests (dispatched and awaiting a response). Incoming requests are placed onto the queue. Requests are popped of the queue in order of priority and dispatched, until the maximum number of simultaneously-active requests is reached.
 * The maximum number of active requests depends on the transport mechanism. For HTTP 1.1, browsers impose a limit of 6 simultaneous connections to a given domain, so ideally each unique domain will use its own unique channel with a limit of 6 active requests. Even for requests satisfied entirely by the frontend, imposing a limit is important for throttling the amount of work done at one time, especially because as the user navigates the view, tiles that were previously requested may no longer be of interest and we shouldn't waste resources producing their content.
 * A channel must be registered with [[TileRequestChannels]] and must have a unique name among all registered channels.
 * @see [[TileRequestChannels.getForHttp]] to obtain (and register if not already registered) an HTTP-based channel.
 * @see [[TileAdmin.channels]] for the channels configured for use with the iTwin.js display system.
 * @see [[Tile.channel]] to specify the channel to be used to request a given tile's content.
 * @public
 */
export class TileRequestChannel {
  /** The channel's name. It must be unique among all registered [[TileRequestChannels]]. */
  public readonly name: string;
  private _concurrency: number;
  /** Protected strictly for tests. @internal */
  protected readonly _active = new Set<TileRequest>();
  private _pending = new TileRequestQueue();
  private _previouslyPending = new TileRequestQueue();
  protected _statistics = new TileRequestChannelStatistics();
  /** Callback invoked by recordCompletion. See IModelTileMetadataCacheChannel.
   * @internal
   */
  public contentCallback?: (tile: Tile, content: TileContent) => void;

  /** Create a new channel.
   * @param name The unique name of the channel.
   * @param concurrency The maximum number of requests that can be dispatched and awaiting a response at any given time. Requests beyond this maximum are enqueued for deferred dispatch.
   * @see [[TileRequestChannels.getForHttp]] to create an HTTP-based channel.
   */
  public constructor(name: string, concurrency: number) {
    this.name = name;
    this._concurrency = concurrency;
  }

  /** The maximum number of active requests. This is generally only modified for debugging purposes.
   * @note When reducing `concurrency`, the number of active requests ([[numActive]]) will only decrease to the new value after a sufficient number of dispatched requests are resolved.
   */
  public get concurrency(): number {
    return this._concurrency;
  }
  public set concurrency(max: number) {
    this._concurrency = max;
  }

  /** The number of requests that have been dispatched and are awaiting a response. */
  public get numActive(): number {
    return this._active.size;
  }

  /** The number of requests that have been enqueued for later dispatch. */
  public get numPending(): number {
    return this._pending.length;
  }

  /** The total number of requests in this channel, whether dispatched or enqueued. */
  public get size(): number {
    return this.numActive + this.numPending;
  }

  /** Statistics intended primarily for debugging. */
  public get statistics(): Readonly<TileRequestChannelStatistics> {
    this._statistics.numPendingRequests = this.numPending;
    this._statistics.numActiveRequests = this.numActive;
    return this._statistics;
  }

  /** Reset all of this channel's [[statistics]] to zero. */
  public resetStatistics(): void {
    this._statistics = new TileRequestChannelStatistics();
  }

  /** Invoked by [[TileRequest]] when a request times out.
   * @internal
   */
  public recordTimeout(): void {
    ++this._statistics.totalTimedOutRequests;
  }

  /** Invoked by [[TileRequest]] when a request fails to produce a response.
   * @internal
   */
  public recordFailure(): void {
    ++this._statistics.totalFailedRequests;
  }

  /** Invoked by [[TileRequest]] after a request completes.
   * @internal
   */
  public recordCompletion(tile: Tile, content: TileContent): void {
    ++this._statistics.totalCompletedRequests;
    if (tile.isEmpty)
      ++this._statistics.totalEmptyTiles;
    else if (!tile.isDisplayable)
      ++this._statistics.totalUndisplayableTiles;

    if (this.contentCallback)
      this.contentCallback(tile, content);
  }

  /** Invoked by [[TileRequestChannels.swapPending]] when [[TileAdmin]] is about to start enqueuing new requests.
   * @internal
   */
  public swapPending(): void {
    const previouslyPending = this._pending;
    this._pending = this._previouslyPending;
    this._previouslyPending = previouslyPending;
  }

  /** Invoked by [[TileAdmin.processRequests]] to enqueue a request. Ordering is ignored - the queue will be re-sorted later.
   * @internal
   */
  public append(request: TileRequest): void {
    assert(request.channel === this);
    this._pending.append(request);
  }

  /** Invoked by [[TileRequestChannels.process]] to process the active and pending requests.
   * @internal
   */
  public process(): void {
    this._statistics.numCanceled = 0;

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

    // Batch-cancel running requests.
    this.processCancellations();

    // Dispatch requests from the queue up to our maximum.
    while (this._active.size < this._concurrency) {
      const request = this._pending.pop();
      if (!request)
        break;

      this.dispatch(request);
    }
  }

  /** Cancel all active and queued requests and clear the active set and queue.
   * @internal
   */
  public cancelAndClearAll(): void {
    for (const active of this._active)
      active.cancel();

    for (const queued of this._pending)
      queued.cancel();

    this._active.clear();
    this._pending.clear();
  }

  /** Invoked when [[Tile.requestContent]] returns `undefined`. Return true if the request can be retried, e.g., via different channel.
   * If so, the tile will remain marked as "not loaded" and, if re-selected for display, a new [[TileRequest]] will be enqueued for it.
   * Otherwise, the tile will be marked as "failed to load" and no further requests will be made for its content.
   * The default implementation always returns `false`.
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

  /** Invoked when an iModel is closed, to clean up any state associated with that iModel. */
  public onIModelClosed(_iModel: IModelConnection): void { }

  /** Request content for the specified tile. The default implementation simply forwards to [[Tile.requestContent]]. */
  public async requestContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response> {
    return tile.requestContent(isCanceled);
  }

  /** Protected only for tests - do not override.
   * @internal
   */
  protected dispatch(request: TileRequest): void {
    ++this._statistics.totalDispatchedRequests;
    this._active.add(request);
    request.dispatch(() => {
      this.dropActiveRequest(request);
    }).catch((_) => {
      //
    });
  }

  /** Protected only for tests - do not override.
   * @internal
   */
  protected cancel(request: TileRequest): void {
    request.cancel();
    ++this._statistics.numCanceled;
  }

  /** Protected only for tests - do not override.
   * @internal
   */
  protected dropActiveRequest(request: TileRequest): void {
    assert(this._active.has(request) || request.isCanceled);
    this._active.delete(request);
  }
}
