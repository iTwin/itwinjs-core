/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { SortedArray, PriorityQueue, assert, base64StringToUint8Array } from "@bentley/bentleyjs-core";
import { ImageSource, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { RenderGraphic } from "../render/System";
import { Tile, TileTree, TileLoader } from "./TileTree";
import { Viewport } from "../Viewport";

export class TileRequest {
  protected _state: TileRequest.State;

  public get state(): TileRequest.State { return this._state; }

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

class Request extends TileRequest {
  public readonly tile: Tile;
  public readonly priority: number; // ###TODO Allow priority to be adjusted based on camera etc.

  public get state(): TileRequest.State { return this._state; }
  public get tree(): TileTree { return this.tile.root; }
  public get loader(): TileLoader { return this.tree.loader; }

  public constructor(tile: Tile) {
    super();
    this.tile = tile;
    this.priority = tile.depth; // ###TODO account for reality/map tiles vs design model tiles, etc.
  }

  public async dispatch(): Promise<void> {
    try {
      const response = await this.loader.requestTileContent(this.tile);
      return this.handleResponse(response);
    } catch (_err) {
      this.setFailed();
      return Promise.resolve();
    }
  }

  private setFailed() {
    this._state = TileRequest.State.Failed;
    this.tile.setNotFound();
    this.tile.request = undefined;
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
      this._state = TileRequest.State.Completed;
      this.tile.setGraphic(graphic.renderGraphic, graphic.isLeaf, graphic.contentRange, graphic.sizeMultiplier);
      this.tile.request = undefined;
    } catch (_err) {
      this.setFailed();
    }

    return Promise.resolve();
  }
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
}

class TrackedViewports {
  public readonly viewports = new ViewportSet();
  private readonly _uniqueSets = new UniqueViewportSets();

  public track(vp: Viewport) {
    this.viewports.insert(vp);
  }

  public untrack(vp: Viewport) {
    if (-1 !== this.viewports.remove(vp)) {
      for (let i = 0; i < this._uniqueSets.length; /* */) {
        const set = this._uniqueSets.get(i)!;
        set.remove(vp);
        if (set.isEmpty)
          this._uniqueSets.eraseAt(i);
        else
          i++;
      }
    }
  }

  public clear(): void {
    this.viewports.clear();
    this._uniqueSets.forEach((set) => set.clear());
    this._uniqueSets.clear();
  }
}

class RequestScheduler implements TileRequest.Scheduler {
  private readonly _viewports = new TrackedViewports();
  private readonly _activeRequests = new Set<Request>();
  private readonly _maxActiveRequests: number;
  private readonly _throttle: boolean;
  private readonly _currentQueue = new Queue();
  // private readonly _swapQueue = new Queue();

  public constructor(options?: TileRequest.SchedulerOptions) {
    let throttle = false;
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
      numPendingRequests: this._currentQueue.length,
      numActiveRequests: this._activeRequests.size,
    };
  }

  public preprocess(): void {
  }

  public process(): void {
    if (!this._throttle)
      return;

    while (this._activeRequests.size < this._maxActiveRequests) {
      const request = this._currentQueue.pop();
      if (undefined === request)
        break;
      else
        this.dispatch(request);
    }
  }

  public requestTiles(vp: Viewport, tiles: Set<Tile>): void {
    this._viewports.track(vp);

    for (const tile of tiles) {
      if (undefined === tile.request) {
        assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (Tile.LoadStatus.NotLoaded === tile.loadStatus) {
          const request = new Request(tile);
          tile.request = request;
          if (this._throttle)
            this._currentQueue.push(request);
          else
            this.dispatch(request);
        }
      } else {
        assert(this._activeRequests.has(tile.request as Request) || (this._throttle && this._currentQueue.has(tile.request as Request)));
      }
    }
  }

  public forgetViewport(vp: Viewport): void {
    this._viewports.untrack(vp);
  }

  public onShutDown(): void {
    // ###TODO mark all as cancelled.
    for (const request of this._activeRequests)
      request.tile.setAbandoned();

    this._activeRequests.clear();

    for (const queued of this._currentQueue.array) {
      queued.tile.request = undefined;
      queued.tile.setAbandoned();
    }

    this._viewports.clear();
  }

  private dispatch(req: Request): void {
    this._activeRequests.add(req);
    req.dispatch().then(() => this.dropActiveRequest(req)) // tslint:disable-line no-floating-promises
      .catch(() => this.dropActiveRequest(req));
  }

  private dropActiveRequest(req: Request) {
    assert(this._activeRequests.has(req));
    this._activeRequests.delete(req);
  }
}
