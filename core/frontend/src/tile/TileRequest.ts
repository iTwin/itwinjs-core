/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { Dictionary, SortedArray, PriorityQueue, assert, base64StringToUint8Array } from "@bentley/bentleyjs-core";
import { ImageSource, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { RenderGraphic } from "../render/System";
import { Tile, TileTree, TileLoader } from "./TileTree";
import { Viewport } from "../Viewport";
import { IModelApp } from "../IModelApp";

export abstract class TileRequest {
  protected _state: TileRequest.State;

  public get state(): TileRequest.State { return this._state; }
  public abstract get isCanceled(): boolean;

  protected constructor() {
    this._state = TileRequest.State.Queued;
  }
}

export namespace TileRequest {
  export type Response = Uint8Array | ArrayBuffer | string | ImageSource | undefined;
  export type ResponseData = Uint8Array | ImageSource;

  export const enum State {
    Queued,
    Dispatched,
    Loading,
    Completed,
    Failed,
  }

  export interface Graphic {
    renderGraphic?: RenderGraphic;
    isLeaf?: boolean;
    contentRange?: ElementAlignedBox3d;
    sizeMultiplier?: number;
  }

  export interface Statistics {
    numPendingRequests: number;
    numActiveRequests: number;
  }

  export interface Scheduler {
    readonly statistics: Statistics;

    preprocess(): void;
    process(): void;
    requestTiles(vp: Viewport, tiles: Set<Tile>): void;
    getNumRequestsForViewport(vp: Viewport): number;
    forgetViewport(vp: Viewport): void;
    onShutDown(): void;
  }

  export interface SchedulerOptions {
    maxActiveRequests?: number;
  }

  export function createScheduler(options?: SchedulerOptions): Scheduler {
    return new RequestScheduler(options);
  }
}

class ViewportSet extends SortedArray<Viewport> {
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

class Request extends TileRequest {
  public readonly tile: Tile;
  public readonly priority: number; // ###TODO Allow priority to be adjusted based on camera etc.
  public viewports: ViewportSet;

  public get state(): TileRequest.State { return this._state; }
  public get tree(): TileTree { return this.tile.root; }
  public get loader(): TileLoader { return this.tree.loader; }
  public get isCanceled(): boolean { return this.viewports.isEmpty; } // ###TODO: check if IModelConnection closed etc.

  public constructor(tile: Tile, vp: Viewport) {
    super();
    this.tile = tile;
    this.priority = tile.depth; // ###TODO account for reality/map tiles vs design model tiles, etc.
    this.viewports = RequestScheduler.get().getViewportSet(vp);
  }

  public addViewport(vp: Viewport): void {
    this.viewports = RequestScheduler.get().getViewportSet(vp, this.viewports);
  }

  public async dispatch(): Promise<void> {
    try {
      if (this.isCanceled)
        return Promise.resolve();

      this._state = TileRequest.State.Dispatched;
      const response = await this.loader.requestTileContent(this.tile);
      if (this.isCanceled)
        return Promise.resolve();

      return this.handleResponse(response);
    } catch (_err) {
      this.setFailed();
      return Promise.resolve();
    }
  }

  public cancel(scheduler: RequestScheduler): void {
    if (this.isCanceled)
      return;

    this._state = TileRequest.State.Failed;
    this.tile.request = undefined;
    this.viewports = scheduler.emptyViewportSet;
  }

  private notifyAndClear(): void {
    this.viewports.forEach((vp) => vp.invalidateScene());
    this.viewports = RequestScheduler.get().emptyViewportSet;
    this.tile.request = undefined;
  }

  private setFailed() {
    this.notifyAndClear();
    this._state = TileRequest.State.Failed;
    this.tile.setNotFound();
  }

  private async handleResponse(response: TileRequest.Response): Promise<void> {
    let data: TileRequest.ResponseData | undefined;
    if (undefined !== response) {
      if (typeof response === "string")
        data = base64StringToUint8Array(response);
      else if (response instanceof Uint8Array || response instanceof ImageSource)
        data = response;
      else if (response instanceof ArrayBuffer)
        data = new Uint8Array(response);
    }

    if (undefined === data) {
      this.setFailed();
      return Promise.resolve();
    }

    this._state = TileRequest.State.Loading;

    try {
      const graphic = await this.loader.loadTileGraphic(this.tile, data);
      if (this.isCanceled)
          return Promise.resolve();

      this._state = TileRequest.State.Completed;
      this.tile.setGraphic(graphic.renderGraphic, graphic.isLeaf, graphic.contentRange, graphic.sizeMultiplier);
      this.notifyAndClear();
    } catch (_err) {
      this.setFailed();
    }

    return Promise.resolve();
  }

  public static getForTile(tile: Tile): Request | undefined { return tile.request as Request; }
}

class Queue extends PriorityQueue<Request> {
  public constructor() {
    super((lhs, rhs) => lhs.priority - rhs.priority);
  }

  public get array(): Request[] { return this._array; }

  public has(request: Request): boolean {
    return this.array.indexOf(request) >= 0;
  }
}

function compareViewportSets(lhs: ViewportSet, rhs: ViewportSet): number {
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
class UniqueViewportSets extends SortedArray<ViewportSet> {
  public readonly emptySet = new ViewportSet();
  private readonly _scratchSet = new ViewportSet();

  public constructor() {
    super((lhs, rhs) => compareViewportSets(lhs, rhs));
    Object.freeze(this.emptySet);
  }

  public eraseAt(index: number): void {
    assert(index < this.length && index >= 0);
    this._array.splice(index, 1);
  }

  public getForViewport(vp: Viewport): ViewportSet {
    for (let i = 0; i < this.length; i++) {
      const set = this._array[i];
      if (1 === set.length && set.get(0)! === vp)
        return set;
    }

    const newSet = new ViewportSet(vp);
    this.insert(newSet);
    return newSet;
  }

  public getViewportSet(vp: Viewport, vps?: ViewportSet): ViewportSet {
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

class RequestScheduler implements TileRequest.Scheduler {
  private readonly _requestsPerViewport = new RequestsPerViewport();
  private readonly _uniqueViewportSets = new UniqueViewportSets();
  private _activeRequests = new Set<Request>();
  private _swapActiveRequests = new Set<Request>();
  private readonly _maxActiveRequests: number;
  private readonly _throttle: boolean;
  private _pendingRequests = new Queue();
  private _swapPendingRequests = new Queue();

  public constructor(options?: TileRequest.SchedulerOptions) {
    let throttle = true; // false;
    let maxActiveRequests = 10; // ###TODO for now we don't want the throttling behavior.
    if (undefined !== options) {
      if (undefined !== options.maxActiveRequests) {
        maxActiveRequests = options.maxActiveRequests;
        throttle = true;
      }
    }

    this._maxActiveRequests = maxActiveRequests;
    this._throttle = throttle;
  }

  public get statistics(): TileRequest.Statistics {
    return {
      numPendingRequests: this._pendingRequests.length,
      numActiveRequests: this._activeRequests.size,
    };
  }

  public preprocess(): void {
  }

  public process(): void {
    // Mark all requests as being associated with no Viewports, indicating they are no longer needed.
    this._uniqueViewportSets.clearAll();

    // Process all requests, enqueueing on new queue.
    const previouslyPending = this._pendingRequests;
    this._pendingRequests = this._swapPendingRequests;
    this._swapPendingRequests = previouslyPending;

    this._requestsPerViewport.forEach((key, value) => this.processRequests(key, value));
    
    if (!this._throttle)
      return;

    // Cancel any previously pending requests which are no longer needed.
    for (const queued of previouslyPending.array)
      if (queued.viewports.isEmpty)
        queued.cancel(this);

    previouslyPending.clear();

    // Cancel any active requests which are no longer needed.
    const previouslyActive = this._activeRequests;
    this._activeRequests = this._swapActiveRequests;
    for (const active of previouslyActive) {
      if (active.viewports.isEmpty)
        active.cancel(this);
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
        assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (Tile.LoadStatus.NotLoaded === tile.loadStatus) {
          const request = new Request(tile, vp);
          tile.request = request;
          if (this._throttle)
            this._pendingRequests.push(request);
          else
            this.dispatch(request);
        }
      } else {
        const req = Request.getForTile(tile);
        assert(undefined !== req);
        if (undefined !== req) {
          if (0 === req.viewports.length)
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
    // NB: In process() we will eliminate this Viewport from ViewportSets.
    this._requestsPerViewport.delete(vp);
  }

  public onShutDown(): void {
    // ###TODO mark all as cancelled.
    for (const request of this._activeRequests)
      request.tile.setAbandoned();

    this._activeRequests.clear();

    for (const queued of this._pendingRequests.array) {
      queued.tile.request = undefined;
      queued.tile.setAbandoned();
    }

    this._requestsPerViewport.clear();
    this._uniqueViewportSets.clear();
  }

  private dispatch(req: Request): void {
    this._activeRequests.add(req);
    req.dispatch().then(() => this.dropActiveRequest(req)) // tslint:disable-line no-floating-promises
      .catch(() => this.dropActiveRequest(req));
  }

  private dropActiveRequest(req: Request) {
    assert(this._activeRequests.has(req) || req.isCanceled);
    this._activeRequests.delete(req);
  }

  public static get(): RequestScheduler { return IModelApp.tileRequests as RequestScheduler; }

  public getViewportSet(vp: Viewport, vps?: ViewportSet): ViewportSet {
    return this._uniqueViewportSets.getViewportSet(vp, vps);
  }

  public get emptyViewportSet(): ViewportSet { return this._uniqueViewportSets.emptySet; }
}
