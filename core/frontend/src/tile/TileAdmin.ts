/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { TileRequest } from "./TileRequest";
import { Tile } from "./TileTree";
import { Dictionary, SortedArray, PriorityQueue, assert } from "@bentley/bentleyjs-core";
import { RpcOperation, IModelTileRpcInterface, TileTreeProps } from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";
import { IModelConnection } from "../IModelConnection";

/** Provides functionality associated with [[Tile]]s, mostly in the area of scheduling requests for tile content.
 * The TileAdmin tracks [[Viewport]]s which have requested tile content, maintaining a priority queue of pending requests and
 * a set of active requests. On each update it identifies previously-requested tiles whose content no viewport is interested in any longer and
 * cancels them. It then pulls pending requests off the queue and dispatches them into the active set until either the maximum number of
 * simultaneously-active requests is reached or the queue becomes empty.
 * @hidden
 */
export abstract class TileAdmin {
  public abstract get emptyViewportSet(): TileAdmin.ViewportSet;
  /** Returns basic statistics about the TileAdmin's current state. */
  public abstract get statistics(): TileAdmin.Statistics;
  /** Resets the cumulative (per-session) statistics like totalCompletedRequests, totalEmptyTiles, etc. */
  public abstract resetStatistics(): void;

  /** Controls the maximum number of simultaneously-active requests allowed.
   * If the maximum is reduced below the current size of the active set, no active requests will be canceled - but no more will be dispatched until the
   * size of the active set falls below the new maximum.
   * @see [[TileAdmin.Props.maxActiveRequests]]
   * @note Browsers impose their own limitations on maximum number of total connections, and connections per-domain. These limitations are
   * especially strict when using HTTP1.1 instead of HTTP2. Increasing the maximum above the default may significantly affect performance as well as
   * bandwidth and memory consumption.
   */
  public abstract set maxActiveRequests(max: number);
  public abstract get maxActiveRequests(): number;

  /** @hidden */
  public abstract get enableInstancing(): boolean;
  /** @hidden */
  public abstract get elideEmptyChildContentRequests(): boolean;

  /** Returns the union of the input set and the input viewport. */
  public abstract getViewportSet(vp: Viewport, vps?: TileAdmin.ViewportSet): TileAdmin.ViewportSet;
  /** Invoked from the [[ToolAdmin]] event loop to process any pending or active requests for tiles. */
  public abstract process(): void;
  /** Specifies the set of tiles currently requested for use by a viewport. This set replaces any previously specified for the same viewport.
   * The requests are not actually processed until the next call to [[TileAdmin.process].
   * This is typically invoked when the viewport recreates its scene, e.g. in response to camera movement.
   */
  public abstract requestTiles(vp: Viewport, tiles: Set<Tile>): void;
  /** Returns the number of pending and active requests associated with the specified viewport. */
  public abstract getNumRequestsForViewport(vp: Viewport): number;
  /** Indicates that the TileAdmin should cease tracking the specified viewport, e.g. because it is about to be destroyed.
   * Any requests which are of interest only to the specified viewport will be canceled.
   */
  public abstract forgetViewport(vp: Viewport): void;
  public abstract onShutDown(): void;

  public abstract async requestTileTreeProps(iModel: IModelConnection, treeId: string): Promise<TileTreeProps>;
  public abstract async requestTileContent(iModel: IModelConnection, treeId: string, contentId: string): Promise<Uint8Array>;

  public static create(props?: TileAdmin.Props): TileAdmin {
    return new Admin(props);
  }

  public abstract onTileCompleted(tile: Tile): void;
  public abstract onTileTimedOut(tile: Tile): void;
  public abstract onTileFailed(tile: Tile): void;
  public abstract onTileElided(): void;
}

/** @hidden */
export namespace TileAdmin {
  export interface Statistics {
    /** The number of requests in the queue which have not yet been dispatched. */
    numPendingRequests: number;
    /** The number of requests which have been dispatched but not yet completed. */
    numActiveRequests: number;
    /** The number of requests canceled during the most recent update. */
    numCanceled: number;
    /** The total number of completed requests during this session. */
    totalCompletedRequests: number;
    /** The total number of failed requests during this session. */
    totalFailedRequests: number;
    /** The total number of timed-out requests during this session. */
    totalTimedOutRequests: number;
    /** The total number of completed requests during this session which produced an empty tile. These tiles also contribute to totalCompletedRequests, but not to totalUndisplayableTiles. */
    totalEmptyTiles: number;
    /** The total number of completed requests during this session which produced an undisplayable tile. These tiles also contribute to totalCompletedRequests, but not to totalEmptyTiles. */
    totalUndisplayableTiles: number;
    /** The total number of tiles whose contents were not requested during this session because their volumes were determined to be empty. */
    totalElidedTiles: number;
  }

