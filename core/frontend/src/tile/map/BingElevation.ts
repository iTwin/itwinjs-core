/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tiles
 */
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { BilinearPatch, Point2d, Point3d, Range1d, Range2d, Range3d } from "@bentley/geometry-core";
import { Cartographic, ColorDef, FillFlags, LinePixels, QParams3d, QPoint3d, RenderTexture, TextureMapping } from "@bentley/imodeljs-common";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../imodeljs-frontend";
import { Mesh, MeshArgs } from "../../render-primitives";
import { DisplayParams } from "../../render/primitives/DisplayParams";
import { Triangle } from "../../render/primitives/Primitives";
import { VertexKey } from "../../render/primitives/VertexKey";
import { MeshParams } from "../../render/primitives/VertexTable";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderSystem } from "../../render/RenderSystem";

// cspell:ignore atae qdng uyzv auje sealevel

/** Provides an interface to the [Bing Maps elevation services](https://docs.microsoft.com/en-us/bingmaps/rest-services/elevations/).
 * @public
 */
export class BingElevationProvider {
  private static _scratchRange = Range3d.createNull();
  private static _scratchVertex = Point3d.createZero();
  private static _scratchQParams = QParams3d.fromRange(BingElevationProvider._scratchRange);
  private static _scratchQPoint = QPoint3d.create(BingElevationProvider._scratchVertex, BingElevationProvider._scratchQParams);
  private static _scratchMeshArgs = new MeshArgs();
  private static _scratchUV = Point2d.createZero();
  private static _scratchPoint = Point3d.createZero();

  private _heightRangeRequestTemplate: string;
  private _seaLevelOffsetRequestTemplate: string;
  private _heightListRequestTemplate: string;
  protected _requestContext = new ClientRequestContext("");

  /** @public */
  constructor() {
    let bingKey = "";
    if (IModelApp.mapLayerFormatRegistry.configOptions.BingMaps) {
      bingKey = IModelApp.mapLayerFormatRegistry.configOptions.BingMaps.value;
    }
    this._heightRangeRequestTemplate = "https://dev.virtualearth.net/REST/v1/Elevation/Bounds?bounds={boundingBox}&rows=16&cols=16&heights=ellipsoid&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
    this._seaLevelOffsetRequestTemplate = "https://dev.virtualearth.net/REST/v1/Elevation/SeaLevel?points={points}&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
    this._heightListRequestTemplate = "https://dev.virtualearth.net/REST/v1/Elevation/List?points={points}&heights={heights}&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
  }

