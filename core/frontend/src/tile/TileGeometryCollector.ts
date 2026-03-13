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
 * @public
 */
export type CollectTileStatus = "accept" | "reject" | "continue";

/** Options for creating a [[TileGeometryCollector]].
 * @public
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

/** Tracks metadata about collected tile geometry for resolution-based filtering.
 * @internal
 */
interface CollectedTileInfo {
  depth: number;
  range: Range3d;
  polyfaces: IndexedPolyface[];
}

/** Collects geoemtry from a [[GeometryTileTreeReference]] within a specified volume at a specified level of detail.
 * Subclasses can refine the collection criterion.
 * The tile geometry is obtained asynchronously, so successive collections over multiple frames may be required before all of the geometry
 * is collected.
 * @public
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
  /** @internal Tracks collected tiles for resolution-based filtering. */
  private readonly _collectedTiles: CollectedTileInfo[] = [];
  /** @internal Whether resolution-based overlap filtering has been applied. */
  private _overlapFiltered = false;
  /** @internal The minimum depth difference required to consider a tile as "significantly higher resolution" than another.
   * A tile that is this many levels deeper is considered to supersede a shallower tile covering the same area.
   * The value of 4 was chosen empirically: reality tile trees often have branches at vastly different depths
   * (e.g., depth 6 for low-res overview tiles vs depth 13+ for high-res detail tiles). A difference of 4 levels
   * corresponds to roughly 16x difference in tile size, which reliably distinguishes low-res fallback geometry
   * from higher-resolution content.
   */
  private static readonly _minDepthDifferenceForOverlap = 4;

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

  /** @internal Register collected tile geometry with metadata for resolution-based filtering.
   * This enables filtering out low-resolution tile geometry when higher-resolution tiles cover the same spatial area.
   * @param tile The tile whose geometry is being collected.
   * @param tilePolyfaces The polyfaces from this tile.
   */
  public addTileGeometry(tile: Tile, tilePolyfaces: IndexedPolyface[]): void {
    if (tilePolyfaces.length === 0)
      return;

    // Transform the content range if a transform is specified; otherwise use the range directly (no clone needed since we only read from it)
    const range = this._options.transform ? this._options.transform.multiplyRange(tile.contentRange) : tile.contentRange;
    this._collectedTiles.push({ depth: tile.depth, range, polyfaces: tilePolyfaces });
    this.polyfaces.push(...tilePolyfaces);
  }

  /** @internal Filter out polyfaces from tiles that are significantly lower resolution than other tiles covering the same spatial area.
   * This addresses the issue where geometry from different tile tree branches may overlap spatially, causing duplicate geometry collection results.
   * The rendering path handles this via Z-buffer occlusion, but geometry collection accumulates all polyfaces without occlusion.
   * This method removes low-resolution polyfaces when higher-resolution polyfaces cover the same area.
   * @note This is an O(n²) algorithm where n is the number of collected tiles.
   */
  public filterOverlappingLowResolutionGeometry(): void {
    if (this._overlapFiltered || this._collectedTiles.length <= 1)
      return;

    this._overlapFiltered = true;

    // Quick check: find the depth range to see if filtering could possibly change anything
    let minDepth = Number.MAX_SAFE_INTEGER;
    let maxDepth = 0;
    for (const tile of this._collectedTiles) {
      minDepth = Math.min(minDepth, tile.depth);
      maxDepth = Math.max(maxDepth, tile.depth);
    }
    if (maxDepth - minDepth < TileGeometryCollector._minDepthDifferenceForOverlap)
      return; // No tiles differ enough in depth to warrant filtering

    // Find tiles that are covered by significantly higher resolution tiles
    const tilesToRemove = new Set<CollectedTileInfo>();
    for (const tile of this._collectedTiles) {
      // Skip tiles that are already at max depth or close to it - they can't be superseded
      if (maxDepth - tile.depth < TileGeometryCollector._minDepthDifferenceForOverlap)
        continue;

      for (const otherTile of this._collectedTiles) {
        if (tile === otherTile)
          continue;

        // Check if otherTile is significantly deeper (higher resolution)
        const depthDifference = otherTile.depth - tile.depth;
        if (depthDifference < TileGeometryCollector._minDepthDifferenceForOverlap)
          continue;

        // Check if otherTile's range overlaps with this tile's range
        if (!tile.range.intersectsRange(otherTile.range))
          continue;

        // This tile is covered by a significantly higher resolution tile - mark for removal
        tilesToRemove.add(tile);
        break; // No need to check other tiles, this one is already marked
      }
    }

    // Remove polyfaces from the tiles marked for removal
    if (tilesToRemove.size > 0) {
      const polyfacesToRemove = new Set<IndexedPolyface>();
      for (const tile of tilesToRemove)
        for (const polyface of tile.polyfaces)
          polyfacesToRemove.add(polyface);

      // Filter the polyfaces array in place for efficiency (avoids creating a new array)
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < this.polyfaces.length; readIndex++) {
        if (!polyfacesToRemove.has(this.polyfaces[readIndex])) {
          if (writeIndex !== readIndex)
            this.polyfaces[writeIndex] = this.polyfaces[readIndex];
          writeIndex++;
        }
      }
      this.polyfaces.length = writeIndex;
    }
  }
}

/** A [[TileTreeReference]] that can supply geometry in the form of [Polyface]($core-geometry)s from [[Tile]]s belonging to its [[TileTree]] and satisfying the criteria defined
 * by a [[TileGeometryCollector]].
 * Use [[TileTreeReference.createGeometryTreeReference]] to obtain a GeometryTileTreeReference from an existing TileTreeReference.
 * @public
 */
export interface GeometryTileTreeReference extends TileTreeReference {
  /** Populate [[TileGeometryCollector.polyfaces]] with geometry satisfying `collector`'s criteria.
   * Because tile geometry is obtained asynchronously, successive collections over multiple frames may be required before the list of polyfaces is fully populated.
   * @see [[TileGeometryCollector.isAllGeometryLoaded]] to determine if the list of polyfaces is fully populated.
   */
  collectTileGeometry: (collector: TileGeometryCollector) => void;
  /** If set to true, tile geometry will be reprojected using the tile's reprojection transform when geometry is collected from the referenced TileTree.
   * Currently only applies to point clouds, reality meshes, and terrain.
   * @internal
   */
  reprojectGeometry?: boolean;
}