  /** Describes configuration of a [[TileAdmin]].
   * @see [[TileAdmin.create]]
   */
  export interface Props {
    /** The maximum number of simultaneously-active requests. Any requests beyond this maximum are placed into a priority queue.
     *
     * Default value: 10
     */
    maxActiveRequests?: number;

    /** If true, the [[TileAdmin]] will immediately dispatch all requests, bypassing the throttling imposed by maxActiveRequests.
     * This is not recommended - it eliminates any ability to cancel requests for tiles which are no longer needed, and will swamp
     * the network with requests.
     *
     * Default value: false
     * @note If this is defined and true, `maxActiveRequests` is ignored.
     */
    disableThrottling?: boolean;

    /** If true, tiles may represent repeated geometry as sets of instances. This can reduce tile size and tile generation time, and improve performance.
     *
     * Default value: false
     */
    enableInstancing?: boolean;

    /** If defined, requests for tile content or tile tree properties will be memoized and retried at the specified interval in milliseconds */
    retryInterval?: number;

    /** If true, requests for content of a child tile will be elided if the child tile's range can be determined to be empty
     * based on metadata embedded in the parent's content.
     *
     * Default value: false
     */
    elideEmptyChildContentRequests?: boolean;
  }

  /** A set of [[Viewport]]s.
   * ViewportSets are managed and cached by [[TileAdmin]] such that any number of [[TileRequest]]s associated with the same set of viewports will
   * use the same ViewportSet object.
   */
  export class ViewportSet extends SortedArray<Viewport> {
    public constructor(vp?: Viewport) {
      super((lhs, rhs) => lhs.viewportId - rhs.viewportId);
      if (undefined !== vp)
        this.insert(vp);
    }

    public clone(out?: ViewportSet): ViewportSet {
      if (undefined === out)
        out = new ViewportSet();
      else
        out.clear();

      for (let i = 0; i < this.length; i++)
        out._array.push(this._array[i]);

      return out;
    }
  }
}

function compareTilePriorities(lhs: Tile, rhs: Tile): number {
  let diff = lhs.loader.priority - rhs.loader.priority;
  if (0 === diff) {
    diff = lhs.loader.compareTilePriorities(lhs, rhs);
  }

  return diff;
}

class Queue extends PriorityQueue<TileRequest> {
  public constructor() {
    super((lhs, rhs) => compareTilePriorities(lhs.tile, rhs.tile));
  }

  public has(request: TileRequest): boolean {
    return this._array.indexOf(request) >= 0;
  }
}

function compareViewportSets(lhs: TileAdmin.ViewportSet, rhs: TileAdmin.ViewportSet): number {
  if (lhs === rhs)
    return 0;

  let diff = lhs.length - rhs.length;
  if (0 === diff) {
    for (let i = 0; i < lhs.length; i++) {
      const lhvp = lhs.get(i)!;
      const rhvp = rhs.get(i)!;
      diff = lhvp.viewportId - rhvp.viewportId;
      if (0 !== diff)
        break;
    }
  }

  return diff;
}

// The scheduler needs to know about all viewports which have tile requests.
// Each request needs to know the set of viewports for which it has been requested.
// We don't want to duplicate the latter per-Request - in addition to wasting memory, that would
// also require us to traverse all requests whenever a viewport becomes un-tracked in order to remove it from their sets.
// This class holds unique sets of viewports and doles them out to Requests.
class UniqueViewportSets extends SortedArray<TileAdmin.ViewportSet> {
  public readonly emptySet = new TileAdmin.ViewportSet();
  private readonly _scratchSet = new TileAdmin.ViewportSet();

  public constructor() {
    super((lhs, rhs) => compareViewportSets(lhs, rhs));
    Object.freeze(this.emptySet);
  }

  public eraseAt(index: number): void {
    assert(index < this.length && index >= 0);
    this._array.splice(index, 1);
  }

  public getForViewport(vp: Viewport): TileAdmin.ViewportSet {
    for (let i = 0; i < this.length; i++) {
      const set = this._array[i];
      if (1 === set.length && set.get(0)! === vp)
        return set;
    }

    const newSet = new TileAdmin.ViewportSet(vp);
    this.insert(newSet);
    return newSet;
  }

  public getViewportSet(vp: Viewport, vps?: TileAdmin.ViewportSet): TileAdmin.ViewportSet {
    if (undefined === vps || vps.isEmpty)
      return this.getForViewport(vp);

    // Use the scratch set for equality comparison - only allocate if no equivalent set already exists.
    const toFind = vps.clone(this._scratchSet);
    toFind.insert(vp);
    const found = this.findEqual(toFind);
    if (undefined !== found) {
      toFind.clear();
      return found;
    }

    const newSet = toFind.clone();
    toFind.clear();
    this.insert(newSet);
    return newSet;
  }

