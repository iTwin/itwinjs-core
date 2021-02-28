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
import { Tile, TileRequest } from "./internal";

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
  private readonly _active = new Set<TileRequest>();
  private _pending = new TileRequestQueue();
  private _previouslyPending = new TileRequestQueue();
  private _numDispatched = 0;
  private _numCanceled = 0;

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

class CloudStorageCacheChannel extends TileRequestChannel {
  public onNoContent(_request: TileRequest): boolean {
    // ###TODO: Mark tile as "not found in cache" so it uses RPC channel instead.
    // ###TODO: store this on each channel instead?
    IModelApp.tileAdmin.onCacheMiss();
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
        // ###TODO add to totalAbortedRequests
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
      // ###TODO add to totalAbortedRequests
    }

    this._canceled.clear();
  }

  public onIModelClosed(imodel: IModelConnection): void {
    this._canceled.delete(imodel);
  }
}

export class TileRequestChannels {
  public readonly cloudStorageCache?: TileRequestChannel;
  public readonly iModelTileRpc: TileRequestChannel;
  public readonly elementGraphicsRpc: TileRequestChannel;
  public readonly httpConcurrency = 6;
  private _rpcConcurrency: number;
  private readonly _channels = new Map<string, TileRequestChannel>();

  public constructor(rpcConcurrency: number, rpcUsesIpc: boolean) {
    this._rpcConcurrency = rpcConcurrency;

    // ###TODO: leave undefined if no cloud storage tile cache is configured.
    this.add(this.cloudStorageCache = new CloudStorageCacheChannel("cloudStorageCache", this.httpConcurrency))

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

  public [Symbol.iterator](): Iterable<TileRequestChannel> {
    return this._channels.values()[Symbol.iterator]();
  }

  public get rpcConcurrency(): number {
    return this._rpcConcurrency;
  }

  /** @internal */
  public setRpcConcurrency(concurrency: number): void {
    this._rpcConcurrency = concurrency;
  }
}
