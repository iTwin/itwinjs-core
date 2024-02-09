/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Range1d } from "@itwin/core-geometry";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { ScreenViewport } from "../../Viewport";
import { RealityMeshParams } from "../../render/RealityMeshParams";
import {
  MapCartoRectangle, MapTile, MapTilingScheme, QuadId,
} from "../internal";

/** Options supplied to [[TerrainProvider.createTerrainMeshProvider]] to construct a [[TerrainMeshProvider]].
 * @public
 */
export interface TerrainMeshProviderOptions {
  /** A scale factor to be applied to the height of the terrain meshes.
   * @see [TerrainSettings.exaggeration]($common).
   */
  exaggeration: number;
  /** If true, the meshes should include "skirts" around their edges.
   * Skirts add new geometry to each of the four sides of a tile, extending downward. This helps to hide small cracks between adjacent tiles.
   * However, if transparency is applied to the terrain then, rather than hiding slight imperfections, the skirts themselves become visible.
   * So skirts are only requested when the terrain is displayed without transparency.
   *
   * A [[TerrainMeshProvider]] can ignore the request for skirts if it considers the risk of visible cracks acceptable.
   */
  wantSkirts: boolean;
  /** If true, each vertex of the terrain meshes should include a normal vector. Normals are requested when lighting or [ThematicDisplay]($common) are applied
   * to the terrain.
   *
   * A [[TerrainmeshProvider can ignore the request to produce normals, but doing so will prevent lighting and thematic display from applying to its terrain meshes.
   */
  wantNormals: boolean;
  /** Optionally identifies a specific terrain data source supplied by the [[TerrainMeshProvider]]. */
  dataSource?: string;
}

/** Arguments supplied to [[TerrainMeshProvider.requestMeshData]].
 * @public
 */
export interface RequestMeshDataArgs {
  /** The tile for which the terrain mesh is being requested. */
  tile: MapTile;
  /** Returns true if the request has been cancelled. Check this after performing an asynchronous action, and abort `requestMeshData` if it returns true. */
  isCanceled(): boolean;
}

/** Arguments supplied to [[TerrainMeshProvider.readMesh]].
 * @public
 */
export interface ReadMeshArgs {
  /** The mesh data obtained from [[TerrainMeshProvider.requestMeshData]]. */
  data: any;
  /** The tile for which the terrain mesh is being generated. */
  tile: MapTile;
  /** Returns true if the request has been cancelled. Check this after performing an asynchronous action, and abort `readMesh` if it returns true. */
  isCanceled(): boolean;
}

/** Provides 3d meshes representing terrain for display in a [[Viewport]].
 * Each mesh represents the terrain within a rectangular region of the Earth associated with a [[MapTile]].
 * The display system drapes background map imagery onto these meshes.
 * `TerrainMeshProvider`s are obtained from [[TerrainProvider]]s.
 * @note A terrain mesh provider is expected to produce terrain for all areas of the globe. If it lacks terrain data for an area of the globe,
 * it might choose to fall back to producing smooth terrain using an [[EllipsoidTerrainProvider]].
 * @see [[EllipsoidTerrainProvider]] for an example implementation that provides smooth terrain meshes.
 * @see [BingTerrainMeshProvider](https://github.com/iTwin/itwinjs-core/blob/master/test-apps/display-test-app/src/frontend/BingTerrainProvider.ts) for an example
 * implementation that produces 3d terrain meshes from elevations provided by [[BingElevationProvider]].
 * @public
 */
export abstract class TerrainMeshProvider {
  /** Obtain a representation of the terrain for a specific [[MapTile]]. The result will subsequently be supplied to [[readMesh]] to produce the mesh.
   * Return `undefined` if no mesh data could be obtained.
   */
  public abstract requestMeshData(args: RequestMeshDataArgs): Promise<any>;

  /** Convert the terrain data supplied by [[requestMeshData]] into a terrain mesh.
   * @see [[RealityMeshParamsBuilder]] to simplify the process of creating the mesh.
   */
  public abstract readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined>;

  /** Add attribution logo cards for the terrain data supplied by this provider to the [[Viewport]]'s logo div.
   * For example, a provider that produces meshes from [Bing Maps](https://docs.microsoft.com/en-us/bingmaps/rest-services/elevations/) would be required to
   * disclose any copyrighted data used in the production of those meshes.
   */
  public addLogoCards(_cards: HTMLTableElement, _vp: ScreenViewport): void { }

  /** Return whether terrain data can be obtained for the [[MapTile]] specified by `quadId`. If it returns false, a terrain mesh will instead be produced for
   * that tile by up-sampling the terrain mesh provided by its parent tile.
   * The default implementation returns `true`.
   */
  public isTileAvailable(_quadId: QuadId): boolean {
    return true;
  }

  /** Returns the maximum level of detail of the terrain meshes. */
  public abstract get maxDepth(): number;

  /** Returns the minimum and maximum elevation of the terrain within the specified region of the Earth.
   * This range is used for culling terrain meshes that do not intersect the view frustum.
   * The default implementation uses a fast approximation.
   */
  public getChildHeightRange(quadId: QuadId, rectangle: MapCartoRectangle, parent: MapTile): Range1d | undefined {
    return (quadId.level < ApproximateTerrainHeights.maxLevel) ? ApproximateTerrainHeights.instance.getMinimumMaximumHeights(rectangle) : parent.heightRange;
  }

  /** The tiling scheme used by this provider to convert between tile coordinates and geodetic coordinates. */
  public abstract get tilingScheme(): MapTilingScheme;

  /** Returns true if the specified tile should always be loaded. Some tiles contain required metadata and hence should always be loaded.
   * For example, a parent tile might contain information about the availability or height ranges of its child tiles that can be used to
   * implement [[isTileAvailable]] or [[getChildHeightRange]], respectively.
   */
  public forceTileLoad(_tile: MapTile): boolean { return false; }
}
