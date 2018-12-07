/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { ImageSource } from "@bentley/imodeljs-common";
import { Range3d } from "@bentley/geometry-core";
import { RenderGraphic } from "../render/System";

export namespace TileRequest {
  export type Response = Uint8Array | ArrayBuffer | string | ImageSource | undefined;
  export type ResponseData = Uint8Array | ImageSource;
  export interface Graphic {
    graphic?: RenderGraphic;
    isLeaf?: boolean;
    contentRange?: Range3d;
    sizeMultiplier?: number;
  }
}

/*
import { PriorityQueue } from "@bentley/bentleyjs-core";
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

class Queue extends PriorityQueue<TileRequest> {
  public constructor() {
    super((lhs, rhs) => lhs.compare(rhs));
  }

  public get array(): TileRequest[] { return this._array; }
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
