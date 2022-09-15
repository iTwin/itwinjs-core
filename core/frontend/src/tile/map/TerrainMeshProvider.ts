/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Id64String } from "@itwin/core-bentley";
import { Range1d } from "@itwin/core-geometry";
import { RequestOptions } from "../../request/Request";
import { IModelConnection } from "../../IModelConnection";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { ScreenViewport } from "../../Viewport";
import { RealityMeshParams } from "../../render/RealityMeshParams";
import {
  MapCartoRectangle, MapTile, MapTilingScheme, QuadId, Tile, TileRequest,
} from "../internal";

/** Options used to construct a [[TerrainMeshProvider]].
 * @beta
 */
export interface TerrainMeshProviderOptions {
  /** The iModel for which the terrain will be produced. */
  iModel: IModelConnection;
  /** A transient Id that will be used to identify the graphics produced from the provider's meshes. */
  modelId: Id64String;
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
}

/** Arguments supplied to [[TerrainMeshProvider.requestMeshData]].
 * @beta
 */
export interface RequestMeshDataArgs {
  /** The tile for which the terrain mesh is being requested. */
  tile: MapTile;
  /** Returns true if the request has been cancelled. Check this after performing an asynchronous action, and abort `requestMeshData` if it returns true. */
  isCanceled(): boolean;
}

/** Arguments supplied to [[TerrainMeshProvider.readMesh]].
 * @beta
 */
export interface ReadMeshArgs {
  /** The mesh data obtained from [[TerrainMeshProvider.requestMeshData]]. */
  data: TileRequest.ResponseData;
  /** The tile for which the terrain mesh is being generated. */
  tile: MapTile;
  /** Returns true if the request has been cancelled. Check this after performing an asynchronous action, and abort `readMesh` if it returns true. */
  isCanceled(): boolean;
}

/** Provides 3d meshes representing terrain for display in a [[Viewport]].
 * Each mesh represents the terrain within a rectangular region of the Earth associated with a [[MapTile]].
 * The display system drapes background map imagery onto these meshes.
 * @beta
 */
export abstract class TerrainMeshProvider {
  /** The iModel for which terrain will be produced. */
  public readonly iModel: IModelConnection;
  /** A transient Id used to identify the graphics produced from this provider's meshes. */
  public readonly modelId: Id64String;

  /** Construct a provider from the supplied options. */
  protected constructor(options: TerrainMeshProviderOptions) {
    this.iModel = options.iModel;
    this.modelId = options.modelId;
  }

  /** Obtain a representation of the terrain for a specific [[MapTile]]. The result will subsequently be supplied to [[readMesh]] to produce the mesh. */
  public abstract requestMeshData(args: RequestMeshDataArgs): Promise<TileRequest.Response>;

  /** Convert the terrain data supplied by [[requestMeshData]] into a terrain mesh. */
  public abstract readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined>;

  /** Add attribution logo cards for the terrain data supplied by this provider to the [[Viewport]]'s logo div.
   * For example, a provider that produces meshes from [Bing Maps](https://docs.microsoft.com/en-us/bingmaps/rest-services/elevations/) would be required to
   * disclose any copyrighted data used in the production of those meshes.
   */
  public addLogoCards(_cards: HTMLTableElement, _vp: ScreenViewport): void { }

  /** Return whether terrain data can be obtained for the [[MapTile]] specified by `quadId`. If it returns false, a terrain mesh will instead be produced for
   * that tile by up-sampling the terrain mesh provided by its parent tile.
   */
  public abstract isTileAvailable(quadId: QuadId): boolean;

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
