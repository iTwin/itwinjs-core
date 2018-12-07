/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { PriorityQueue, assert, base64StringToUint8Array } from "@bentley/bentleyjs-core";
import { ImageSource, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { RenderGraphic } from "../render/System";
import { Tile, TileTree, TileLoader } from "./TileTree";

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
    requestTiles(tiles: Set<Tile>): void;
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
    tile.setIsQueued();
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
    this.tile.setIsLoading();

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

class RequestScheduler implements TileRequest.Scheduler {
  private readonly _activeRequests = new Set<Request>();
  private readonly _maxActiveRequests: number;
  private readonly _currentQueue = new Queue();
  // private readonly _swapQueue = new Queue();

  public constructor(options?: TileRequest.SchedulerOptions) {
    let maxActiveRequests = 10;
    if (undefined !== options) {
      if (undefined !== options.maxActiveRequests)
        maxActiveRequests = options.maxActiveRequests;
    }

    this._maxActiveRequests = maxActiveRequests;
    assert(0 !== this._maxActiveRequests); // temporarily, to silence unused var warning...
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
    while (this._activeRequests.size < this._maxActiveRequests) {
      const request = this._currentQueue.pop();
      if (undefined === request)
        break;
      else
        this.dispatch(request);
    }
  }

  public requestTiles(tiles: Set<Tile>): void {
    for (const tile of tiles) {
      if (undefined === tile.request) {
        assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (Tile.LoadStatus.NotLoaded === tile.loadStatus) {
          const request = new Request(tile);
          tile.request = request;
          this._currentQueue.push(request);
        }
      } else {
        assert(this._activeRequests.has(tile.request as Request) || this._currentQueue.has(tile.request as Request));
      }
    }
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
  }

  private dispatch(req: Request): void {
    this._activeRequests.add(req);
    req.dispatch().then(() => { // tslint:disable-line no-floating-promises
      assert(this._activeRequests.has(req));
      this._activeRequests.delete(req);
    });
  }
}

/*
import { Tile, TileRequests } from "./TileTree";

export class TileRequest {
  public tile: Tile;
  public priority: number;
  public state: TileRequest.State;
  public expired: boolean; // Set to true for all active+pending requests before tile selection; set to false for those which remain active/pending after tile selection.

  public compare(rhs: TileRequest): number {
    // ###TODO: account for tile type (map/reality vs design model), etc...
    return this.priority - rhs.priority
  }
}

function compareRequests(lhs: TileRequest, rhs: TileRequest): number { return lhs.compare(rhs); }

export namespace TileRequest {
  export const enum State {
    Queued = 0, // Request is pending in queue - not yet dispatched.
    Dispatched = 1, // Request has been dispatched - awaiting response.
    Received = 2, // Response has been received but not yet processed.
    Processing = 3, // Response is being processed.
    Failed = 4, // Request failed.
    Cancelled = 5, // Request was cancelled before it completed.
  }

  export interface Statistics {
    numPending: number;
    numActive: number;
  }

  export interface SchedulerOptions {
    maxActiveRequests?: number;
  }

  export class Scheduler {
    private _maxActiveRequests: number = 10;
    private _activeRequests: TileRequest[] = [];
    private _activeQueue = new Queue();
    private _swapQueue = new Queue();

    public constructor(options?: SchedulerOptions) {
      if (undefined === options)
        return;

      if (undefined !== options.maxActiveRequests)
        this._maxActiveRequests = options.maxActiveRequests;
    }

    public get statistics(): Statistics {
      return {
        numPending: this._activeQueue.length,
        numActive: this._activeRequests.length,
      };
    }

    public update(): void {
      for (const active of this._activeRequests)
        active.expired = true;

      for (const pending of this._activeQueue)
        pending.expired = true;

      const temp = this._swapQueue;
      this._swapQueue = this._activeQueue;
      temp.clear();
      this._activeQueue = temp;
    }

    public process(requests: TileRequests): void {

    }
  }
}
*/