  /** Return the height (altitude) at a given cartographic location.
   * If geodetic is true (the default) then height is returned in the Ellipsoidal WGS84 datum.  If geodetic is false then the sea level height id returned using the Earth Gravitational Model 2008 (EGM2008 2.5’).
   * @public
   */
  public async getHeight(carto: Cartographic, geodetic = true) {
    if (undefined === carto)
      return 0.0;
    const requestUrl = this._heightListRequestTemplate.replace("{points}", `${carto.latitudeDegrees},${carto.longitudeDegrees}`).replace("{heights}", geodetic ? "ellipsoid" : "sealevel");
    const requestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      const tileResponse: Response = await request(this._requestContext, requestUrl, requestOptions);
      return tileResponse.body.resourceSets[0].resources[0].elevations[0];
    } catch (error) {
      return 0.0;
    }
  }
  /** @internal */
  private async getHeights(range: Range2d) {
    const boundingBox = `${range.low.y},${range.low.x},${range.high.y},${range.high.x}`;
    const requestUrl = this._heightRangeRequestTemplate.replace("{boundingBox}", boundingBox);
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      const tileResponse: Response = await request(this._requestContext, requestUrl, tileRequestOptions);
      return tileResponse.body.resourceSets[0].resources[0].elevations;
    } catch (error) {
      return undefined;
    }
  }
  /** @internal */
  public async getGeodeticToSeaLevelOffset(point: Point3d, iModel: IModelConnection): Promise<number> {
    const carto = iModel.spatialToCartographicFromEcef(point);
    if (carto === undefined)
      return 0.0;
    const requestUrl = this._seaLevelOffsetRequestTemplate.replace("{points}", `${carto.latitudeDegrees},${carto.longitudeDegrees}`);
    const requestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      const tileResponse: Response = await request(this._requestContext, requestUrl, requestOptions);
      return tileResponse.body.resourceSets[0].resources[0].offsets[0];
    } catch (error) {
      return 0.0;
    }
  }
  /** Get the height (altitude) at a given iModel coordinate.  The height is geodetic (WGS84 ellipsoid)
   * If geodetic is true (the default) then height is returned in the Ellipsoidal WGS84 datum.  If geodetic is false then sea level height is returned using the Earth Gravitational Model 2008 (EGM2008 2.5’).
   *
   * @public
   */
  public async getHeightValue(point: Point3d, iModel: IModelConnection, geodetic = true): Promise<number> {
    return this.getHeight(iModel.spatialToCartographicFromEcef(point), geodetic);
  }

  /** Get the height (altitude) range for a given iModel project extents. The height values are  geodetic (WGS84 ellipsoid).
   * @public
   */
  public async getHeightRange(iModel: IModelConnection) {
    const latLongRange = Range2d.createNull();
    const range = iModel.projectExtents.clone();
    range.expandInPlace(1000.);         // Expand for project surroundings.
    for (const corner of range.corners()) {
      const carto = iModel.spatialToCartographicFromEcef(corner);
      latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
    }
    const heights = await this.getHeights(latLongRange);
    return Range1d.createArray(heights);
  }

  /** Get the average height (altitude) for a given iModel project extents.  The height values are geodetic (WGS84 ellipsoid).
   * @public
   */
  public async getHeightAverage(iModel: IModelConnection) {
    const latLongRange = Range2d.createNull();
    for (const corner of iModel.projectExtents.corners()) {
      const carto = iModel.spatialToCartographicFromEcef(corner);
      latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
    }
    const heights = await this.getHeights(latLongRange);
    let total = 0.0;
    for (const height of heights) total += height;
    return total / heights.length;
  }
  /** @internal */
  public async getGraphic(latLongRange: Range2d, corners: Point3d[], groundBias: number, texture: RenderTexture, system: RenderSystem): Promise<RenderGraphic | undefined> {
    const heights = await this.getHeights(latLongRange);
    if (undefined === heights)
      return undefined;

    const patch = new BilinearPatch(corners[0], corners[1], corners[2], corners[3]);
    const textureParams = new TextureMapping.Params({ mapMode: TextureMapping.Mode.Parametric });
    const textureMapping = new TextureMapping(texture, textureParams);
    const displayParams = new DisplayParams(DisplayParams.Type.Mesh, ColorDef.white, ColorDef.white, 0.0, LinePixels.Solid, FillFlags.None, undefined, undefined, false, textureMapping);
    BingElevationProvider._scratchRange.setNull();
    BingElevationProvider._scratchRange.extendArray(corners);
    BingElevationProvider._scratchRange.low.z = 10E8;
    BingElevationProvider._scratchRange.high.z = -1.0E8;

    for (const height of heights) {
      BingElevationProvider._scratchRange.low.z = Math.min(BingElevationProvider._scratchRange.low.z, height);
      BingElevationProvider._scratchRange.high.z = Math.max(BingElevationProvider._scratchRange.high.z, height);
    }

    BingElevationProvider._scratchRange.low.z += groundBias;
    BingElevationProvider._scratchRange.high.z += groundBias;

    BingElevationProvider._scratchQParams.setFromRange(BingElevationProvider._scratchRange);
    const mesh = Mesh.create({ displayParams, type: Mesh.PrimitiveType.Mesh, range: BingElevationProvider._scratchRange, isPlanar: false, is2d: false });
    const size = 16;
    const sizeM1 = size - 1;
    const triangle0 = new Triangle(false), triangle1 = new Triangle(false);
    for (let row = 0; row < sizeM1; row++) {
      const thisRowIndex = row * size;
      const nextRowIndex = thisRowIndex + size;
      for (let col = 0; col < size - 1; col++) {
        const q0 = thisRowIndex + col, q1 = q0 + 1, q3 = nextRowIndex + col, q2 = q3 + 1;
        triangle0.setIndices(q0, q1, q2);
        triangle1.setIndices(q0, q2, q3);
        mesh.addTriangle(triangle0);
        mesh.addTriangle(triangle1);
      }
    }
    BingElevationProvider._scratchUV.y = 0.0;
    const delta = 1.0 / sizeM1;
    for (let row = 0; row < size; row++, BingElevationProvider._scratchUV.y += delta) {
      BingElevationProvider._scratchUV.x = 0;
      for (let col = 0; col < size; col++, BingElevationProvider._scratchUV.x += delta) {
        patch.uvFractionToPoint(BingElevationProvider._scratchUV.x, BingElevationProvider._scratchUV.y, BingElevationProvider._scratchPoint);
        BingElevationProvider._scratchPoint.z = groundBias + heights[(sizeM1 - row) * size + col];
        BingElevationProvider._scratchQPoint.init(BingElevationProvider._scratchPoint, BingElevationProvider._scratchQParams);
        mesh.addVertex(VertexKey.create({ position: BingElevationProvider._scratchQPoint, fillColor: 0xffffff, uvParam: BingElevationProvider._scratchUV }));
      }
    }
    BingElevationProvider._scratchMeshArgs.init(mesh);
    return system.createMesh(MeshParams.create(BingElevationProvider._scratchMeshArgs));
  }
}
