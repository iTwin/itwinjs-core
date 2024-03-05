/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, base64StringToUint8Array, IModelStatus } from "@itwin/core-bentley";
import { ImageSource } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { Viewport } from "../Viewport";
import { ReadonlyTileUserSet, Tile, TileContent, TileRequestChannel, TileTree, TileUser } from "./internal";

// Set up IDB here
let db;
const requestDB = self.indexedDB.open("IDB", 1);
requestDB.onerror = () => {
  console.log("Error opening up IDBL");
};

requestDB.onsuccess = (event) => {
  console.log("Success opening up IDB");
  db = event.target.result;
};

requestDB.onupgradeneeded = (event) => {
  db = event.target.result;
  const initialObjectStore = db.createObjectStore("TileResponse", { keyPath: "tileContentID" });
  console.log("create initial data store");

  initialObjectStore.createIndex("responseData", "responseData", {unique: false});
  initialObjectStore.createIndex("timeOfStorage", "timeOfStorage", {unique: false});
};

/** Represents a pending or active request to load the contents of a [[Tile]]. The request coordinates with the [[Tile.requestContent]] to obtain the raw content and
 * [[Tile.readContent]] to convert the result into a [[RenderGraphic]]. TileRequests are created internally as needed; it is never necessary or useful for external code to create them.
 * @public
 * @extensions
 */
export class TileRequest {
  /** The requested tile. While the request is pending or active, `tile.request` points back to this TileRequest. */
  public readonly tile: Tile;
  /** The channel via which the request will be executed. */
  public readonly channel: TileRequestChannel;
  /** The set of [[TileUser]]s that are awaiting the result of this request. When this becomes empty, the request is canceled because no user cares about it.
   * @internal
   */
  public users: ReadonlyTileUserSet;
  private _state: TileRequest.State;
  /** Determines the order in which pending requests are pulled off the queue to become active. A tile with a lower priority value takes precedence over one with a higher value. */
  public priority = 0;

  /** Constructor */
  public constructor(tile: Tile, user: TileUser) {
    this._state = TileRequest.State.Queued;
    this.tile = tile;
    this.channel = tile.channel;
    this.users = IModelApp.tileAdmin.getTileUserSetForRequest(user);
  }

  /** The set of [[Viewport]]s that are awaiting the result of this request. When this becomes empty, the request is canceled because no user cares about it. */
  public get viewports(): Iterable<Viewport> {
    return TileUser.viewportsFromUsers(this.users);
  }

  /** The request's current state. */
  public get state(): TileRequest.State { return this._state; }

  /** True if the request has been enqueued but not yet dispatched. */
  public get isQueued() { return TileRequest.State.Queued === this._state; }

  /** True if the request has been canceled. */
  public get isCanceled(): boolean {
    // If iModel was closed, cancel immediately
    if (this.tile.iModel.tiles.isDisposed)
      return true;

    // After we've received the raw tile data, always finish processing it - otherwise tile may end up in limbo (and producing tile content should be faster than re-requesting raw data).
    if (TileRequest.State.Loading === this._state)
      return false;

    // If no user cares about this tile any more, we're canceled.
    return this.users.isEmpty;
  }

  /** The tile tree to which the requested [[Tile]] belongs. */
  public get tree(): TileTree { return this.tile.tree; }

  /** Indicate that the specified user is awaiting the result of this request.
   * @internal
   */
  public addUser(user: TileUser): void {
    this.users = IModelApp.tileAdmin.getTileUserSetForRequest(user, this.users);
  }

  /** Transition the request from "queued" to "active", kicking off a series of asynchronous operations usually beginning with an http request, and -
   * if the request is not subsequently canceled - resulting in either a successfully-loaded Tile, or a failed ("not found") Tile.
   * @internal
   */
  public async dispatch(onHttpResponse: () => void): Promise<void> {
    if (this.isCanceled)
      return;

    assert(this._state === TileRequest.State.Queued);
    this._state = TileRequest.State.Dispatched;
    let response;
    let gotResponse = false;
    try {
      response = await this.channel.requestContent(this.tile, () => this.isCanceled);
      gotResponse = true;

      // Set this now, so our `isCanceled` check can see it.
      this._state = TileRequest.State.Loading;
    } catch (err: any) {
      if (err.errorNumber && err.errorNumber === IModelStatus.ServerTimeout) {
        // Invalidate scene - if tile is re-selected, it will be re-requested.
        this.notifyAndClear();
        this._state = TileRequest.State.Failed;
        this.channel.recordTimeout();
      } else {
        // Unknown error - not retryable
        this.setFailed();
      }
    }

    // Notify caller that we have finished http activity.
    onHttpResponse();

    if (!gotResponse || this.isCanceled)
      return;

    if (undefined === response && this.channel.onNoContent(this)) {
      // Invalidate scene - if tile is re-selected, it will be re-requested - presumably via a different channel.
      this.notifyAndClear();
      this._state = TileRequest.State.Failed;
      return;
    }

    return this.handleResponse(response);

    // Here, go get cached response data and pass along instead of returning above (if we want to obviously)
  }