  public clearAll(): void {
    this.forEach((set) => set.clear());
    this.clear();
  }
}

class RequestsPerViewport extends Dictionary<Viewport, Set<Tile>> {
  public constructor() {
    super((lhs, rhs) => lhs.viewportId - rhs.viewportId);
  }
}

class Admin extends TileAdmin {
  private readonly _requestsPerViewport = new RequestsPerViewport();
  private readonly _uniqueViewportSets = new UniqueViewportSets();
  private _maxActiveRequests: number;
  private readonly _throttle: boolean;
  private readonly _retryInterval: number;
  private readonly _enableInstancing: boolean;
  private readonly _elideEmptyChildContentRequests: boolean;
  private readonly _removeIModelConnectionOnCloseListener: () => void;
  private _activeRequests = new Set<TileRequest>();
  private _swapActiveRequests = new Set<TileRequest>();
  private _pendingRequests = new Queue();
  private _swapPendingRequests = new Queue();
  private _numCanceled = 0;
  private _totalCompleted = 0;
  private _totalFailed = 0;
  private _totalTimedOut = 0;
  private _totalEmpty = 0;
  private _totalUndisplayable = 0;
  private _totalElided = 0;
  private _retryIntervalInitialized = false;
  private get _memoizeRequests() { return this._retryInterval > 0; }

  public get emptyViewportSet(): TileAdmin.ViewportSet { return this._uniqueViewportSets.emptySet; }
  public get statistics(): TileAdmin.Statistics {
    return {
      numPendingRequests: this._pendingRequests.length,
      numActiveRequests: this._activeRequests.size,
      numCanceled: this._numCanceled,
      totalCompletedRequests: this._totalCompleted,
      totalFailedRequests: this._totalFailed,
      totalTimedOutRequests: this._totalTimedOut,
      totalEmptyTiles: this._totalEmpty,
      totalUndisplayableTiles: this._totalUndisplayable,
      totalElidedTiles: this._totalElided,
    };
  }

  public resetStatistics(): void {
    this._totalCompleted = this._totalFailed = this._totalTimedOut = this._totalEmpty = this._totalUndisplayable = this._totalElided = 0;
  }

  public constructor(options?: TileAdmin.Props) {
    super();

    if (undefined === options)
      options = { };

    this._throttle = !options.disableThrottling;
    this._maxActiveRequests = undefined !== options.maxActiveRequests ? options.maxActiveRequests : 10;
    this._retryInterval = undefined !== options.retryInterval ? options.retryInterval : 0;
    this._enableInstancing = !!options.enableInstancing;
    this._elideEmptyChildContentRequests = !!options.elideEmptyChildContentRequests;

    this._removeIModelConnectionOnCloseListener = IModelConnection.onClose.addListener((iModel) => this.onIModelClosed(iModel));
  }

  public get enableInstancing() { return this._enableInstancing; }
  public get elideEmptyChildContentRequests() { return this._elideEmptyChildContentRequests; }

  public get maxActiveRequests() { return this._maxActiveRequests; }
  public set maxActiveRequests(max: number) {
    if (max > 0)
      this._maxActiveRequests = max;
  }

  public process(): void {
    this._numCanceled = 0;

    // Mark all requests as being associated with no Viewports, indicating they are no longer needed.
    this._uniqueViewportSets.clearAll();

    // Process all requests, enqueueing on new queue.
    const previouslyPending = this._pendingRequests;
    this._pendingRequests = this._swapPendingRequests;
    this._swapPendingRequests = previouslyPending;

    const previouslyActive = this._activeRequests;
    this._activeRequests = this._swapActiveRequests;

    this._requestsPerViewport.forEach((key, value) => this.processRequests(key, value));

    if (!this._throttle)
      return;

    // Cancel any previously pending requests which are no longer needed.
    for (const queued of previouslyPending)
      if (queued.viewports.isEmpty)
        this.cancel(queued);

    previouslyPending.clear();

    // Cancel any active requests which are no longer needed.
    for (const active of previouslyActive) {
      if (active.viewports.isEmpty)
        this.cancel(active);
      else
        this._activeRequests.add(active);
    }

    previouslyActive.clear();
    this._swapActiveRequests = previouslyActive;

    // Fill up the active requests from the queue.
    while (this._activeRequests.size < this._maxActiveRequests) {
      const request = this._pendingRequests.pop();
      if (undefined === request)
        break;
      else
        this.dispatch(request);
    }
  }

