/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { Range3d, Range1d, Point3d, Point2d, Range2d, Angle, BilinearPatch } from "@bentley/geometry-core";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { QParams3d, QPoint3d, TextureMapping, RenderTexture, ColorDef, LinePixels, FillFlags } from "@bentley/imodeljs-common";
import { Mesh, MeshArgs } from "../render/primitives/mesh/MeshPrimitives";
import { DisplayParams } from "../render/primitives/DisplayParams";
import { Triangle } from "../render/primitives/Primitives";
import { VertexKey } from "../render/primitives/VertexKey";
import { MeshParams } from "../render/primitives/VertexTable";
import { request, Response, RequestOptions } from "@bentley/imodeljs-clients";
import { IModelConnection } from "../IModelConnection";
import { RenderSystem, RenderGraphic } from "../render/System";

/** @internal */
export class BingElevationProvider {
  private static _scratchRange = Range3d.createNull();
  private static _scratchVertex = Point3d.createZero();
  private static _scratchQParams = QParams3d.fromRange(BingElevationProvider._scratchRange);
  private static _scratchQPoint = QPoint3d.create(BingElevationProvider._scratchVertex, BingElevationProvider._scratchQParams);
  private static _scratchMeshArgs = new MeshArgs();
  private static _scratchUV = Point2d.createZero();
  private static _scratchPoint = Point3d.createZero();

  private _heightRequestTemplate: string;
  protected _requestContext = new ClientRequestContext("");

  constructor() {
    const bingKey = "AtaeI3QDNG7Bpv1L53cSfDBgBKXIgLq3q-xmn_Y2UyzvF-68rdVxwAuje49syGZt";
    this._heightRequestTemplate = "http://dev.virtualearth.net/REST/v1/Elevation/Bounds?bounds={boundingBox}&rows=16&cols=16&heights=sealevel&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
  }
  public async getHeights(range: Range2d) {
    const boundingBox = range.low.y + "," + range.low.x + "," + range.high.y + "," + range.high.x;
    const requestUrl = this._heightRequestTemplate.replace("{boundingBox}", boundingBox);

    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      const tileResponse: Response = await request(this._requestContext, requestUrl, tileRequestOptions);
      return tileResponse.body.resourceSets[0].resources[0].elevations;
    } catch (error) {
      return undefined;
    }
  }
  public async getRange(iModel: IModelConnection) {
    const latLongRange = Range2d.createNull();
    const range = iModel.projectExtents.clone();
    range.expandInPlace(1000.);         // Expand for project surroundings.
    for (const corner of range.corners()) {
      const carto = await iModel.spatialToCartographic(corner);
      latLongRange.extendXY(Angle.radiansToDegrees(carto.longitude), Angle.radiansToDegrees(carto.latitude));
    }
    const heights = await this.getHeights(latLongRange);
    return Range1d.createArray(heights);
  }
  public async getGraphic(latLongRange: Range2d, corners: Point3d[], texture: RenderTexture, system: RenderSystem): Promise<RenderGraphic | undefined> {
    const heights = await this.getHeights(latLongRange);
    if (undefined === heights)
      return undefined;

    const patch = new BilinearPatch(corners[0], corners[1], corners[2], corners[3]);
    const textureParams = new TextureMapping.Params({ mapMode: TextureMapping.Mode.Parametric });
    const textureMapping = new TextureMapping(texture!, textureParams);
    const displayParams = new DisplayParams(DisplayParams.Type.Mesh, ColorDef.white.clone(), ColorDef.white.clone(), 0.0, LinePixels.Solid, FillFlags.None, undefined, undefined, false, textureMapping);
    BingElevationProvider._scratchRange.setNull();
    BingElevationProvider._scratchRange.extendArray(corners);
    BingElevationProvider._scratchRange.low.z = 10E8;
    BingElevationProvider._scratchRange.high.z = -1.0E8;

    for (const height of heights) {
      BingElevationProvider._scratchRange.low.z = Math.min(BingElevationProvider._scratchRange.low.z, height);
      BingElevationProvider._scratchRange.high.z = Math.max(BingElevationProvider._scratchRange.high.z, height);
    }

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
    for (let row = 0; row < size; row++ , BingElevationProvider._scratchUV.y += delta) {
      BingElevationProvider._scratchUV.x = 0;
      for (let col = 0; col < size; col++ , BingElevationProvider._scratchUV.x += delta) {
        patch.uvFractionToPoint(BingElevationProvider._scratchUV.x, BingElevationProvider._scratchUV.y, BingElevationProvider._scratchPoint);
        BingElevationProvider._scratchPoint.z = heights[(sizeM1 - row) * size + col];
        BingElevationProvider._scratchQPoint.init(BingElevationProvider._scratchPoint, BingElevationProvider._scratchQParams);
        mesh.addVertex(VertexKey.create({ position: BingElevationProvider._scratchQPoint, fillColor: 0xffffff, uvParam: BingElevationProvider._scratchUV }));
      }
    }
    BingElevationProvider._scratchMeshArgs.init(mesh);
    return system.createMesh(MeshParams.create(BingElevationProvider._scratchMeshArgs));
  }
}
