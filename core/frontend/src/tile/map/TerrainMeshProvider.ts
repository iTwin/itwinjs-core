/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Id64String } from "@itwin/core-bentley";
import { Range1d } from "@itwin/core-geometry";
import { RequestOptions } from "@bentley/itwin-client";
import { IModelConnection } from "../../IModelConnection";
import { TerrainMeshPrimitive } from "../../render/primitives/mesh/TerrainMeshPrimitive";
import { MapCartoRectangle, MapTile, MapTilingScheme, QuadId, Tile } from "../internal";

/** Abstract base class for terrain mesh providers responsible for producing geometry background map tiles.
 * @see [[EllipsoidTerrainMeshProvider]]
 * @see [[CesiumTerrainMeshProvider]]
 * @internal
 */
export abstract class TerrainMeshProvider {
  constructor(protected _iModel: IModelConnection, protected _modelId: Id64String) { }
  public constructUrl(_row: number, _column: number, _zoomLevel: number): string { assert(false); return ""; }
  public getLogo(): HTMLTableRowElement | undefined { return undefined; }
  public abstract isTileAvailable(quadId: QuadId): boolean;
  public get requestOptions(): RequestOptions { return { method: "GET", responseType: "arraybuffer" }; }
  public abstract get maxDepth(): number;
  public async getMesh(_tile: MapTile, _data: Uint8Array): Promise<TerrainMeshPrimitive | undefined> { return undefined; }
  public abstract getChildHeightRange(_quadId: QuadId, _rectangle: MapCartoRectangle, _parent: MapTile): Range1d | undefined;
  public abstract get tilingScheme(): MapTilingScheme;
  public forceTileLoad(_tile: Tile): boolean { return false; }
  public get requiresLoadedContent() { return true; }
}
