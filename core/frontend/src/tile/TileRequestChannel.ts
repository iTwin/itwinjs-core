/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, PriorityQueue } from "@bentley/bentleyjs-core";
import { TileTreeContentIds } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";
import { IModelConnection } from "../IModelConnection";
import { IModelTile, Tile, TileRequest } from "./internal";

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
 * @beta
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

  public addTo(stats: TileRequestChannelStatistics): void {
    for (const propName in this) {
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

/**
 * @internal
 */
export class TileRequestChannel {
  public readonly name: string;
  private _maxActive: number;
  private readonly _active = new Set<TileRequest>();
  private _pending = new TileRequestQueue();
  private _previouslyPending = new TileRequestQueue();
  protected _statistics = new TileRequestChannelStatistics();

  public constructor(name:  string, maxActiveRequests: number) {
    this.name = name;
    this._maxActive = maxActiveRequests;
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

  public get statistics(): Readonly<TileRequestChannelStatistics> {
    this._statistics.numPendingRequests = this.numPending;
    this._statistics.numActiveRequests = this.numActive;
    return this._statistics;
  }

  public resetStatistics(): void {
    this._statistics = new TileRequestChannelStatistics();
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

  public cancelAndClearAll(): void {
    for (const active of this._active)
      active.cancel();

    for (const queued of this._pending)
      queued.cancel();

    this._active.clear();
    this._pending.clear();
  }

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

  /** Invoked when an iModel is closed, to clean up any state associated with that iModel. */
  public onIModelClosed(_iModel: IModelConnection): void { }

  public async requestContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response> {
    return tile.requestContent(isCanceled);
  }

  private dispatch(request: TileRequest): void {
    ++this._statistics.totalDispatchedRequests;
    this._active.add(request);
    request.dispatch(() => {
      this.dropActiveRequest(request);
    }).catch((_) => {
      //
    });
  }

  private cancel(request: TileRequest): void {
    request.cancel();
    ++this._statistics.numCanceled;
  }

  private dropActiveRequest(request: TileRequest): void {
    assert(this._active.has(request) || request.isCanceled);
    this._active.delete(request);
  }
}

class CloudStorageCacheChannel extends TileRequestChannel {
  public async requestContent(tile: Tile): Promise<TileRequest.Response> {
    assert(tile instanceof IModelTile);
    return IModelApp.tileAdmin.requestCachedTileContent(tile);
  }

  public onNoContent(request: TileRequest): boolean {
    // ###TODO: Mark tile as "not found in cache" so it uses RPC channel instead.
    assert(request.tile instanceof IModelTile);
    request.tile.cacheMiss = true;
    ++this._statistics.totalCacheMisses;
    return true;
  }
}

class IModelTileChannel extends TileRequestChannel {
  private readonly _canceled = new Map<IModelConnection, Map<string, Set<string>>>();

  public onActiveRequestCanceled(request: TileRequest): void {
    const tree = request.tile.tree;
    let entry = this._canceled.get(tree.iModel);
    if (!entry)
      this._canceled.set(tree.iModel, entry = new Map<string, Set<string>>());

    let ids = entry.get(tree.id);
    if (!ids)
      entry.set(tree.id, ids = new Set<string>());

    ids.add(request.tile.contentId);
  }

  public processCancellations(): void {
    for (const [imodel, entries] of this._canceled) {
      const treeContentIds: TileTreeContentIds[] = [];
      for (const [treeId, tileIds] of entries) {
        const contentIds = Array.from(tileIds);
        treeContentIds.push({ treeId, contentIds });
        this._statistics.totalAbortedRequests += contentIds.length;
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        IpcApp.callIpcHost("cancelTileContentRequests", imodel.getRpcProps(), treeContentIds);
    }

    this._canceled.clear();
  }

  public onIModelClosed(imodel: IModelConnection): void {
    this._canceled.delete(imodel);
  }
}

class ElementGraphicsChannel extends TileRequestChannel {
  private readonly _canceled = new Map<IModelConnection, string[]>();

  public onActiveRequestCanceled(request: TileRequest): void {
    const imodel = request.tile.tree.iModel;
    let ids = this._canceled.get(imodel);
    if (!ids)
      this._canceled.set(imodel, ids = []);

    ids.push(request.tile.contentId);
  }

  public processCancellations(): void {
    for (const [imodel, requestIds] of this._canceled) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IpcApp.callIpcHost("cancelElementGraphicsRequests", imodel.key, requestIds);
      this._statistics.totalAbortedRequests += requestIds.length;
    }

    this._canceled.clear();
  }

  public onIModelClosed(imodel: IModelConnection): void {
    this._canceled.delete(imodel);
  }
}

export class TileRequestChannels {
  private _cloudStorageCache?: TileRequestChannel;
  public readonly iModelTileRpc: TileRequestChannel;
  public readonly elementGraphicsRpc: TileRequestChannel;
  public readonly httpConcurrency = 6;
  private _rpcConcurrency: number;
  private readonly _channels = new Map<string, TileRequestChannel>();

  public constructor(rpcConcurrency: number, rpcUsesIpc: boolean) {
    this._rpcConcurrency = rpcConcurrency;

    const imodelChannelName = "requestTileContent";
    const elementGraphicsChannelName = "requestElementGraphics";
    if (rpcUsesIpc) {
      this.iModelTileRpc = new IModelTileChannel(imodelChannelName, rpcConcurrency);
      this.elementGraphicsRpc = new ElementGraphicsChannel(elementGraphicsChannelName, rpcConcurrency);
    } else {
      this.iModelTileRpc = new TileRequestChannel(imodelChannelName, rpcConcurrency);
      this.elementGraphicsRpc = new TileRequestChannel(elementGraphicsChannelName, rpcConcurrency);
    }

    this.add(this.iModelTileRpc);
    this.add(this.elementGraphicsRpc);
  }

  public get cloudStorageCache(): TileRequestChannel | undefined {
    return this._cloudStorageCache;
  }

  public enableCloudStorageCache(): void {
    assert(undefined === this._cloudStorageCache);
    if (!this._cloudStorageCache)
      this.add(this._cloudStorageCache = new CloudStorageCacheChannel("cloudStorageCache", this.httpConcurrency));
  }

  public get(name: string): TileRequestChannel | undefined {
    return this._channels.get(name);
  }

  public add(channel: TileRequestChannel): void {
    if (this.get(channel.name))
      throw new Error(`Tile request channel ${channel.name} is already registered.`);

    this._channels.set(channel.name, channel);
  }

  public delete(name: string): void {
    const channel = this.get(name);
    if (!channel)
      return;

    channel.cancelAndClearAll();
    this._channels.delete(name);
  }

  /** Extract the host name from a URL for use as the name of the corresponding [[TileRequestChannel]].
   * @throws TypeError if `url` is a string and does not represent a valid URL.
   */
  public static getNameFromUrl(url: URL | string): string {
    if (typeof url === "string")
      url = new URL(url);

    return url.hostname;
  }

  public getForHttp(name: string): TileRequestChannel {
    let channel = this.get(name);
    if (!channel)
      this.add(channel = new TileRequestChannel(name, this.httpConcurrency));

    return channel;
  }

  public [Symbol.iterator](): Iterator<TileRequestChannel> {
    return this._channels.values()[Symbol.iterator]();
  }

  public get rpcConcurrency(): number {
    return this._rpcConcurrency;
  }

  /** @internal */
  public setRpcConcurrency(concurrency: number): void {
    this._rpcConcurrency = concurrency;
  }

  public get statistics(): TileRequestChannelStatistics {
    const stats = new TileRequestChannelStatistics();
    for (const channel of this)
      channel.statistics.addTo(stats);

    return stats;
  }
}
