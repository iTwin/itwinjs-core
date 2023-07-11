/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Id64String } from "@itwin/core-bentley";
import { Polyface, Range1d } from "@itwin/core-geometry";
import { Feature, FeatureTable } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { RenderSystem } from "../../render/RenderSystem";
import { MapCartoRectangle, MapTile, QuadId, RealityTile, RealityTileLoader, TerrainMeshProvider, TerrainTileContent, Tile, TileLoadPriority, TileRequest } from "../internal";

/** Specialization of map tile loader that includes terrain geometry with map imagery draped on it.
 * @internal
 */
export class MapTileLoader extends RealityTileLoader {
  public get priority(): TileLoadPriority { return TileLoadPriority.Terrain; }
  public get clipLowResolutionTiles(): boolean { return true; }
  protected _applyLights = false;
  public readonly featureTable: FeatureTable;
  // public get heightRange(): Range1d | undefined { return this._heightRange; }
  protected readonly _heightRange: Range1d | undefined;
  public override get isContentUnbounded(): boolean { return true; }
  public isTileAvailable(quadId: QuadId) { return this.terrainProvider.isTileAvailable(quadId); }

  public constructor(protected _iModel: IModelConnection, protected _modelId: Id64String, protected _groundBias: number, private _terrainProvider: TerrainMeshProvider) {
    super();
    this.featureTable = new FeatureTable(0xffff, this._modelId);
    this.featureTable.insert(new Feature(this._modelId));
  }
  public getFeatureIndex(layerModelId: Id64String): number {
    return this.featureTable.insert(new Feature(layerModelId))!;
  }

  public get maxDepth(): number { return this._terrainProvider.maxDepth; }
  public get minDepth(): number { return 0; }
  public get terrainProvider(): TerrainMeshProvider { return this._terrainProvider; }

  public getRequestChannel(_tile: Tile) {
    // ###TODO use hostname from url - but so many layers to go through to get that...
    return IModelApp.tileAdmin.channels.getForHttp("itwinjs-imagery");
  }

  public async requestTileContent(tile: MapTile, isCanceled: () => boolean): Promise<TileRequest.Response> {
    assert(tile instanceof MapTile);
    try {
      const data = await this.terrainProvider.requestMeshData({ tile, isCanceled });
      return undefined !== data ? { data } : undefined;
    } catch (_) {
      return undefined;
    }
  }

  public override forceTileLoad(tile: MapTile): boolean {
    return this._terrainProvider.forceTileLoad(tile);
  }

  public override async loadTileContent(tile: MapTile, data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<TerrainTileContent> {
    assert("data" in data);
    isCanceled = isCanceled ?? (() => !tile.isLoading);

    const mesh = await this._terrainProvider.readMesh({ data: data.data, isCanceled, tile });
    if (!mesh || isCanceled())
      return {};

    const projection = tile.getProjection(tile.heightRange);
    const terrainGeometry = system.createTerrainMesh(mesh, projection.transformFromLocal, true);

    return {
      contentRange: projection.transformFromLocal.multiplyRange(projection.localRange),
      terrain: {mesh, renderGeometry: terrainGeometry},
    };
  }

  public loadPolyfaces(): Polyface[] | undefined {
    assert (false, "load polyFaces not implmented for map tiles");
  }

  public getChildHeightRange(quadId: QuadId, rectangle: MapCartoRectangle, parent: MapTile): Range1d | undefined {
    return this._terrainProvider.getChildHeightRange(quadId, rectangle, parent);
  }

  public async loadChildren(_tile: RealityTile): Promise<Tile[] | undefined> {
    assert(false); // children are generated synchronously in MapTile....
    return undefined;
  }
}
