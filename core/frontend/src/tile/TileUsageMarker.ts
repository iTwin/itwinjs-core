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

/** A marker associated with a [[Tile]] to track usage of that tile by any number of viewports.
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
