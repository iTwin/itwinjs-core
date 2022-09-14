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
import { ScreenViewport } from "../../Viewport";
import { TerrainMeshPrimitive } from "../../render/primitives/mesh/TerrainMeshPrimitive";
import {
  MapCartoRectangle, MapTile, MapTilingScheme, QuadId, Tile, TileRequest,
} from "../internal";

export interface TerrainMeshProviderOptions {
  iModel: IModelConnection;
  modelId: Id64String;
  exaggeration: number;
  wantSkirts: boolean;
  wantNormals: boolean;
}

/** Abstract base class for terrain mesh providers responsible for producing geometry background map tiles.
 * @beta
 */
export abstract class TerrainMeshProvider {
  public readonly iModel: IModelConnection;
  public readonly modelId: Id64String;

  protected constructor(options: TerrainMeshProviderOptions) {
    this.iModel = options.iModel;
    this.modelId = options.modelId;
  }

  public abstract requestMeshData(tile: MapTile, isCanceled: () => boolean): Promise<TileRequest.Response>;
  public abstract loadMesh(meshData: TileRequest.ResponseData, isCanceled: () => boolean, tile: MapTile): Promise<TerrainMeshPrimitive | undefined>;

  public addLogoCards(_cards: HTMLTableElement, _vp: ScreenViewport): void { }
  public abstract isTileAvailable(quadId: QuadId): boolean;
  public abstract get maxDepth(): number;
  public abstract getChildHeightRange(_quadId: QuadId, _rectangle: MapCartoRectangle, _parent: MapTile): Range1d | undefined;
  public abstract get tilingScheme(): MapTilingScheme;
  public forceTileLoad(_tile: Tile): boolean { return false; }
}
