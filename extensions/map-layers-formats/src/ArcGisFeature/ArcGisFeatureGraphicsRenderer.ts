/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@itwin/core-bentley";
import { Cartographic } from "@itwin/core-common";
import { GraphicPrimitive, IModelConnection } from "@itwin/core-frontend";
import { GrowableXYZArray, LineString3d, Loop, Point3d, Point3dArray, RegionOps } from "@itwin/core-geometry";
import { ArcGisFeatureBaseRenderer } from "./ArcGisFeatureRenderer";
import { WebMercator } from "../Utils/WebMercator";
const loggerCategory = "MapLayersFormats.ArcGISFeature";

export class ArcGisFeatureGraphicsRenderer extends ArcGisFeatureBaseRenderer {

  private _scratchPointsArray = new GrowableXYZArray();
  private _scratchPaths: Point3d[][] = [];
  private _graphics: GraphicPrimitive[] = [];
  private _iModel: IModelConnection;

  public moveGraphics() {
    const graphics = this._graphics;
    this._graphics = [];
    return graphics;
  }

  constructor(iModel: IModelConnection) {
    super();
    this._iModel = iModel;
  }

  protected beginPath() {
    this._scratchPointsArray.clear();
    this._scratchPaths = [];
  }

  protected closePath() {
    if (this._scratchPointsArray.length > 0) {
      this._scratchPaths.push(this._scratchPointsArray.getArray());
      this._scratchPointsArray.clear();
    }
  }

  protected async lineTo(x: number, y: number) {
    this._scratchPointsArray.push({ x, y, z: 0 });
  }

  protected async moveTo(x: number, y: number) {

    if (this._scratchPointsArray.length > 0) {
      this._scratchPaths.push(this._scratchPointsArray.getArray());
      this._scratchPointsArray.clear();
    }

    this._scratchPointsArray.push({ x, y, z: 0 });
  }

  protected async fill() {
    if (this._scratchPaths.length > 0) {
      const loops = [];
      if (this._iModel.noGcsDefined) {
        for (const points of this._scratchPaths) {
          loops.push(Loop.create(LineString3d.create(this.toSpatialFromEcf(points))));
        }
      } else {
        const pathPromises = [];
        for (const points of this._scratchPaths) {
          pathPromises.push(this.toSpatialFromGcs(points));
        }

        const pathsArray = await Promise.all(pathPromises);
        for (const pointsArray of pathsArray) {
          loops.push(Loop.create(LineString3d.create(pointsArray)));
        }
      }

      const mergedLoops = RegionOps.constructAllXYRegionLoops(loops);
      for (const loop of mergedLoops) {
        for (const negativeLoop of loop.negativeAreaLoops) {
          this._graphics.push({ type: "loop", loop: negativeLoop });
        }

        // const options = new StrokeOptions();
        // options.needNormals = false;
        // options.needParams = false;
        // const polyBuilder = PolyfaceBuilder.create(options);
        // const region = RegionOps.sortOuterAndHoleLoopsXY(this._loops);
        // polyBuilder.addGeometryQuery(region);
        // this._graphics.push({type: "polyface", polyface:polyBuilder.claimPolyface(), filled:true});

        this._scratchPaths = [];
      }
    }
  }

  protected async stroke() {

    if (this._scratchPointsArray.length > 0) {
      this._scratchPaths.push(this._scratchPointsArray.getArray());
      this._scratchPointsArray.clear();
    }

    if (this._iModel.noGcsDefined) {
      for (const linestring of this._scratchPaths) {
        this._graphics.push({ type: "linestring", points: this.toSpatialFromEcf(linestring) });
      }
    } else {
      const pathPromises = [];
      for (const noGcsDefined of this._scratchPaths) {
        pathPromises.push(this.toSpatialFromGcs(noGcsDefined));
      }

      const reprojectedPaths = await Promise.all(pathPromises);
      for (const path of reprojectedPaths) {
        this._graphics.push({ type: "linestring", points: Point3dArray.clonePoint3dArray(path) });
      }
    }
    this._scratchPaths = [];
  }

  protected override drawPoint(x: number, y: number): void {
    this._scratchPointsArray.push({ x, y, z: 0 });
  }

  protected override async finishPoints() {
    if (this._scratchPointsArray.length > 0) {

      if (this._iModel.noGcsDefined) {
        this._graphics.push({ type: "pointstring", points: this.toSpatialFromEcf(this._scratchPointsArray.getArray()) });
      } else {
        // Backend reprojection
        const pointsArray = this._scratchPointsArray.getArray();
        try {
          const spatialPointsProps = await this.toSpatialFromGcs(pointsArray);
          this._graphics.push({ type: "pointstring", points: Point3dArray.clonePoint3dArray(spatialPointsProps) });
        } catch (error) {
          Logger.logError(loggerCategory, "ArcGisFeatureGraphicsRenderer: Could not reproject points");
        }
      }
    }
  }

  private async toSpatialFromGcs(geoPoints: Point3d[]) {
    return this._iModel.toSpatialFromGcs(geoPoints, { horizontalCRS: { epsg: 3857 }, verticalCRS: { id: "ELLIPSOID" } });
  }

  private toSpatialFromEcf(geoPoints: Point3d[]) {
    const spatials = [];
    for (const pt of geoPoints) {
      const carto = { longitude: WebMercator.getEPSG4326Lon(pt.x), latitude: WebMercator.getEPSG4326Lat(pt.y), height: pt.z };
      spatials.push(this._iModel.cartographicToSpatialFromEcef(Cartographic.fromDegrees(carto)));
    }
    return spatials;

  }

}
