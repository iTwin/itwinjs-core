/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { assert, base64StringToUint8Array } from "@bentley/bentleyjs-core";
import { ImageSource, ServerTimeoutError } from "@bentley/imodeljs-common";
import { Tile, TileTree, TileLoader } from "./TileTree";
import { TileAdmin } from "./TileAdmin";
import { Viewport } from "../Viewport";
import { IModelApp } from "../IModelApp";

/** Represents a pending or active request to load the contents of a [[Tile]]. The request coordinates with a [[TileLoader]] to execute the request for tile content and
 * convert the result into a renderable graphic.
 * @hidden
 */
export class TileRequest {
  /** The requested tile. While the request is pending or active, `tile.request` points back to this TileRequest. */
  public readonly tile: Tile;
  /** Determines the order in which pending requests are pulled off the queue to become active. A tile with a lower value takes precedence over one with a higher value. */
  /** The set of [[Viewport]]s that are awaiting the result of this request. When this becomes empty, the request is canceled because no viewport cares about it. */
  public viewports: TileAdmin.ViewportSet;
  private _state: TileRequest.State;

  public constructor(tile: Tile, vp: Viewport) {
    this._state = TileRequest.State.Queued;
    this.tile = tile;
    this.viewports = IModelApp.tileAdmin.getViewportSet(vp);
  }

  public get state(): TileRequest.State { return this._state; }
  public get isQueued() { return TileRequest.State.Queued === this._state; }
  public get isCanceled(): boolean { return this.viewports.isEmpty; } // ###TODO: check if IModelConnection closed etc.

  public get tree(): TileTree { return this.tile.root; }
  public get loader(): TileLoader { return this.tree.loader; }

  public addViewport(vp: Viewport): void {
    this.viewports = IModelApp.tileAdmin.getViewportSet(vp, this.viewports);
  }

  /** Transition the request from "queued" to "active", kicking off a series of asynchronous operations usually beginning with an http request, and -
   * if the request is not subsequently canceled - resulting in either a successfully-loaded Tile, or a failed ("not found") Tile.
   */
  public async dispatch(): Promise<void> {
    try {
      if (this.isCanceled)
        return Promise.resolve();

      assert(this._state === TileRequest.State.Queued);
      this._state = TileRequest.State.Dispatched;
      const response = await this.loader.requestTileContent(this.tile);
      if (this.isCanceled)
        return Promise.resolve();

      return this.handleResponse(response);
    } catch (_err) {
      if (_err instanceof ServerTimeoutError) {
        // Invalidate scene - if tile is re-selected, it will be re-requested.
        this.notifyAndClear();
        this._state = TileRequest.State.Failed;
        IModelApp.tileAdmin.onTileTimedOut(this.tile);
      } else {
        // Unknown error - not retryable.
        this.setFailed();
      }

      return Promise.resolve();
    }
  }

  /** Cancels this request. This leaves the associated Tile's state untouched. */
  public cancel(): void {
    this.notifyAndClear();
    this._state = TileRequest.State.Failed;
  }

  /** Invalidates the scene of each [[Viewport]] interested in this request - typically because the request succeeded, failed, or was canceled. */
  private notify(): void {
    this.viewports.forEach((vp) => vp.invalidateScene());
  }

  /** Invalidates the scene of each [[Viewport]] interested in this request and clears the set of interested viewports. */
  private notifyAndClear(): void {
    this.notify();
    this.viewports = IModelApp.tileAdmin.emptyViewportSet;
    this.tile.request = undefined;
  }

  private setFailed() {
    this.notifyAndClear();
    this._state = TileRequest.State.Failed;
    this.tile.setNotFound();
    IModelApp.tileAdmin.onTileFailed(this.tile);
  }

  /** Invoked when the raw tile content becomes available, to convert it into a tile graphic. */
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
      const content = await this.loader.loadTileContent(this.tile, data);
      if (this.isCanceled)
        return Promise.resolve();

      this._state = TileRequest.State.Completed;
      this.tile.setContent(content);
      this.notifyAndClear();
      IModelApp.tileAdmin.onTileCompleted(this.tile);
    } catch (_err) {
      this.setFailed();
    }

    return Promise.resolve();
  }
}

/** @hidden */
export namespace TileRequest {
  /** The type of a raw response to a request for tile content. Processed upon receipt into a [[TileRequest.Response]] type. */
  export type Response = Uint8Array | ArrayBuffer | string | ImageSource | undefined;
  /** The input to [[TileLoader.loadTileContent]], to be converted into a [[Tile.Content]]. */
  export type ResponseData = Uint8Array | ImageSource;

  /** The states through which a TileRequest proceeds. During the first 3 states, the [[Tile]]'s `request` member is defined, and its [[Tile.LoadStatus]] is computed based on the state of its request. */
  export const enum State {
    /** Initial state. Request is pending but not yet dispatched. */
    Queued,
    /** Follows `Queued` when request begins to be actively processed. */
    Dispatched,
    /** Follows `Dispatched` when tile content is being converted into tile graphics. */
    Loading,
    /** Follows `Loading` when tile graphic has successfully been produced. */
    Completed,
    /** Follows any state in which an error prevents progression, or during which the request was canceled. */
    Failed,
  }
}
