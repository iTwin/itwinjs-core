/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeTimePoint } from "@itwin/core-bentley";
import { IModelApp } from "../IModelApp";
import { Viewport } from "../Viewport";
import { IModelConnection } from "../IModelConnection";

/** Represents some object that makes use of [[Tile]]s in some way - e.g., by displaying them, requesting their contents, querying their geometry, etc.
 * Each [[Tile]] keeps track of its users via its [[TileUsageMarker]]. A tile with no users is eligible to be discarded via [[Tile.prune]].
 * Every [[Viewport]] has a tile user. It is occasionally useful to have a tile user not associated with any viewport.
 * @see [[TileUser.create]] to create a new tile user not associated with a viewport.
 * @public
 */
export interface TileUser {
  /** A unique integer identifying this user amongst all extant users. [[TileUser.generateTileUserId]] supplies a new, unique Id each time it is called.
   * [[TileUser.create]] produces a user with a unique Id each time it is called.
   */
  readonly userId: number;
  /** The iModel with which the user is associated. */
  readonly iModel: IModelConnection;
  /** If this user belongs to a viewport, the viewport. Some users are not associated with any viewport. */
  readonly viewport?: Viewport;
}

let nextTileUserId = 1;

/** @public */
export namespace TileUser {
  /** Generate a new unique Id for a TileUser. This is the **only** safe way to obtain such an Id. */
  export function generateTileUserId(): number {
    return nextTileUserId++;
  }

  /** Create a new TileUser associated with the specified `iModel` with a new, unique Id. */
  export function create(iModel: IModelConnection): TileUser {
    return {
      iModel,
      userId: generateTileUserId(),
    };
  }
}

/** A marker associated with a [[Tile]] to track usage of that tile by any number of [[TileUser]]s.
 * The marker tracks:
 *  - the set of [[Viewport]]s in which the tile is in use for some purpose (displayed, preloaded, requested, selected for shadow map, etc); and
 *  - the most recent time at which any viewport declared its use of the tile.
 * The marker is used to allow tiles to be discarded after they become disused by any viewport, via [[Tile.prune]].
 * @see [[Tile.usageMarker]].
 * @public
 */
export class TileUsageMarker {
  private _timePoint = BeTimePoint.now();

  /** Constructs a usage marker with its timepoint set to the current time and its set of viewports empty. */
  public constructor() {
  }

  /** Returns true if this tile is currently in use by no viewports and its timestamp pre-dates `expirationTime`. */
  public isExpired(expirationTime: BeTimePoint): boolean {
    return this._timePoint.before(expirationTime) && !IModelApp.tileAdmin.isTileInUse(this);
  }

  /** Updates the timestamp to the specified time and marks the tile as being in use by the specified viewport. */
  public mark(vp: Viewport, time: BeTimePoint): void {
    this._timePoint = time;
    IModelApp.tileAdmin.markTileUsedByViewport(this, vp);
  }
}
