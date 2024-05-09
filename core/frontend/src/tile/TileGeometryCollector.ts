/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { IndexedPolyface, Range3d, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import {
  Tile, TileTreeReference, TileUser,
} from "./internal";

/** Enumerates the statuses returned by [[TileGeometryCollector.collectTile]].
 * - "accept": The tile's geometry should be collected.
 * - "reject": The tile's geometry (and that of all of its child tiles) should be omitted.
 * - "continue": The tile's geometry should be omitted, but that of its child tiles should be evaluated for collection.
 * @beta
 */
export type CollectTileStatus = "accept" | "reject" | "continue";

/** Options for creating a [[TileGeometryCollector]].
 * @beta
 */
export interface TileGeometryCollectorOptions {
  /** The chord tolerance in meters describing the minimum level of detail desired of the tile geometry. */
  chordTolerance: number;
  /** The volume in which to collect tiles. Geometry of tiles that do not intersect this volume will not be collected. */
  range: Range3d;
  /** The [[TileUser]] that will make use of the tiles. */
  user: TileUser;
  /** An optional transform to be applied to the tile ranges before testing intersection with [[range]]. Typically this is obtained from [[TileTree.iModelTransform]]. */
  transform?: Transform;
}

/** Collects geoemtry from a [[GeometryTileTreeReference]] within a specified volume at a specified level of detail.
 * Subclasses can refine the collection criterion.
 * The tile geometry is obtained asynchronously, so successive collections over multiple frames may be required before all of the geometry
 * is collected.
 * @beta
 */
export class TileGeometryCollector {
  /** The list of accumulated polyfaces, populated during [[GeometryTileTreeReference.collectTileGeometry]].
   * The polyfaces belong to the [[Tile]]s - they should not be modified.
   * If [[isAllGeometryLoaded]] is `false`, then this list is incomplete - another geometry collection should be performed with a new collector on a subsequent frame.
   */
  public readonly polyfaces: IndexedPolyface[] = [];
  private readonly _missing = new Set<Tile>();
  private _loading = false;
  /** The options used to construct this collector. */
  protected readonly _options: TileGeometryCollectorOptions;

  /** Create a new collector. */
  public constructor(options: TileGeometryCollectorOptions) {
    this._options = options;
  }

  /** Allows an implementation of [[GeometryTileTreeReference.collectTileGeoemtry]] to indicate that further loading is required before
   * the collection can be completed.
   * This will cause [[isAllGeometryLoaded]] to return `false`.
   */
  public markLoading(): void {
    this._loading = true;
  }

  /** Enqueues requests to obtain the content of any tiles whose content is required to complete the geometry collection.
   * @see [[isAllGeometryLoaded]] to determine if geometry collection is complete.
   */
  public requestMissingTiles(): void {
    IModelApp.tileAdmin.requestTiles(this._options.user, this._missing);
  }

  /** Allows an implementation of [[GeometryTileTreeReference.collectTileGeometry]] to indicate that the specified tile's content must be loaded
   * before geometry collection can be completed.
   * This will cause [[isAllGeometryLoaded]] to return `false`.
   */
  public addMissingTile(tile: Tile): void {
    this._missing.add(tile);
  }

  /** Returns true if [[polyfaces]] has been fully populated with all the geometry satisfying this collector's criteria.
   * If it returns false, another collection using a new collector should be performed on a subsequent frame to load more geometry.
   */
  public get isAllGeometryLoaded(): boolean {
    return !this._loading && this._missing.size === 0;
  }

  /** Determine whether to collect the specified tile's geometry, reject it, or to evaluate the geometry of its child tiles for collection.
   * This base implementation makes that determination based on the collector's range and chord tolerance. Subclasses should typically call `super.collectTile` and, if
   * it returns "accept" or "continue", apply their own criteria to the tile.
   */
  public collectTile(tile: Tile): CollectTileStatus {
    const range = this._options.transform ? this._options.transform.multiplyRange(tile.range) : tile.range;
    if (!range.intersectsRange(this._options.range))
      return "reject";

    if (tile.maximumSize === 0 || !tile.isDisplayable)
      return "continue";

    const tolerance = tile.radius / tile.maximumSize;
    return tolerance < this._options.chordTolerance ? "accept" : "continue";
  }
}

/** A [[TileTreeReference]] that can supply geometry in the form of [Polyface]($core-geometry)s from [[Tile]]s belonging to its [[TileTree]] and satisfying the criteria defined
 * by a [[TileGeometryCollector]].
 * Use [[TileTreeReference.createGeometryTreeReference]] to obtain a GeometryTileTreeReference from an existing TileTreeReference.
 * @beta
 */
export interface GeometryTileTreeReference extends TileTreeReference {
  /** Populate [[TileGeometryCollector.polyfaces]] with geometry satisfying `collector`'s criteria.
   * Because tile geometry is obtained asynchronously, successive collections over multiple frames may be required before the list of polyfaces is fully populated.
   * @see [[TileGeometryCollector.isAllGeometryLoaded]] to determine if the list of polyfaces is fully populated.
   */
  collectTileGeometry: (collector: TileGeometryCollector) => void;
}
