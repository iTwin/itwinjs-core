/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { assert, base64StringToUint8Array } from "@bentley/bentleyjs-core";
import { ImageSource, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { RenderGraphic } from "../render/System";
import { Tile, TileTree, TileLoader } from "./TileTree";

export class TileRequest {
  public readonly tile: Tile;
  private _state: TileRequest.State;

  public get state(): TileRequest.State { return this._state; }
  public get tree(): TileTree { return this.tile.root; }
  public get loader(): TileLoader { return this.tree.loader; }

  public constructor(tile: Tile) {
    this.tile = tile;
    this._state = TileRequest.State.Queued;
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
    return new TileRequestScheduler(options);
  }
}

/*
class Queue extends PriorityQueue<TileRequest> {
  public constructor() {
    super((lhs, rhs) => lhs.compare(rhs));
  }

  public get array(): TileRequest[] { return this._array; }
}
*/

class TileRequestScheduler implements TileRequest.Scheduler {
  private readonly _activeRequests = new Set<Tile>();
  private readonly _maxActiveRequests: number;

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
      numPendingRequests: 0,
      numActiveRequests: this._activeRequests.size,
    };
  }

  public preprocess(): void {
  }

  public process(): void {
  }

  public requestTiles(tiles: Set<Tile>): void {
    for (const tile of tiles) {
      if (undefined === tile.request) {
        assert(!this._activeRequests.has(tile));
        assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (Tile.LoadStatus.NotLoaded === tile.loadStatus) {
          tile.request = new TileRequest(tile);
          this.dispatch(tile.request);
        }
      } else {
        assert(this._activeRequests.has(tile));
      }
    }
  }

  public onShutDown(): void {
    // ###TODO mark all as cancelled.
    this._activeRequests.clear();
  }

  private dispatch(req: TileRequest): void {
    this._activeRequests.add(req.tile);
    req.dispatch().then(() => { // tslint:disable-line no-floating-promises
      assert(this._activeRequests.has(req.tile));
      this._activeRequests.delete(req.tile);
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