  private processRequests(vp: Viewport, tiles: Set<Tile>): void {
    for (const tile of tiles) {
      if (undefined === tile.request) {
        // ###TODO: This assertion triggers for AttachmentViewports used for rendering 3d sheet attachments.
        // Determine why and fix.
        // assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (Tile.LoadStatus.NotLoaded === tile.loadStatus) {
          const request = new TileRequest(tile, vp);
          tile.request = request;
          if (this._throttle)
            this._pendingRequests.push(request);
          else
            this.dispatch(request);
        }
      } else {
        const req = tile.request;
        assert(undefined !== req);
        if (undefined !== req) {
          // Request may already be dispatched (in this._activeRequests) - if so do not re-enqueue!
          if (req.isQueued && 0 === req.viewports.length)
            this._pendingRequests.push(req);

          req.addViewport(vp);
          assert(0 < req.viewports.length);
        }
      }
    }
  }

  public getNumRequestsForViewport(vp: Viewport): number {
    const requests = this._requestsPerViewport.get(vp);
    return undefined !== requests ? requests.size : 0;
  }

  public requestTiles(vp: Viewport, tiles: Set<Tile>): void {
    this._requestsPerViewport.set(vp, tiles);
  }

  public forgetViewport(vp: Viewport): void {
    // NB: vp will be removed from ViewportSets in process() - but if we can establish that only this vp wants a given tile, cancel its request immediately.
    const tiles = this._requestsPerViewport.get(vp);
    if (undefined !== tiles) {
      for (const tile of tiles) {
        const request = tile.request;
        if (undefined !== request && 1 === request.viewports.length)
          request.cancel();
      }

      this._requestsPerViewport.delete(vp);
    }
  }

  private onIModelClosed(iModel: IModelConnection): void {
    this._requestsPerViewport.forEach((vp, _req) => {
      if (vp.iModel === iModel)
        this.forgetViewport(vp);
    });
  }

  public onShutDown(): void {
    this._removeIModelConnectionOnCloseListener();

    for (const request of this._activeRequests)
      request.cancel();

    this._activeRequests.clear();

    for (const queued of this._pendingRequests)
      queued.cancel();

    this._requestsPerViewport.clear();
    this._uniqueViewportSets.clear();
  }

  private dispatch(req: TileRequest): void {
    this._activeRequests.add(req);
    req.dispatch().then(() => this.dropActiveRequest(req)) // tslint:disable-line no-floating-promises
      .catch(() => this.dropActiveRequest(req));
  }

  private cancel(req: TileRequest) {
    req.cancel();
    ++this._numCanceled;
  }

  private dropActiveRequest(req: TileRequest) {
    assert(this._activeRequests.has(req) || req.isCanceled);
    this._activeRequests.delete(req);
  }

  public getViewportSet(vp: Viewport, vps?: TileAdmin.ViewportSet): TileAdmin.ViewportSet {
    return this._uniqueViewportSets.getViewportSet(vp, vps);
  }

  public async requestTileTreeProps(iModel: IModelConnection, treeId: string): Promise<TileTreeProps> {
    this.initializeRetryInterval();
    const intfc = IModelTileRpcInterface.getClient();
    return this._memoizeRequests ? intfc.requestTileTreeProps(iModel.iModelToken, treeId) : intfc.getTileTreeProps(iModel.iModelToken, treeId);
  }

  public async requestTileContent(iModel: IModelConnection, treeId: string, contentId: string): Promise<Uint8Array> {
    this.initializeRetryInterval();
    const intfc = IModelTileRpcInterface.getClient();
    return this._memoizeRequests ? intfc.requestTileContent(iModel.iModelToken, treeId, contentId) : intfc.getTileContent(iModel.iModelToken, treeId, contentId);
  }

  private initializeRetryInterval(): void {
    // Would prefer to do this in constructor - but nothing enforces that the app initializes the rpc interfaces before it creates the TileAdmin (via IModelApp.startup()) - so do it on first request instead.
    if (!this._retryIntervalInitialized) {
      this._retryIntervalInitialized = true;

      if (this._memoizeRequests) {
        const retryInterval = this._retryInterval;
        RpcOperation.lookup(IModelTileRpcInterface, "requestTileTreeProps").policy.retryInterval = () => retryInterval;
        RpcOperation.lookup(IModelTileRpcInterface, "requestTileContent").policy.retryInterval = () => retryInterval;
      }
    }
  }

  public onTileFailed(_tile: Tile) { ++this._totalFailed; }
  public onTileTimedOut(_tile: Tile) { ++this._totalTimedOut; }
  public onTileElided() { ++this._totalElided; }
  public onTileCompleted(tile: Tile) {
    ++this._totalCompleted;
    if (tile.isEmpty)
      ++this._totalEmpty;
    else if (!tile.isDisplayable)
      ++this._totalUndisplayable;
  }
}