  /** Cancels this request. This leaves the associated Tile's state untouched.
   * @internal
   */
  public cancel(): void {
    this.notifyAndClear();
    if (TileRequest.State.Dispatched === this._state)
      this.channel.onActiveRequestCanceled(this);

    this._state = TileRequest.State.Failed;
  }

  /** Invalidates the scene of each [[TileUser]] interested in this request - typically because the request succeeded, failed, or was canceled. */
  private notify(): void {
    this.users.forEach((user) => {
      if (user.onRequestStateChanged)
        user.onRequestStateChanged(this);
    });
  }

  /** Invalidates the scene of each [[TileUser]] interested in this request and clears the set of interested users. */
  private notifyAndClear(): void {
    this.notify();
    this.users = IModelApp.tileAdmin.emptyTileUserSet;
    this.tile.request = undefined;
  }

  private setFailed() {
    this.notifyAndClear();
    this._state = TileRequest.State.Failed;
    this.tile.setNotFound();
    this.channel.recordFailure();
  }

  /** Invoked when the raw tile content becomes available, to convert it into a tile graphic. */
  private async handleResponse(response: TileRequest.Response): Promise<void> {
    let content: TileContent | undefined;
    let data: TileRequest.ResponseData | undefined;
    if (undefined !== response) {
      if (typeof response === "string")
        data = base64StringToUint8Array(response);
      else if (response instanceof Uint8Array || response instanceof ImageSource)
        data = response;
      else if (response instanceof ArrayBuffer)
        data = new Uint8Array(response);
      else if (typeof response === "object") {
        if ("content" in response)
          content = response.content;
        else if ("data" in response)
          data = response;
      }
    }

    if (!content && !data) {
      this.setFailed();
      return;
    }

    try {
      const start = Date.now();
      if (!content) {
        assert(undefined !== data);
        content = await this.tile.readContent(data, IModelApp.renderSystem, () => this.isCanceled);
        if (this.isCanceled)
          return;
      }

      this._state = TileRequest.State.Completed;
      this.tile.setContent(content);
      this.notifyAndClear();
      this.channel.recordCompletion(this.tile, content, Date.now() - start);
    } catch (_err) {
      this.setFailed();
    }

    // Here, cache content if we want to
  }
}

/** @public */
export namespace TileRequest { // eslint-disable-line no-redeclare
  /** The type of a raw response to a request for tile content. Processed upon receipt into a [[TileRequest.Response]] type.
   * [[Tile.requestContent]] produces a response of this type; it is then converted to a [[Tile.ResponseData]] from which [[Tile.readContent]]
   * can produce a [[RenderGraphic]].
   * @public
   */
  export type Response = Uint8Array | ArrayBuffer | string | ImageSource | { content: TileContent } | { data: any } | undefined;

  /** The input to [[Tile.readContent]], to be converted into a [[RenderGraphic]].
   * @public
   */
  export type ResponseData = Uint8Array | ImageSource | { data: any };

  /** The states through which a [[TileRequest]] proceeds. During the first 3 states, the [[Tile]]'s `request` member is defined,
   * and its [[Tile.LoadStatus]] is computed based on the state of its request.
   *@ public
   */
  export enum State {
    /** Initial state. Request is pending but not yet dispatched. */
    Queued,
    /** Follows `Queued` when request begins to be actively processed. */
    Dispatched,
    /** Follows `Dispatched` when the response to the request is being converted into tile graphics. */
    Loading,
    /** Follows `Loading` when tile graphic has successfully been produced. */
    Completed,
    /** Follows any state in which an error prevents progression, or during which the request was canceled. */
    Failed,
  }
}
