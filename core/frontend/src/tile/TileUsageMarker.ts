/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeTimePoint } from "@bentley/bentleyjs-core";
import { IModelApp } from "../IModelApp";
import { Viewport } from "../Viewport";
import { ReadonlyViewportSet } from "../ViewportSet";

/** A marker associated with a [[Tile]] to track usage of that tile by any number of viewports.
 * The marker tracks:
 *  - the set of [[Viewport]]s in which the tile is in use for some purpose (displayed, preloaded, requested, selected for shadow map, etc); and
 *  - the most recent time at which any viewport declared its use of the tile.
 * The marker is used to allow tiles to be discarded after they become disused by any viewport, via [[Tile.prune]].
 * @beta
 */
export class TileUsageMarker {
  private _viewports: ReadonlyViewportSet;
  private _timePoint = BeTimePoint.now();

  /** Constructs a usage marker with its timepoint set to the current time and its set of viewports empty. */
  public constructor() {
    this._viewports = IModelApp.tileAdmin.emptyViewportSet;
  }

  /** Returns true if this tile is currently in use by no viewports and its timestamp pre-dates `expirationTime`. */
  public isExpired(expirationTime: BeTimePoint): boolean {
    return this._viewports.isEmpty && this._timePoint.before(expirationTime);
  }

  /** Updates the timestamp to the specified time and marks the tile as being in use by the specified viewport. */
  public mark(vp: Viewport, time: BeTimePoint): void {
    this._timePoint = time;
    this._viewports = IModelApp.tileAdmin.getViewportSetForUsage(vp, this._viewports);
  }
}
