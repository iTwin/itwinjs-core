/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@itwin/core-bentley";
import { Cartographic, GeoCoordStatus } from "@itwin/core-common";
import { BackgroundMapGeometry, GraphicPrimitive, IModelConnection } from "@itwin/core-frontend";
import { GrowableXYZArray, LineString3d, Loop, Point3d, RegionBinaryOpType, RegionOps } from "@itwin/core-geometry";
import { ArcGisFeatureBaseRenderer} from "./ArcGisFeatureRenderer";
import { WebMercator } from "../Utils/WebMercator";
const loggerCategory =  "MapLayersFormats.ArcGISFeature";

export class ArcGisFeatureGraphicsRenderer extends ArcGisFeatureBaseRenderer {

  private _scratchPointsArray = new GrowableXYZArray();
  private _scratchPaths: Point3d[][] = [];
  private _graphics: GraphicPrimitive[] = [];
  private _bgGeometry: BackgroundMapGeometry|undefined;
  private _iModel: IModelConnection;

  public moveGraphics() {
    const graphics = this._graphics;
    this._graphics = [];
    return graphics;
  }

  constructor(iModel: IModelConnection, bgGeometry?: BackgroundMapGeometry) {
    super();
    this._bgGeometry = bgGeometry;
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
    this._scratchPointsArray.push({x,y, z:0});
  }

  protected async moveTo(x: number, y: number) {

    if (this._scratchPointsArray.length > 0) {
      this._scratchPaths.push(this._scratchPointsArray.getArray());
      this._scratchPointsArray.clear();
    }

    this._scratchPointsArray.push({x, y, z:0});
  }

  protected async fill() {
    if (this._scratchPaths.length>0) {

      const loops = [];
      for (const points of this._scratchPaths) {
        loops.push(Loop.create(LineString3d.create(points)));
      }
      const merged = RegionOps.regionBooleanXY(loops, undefined, RegionBinaryOpType.Union);
      if (merged) {
        const mergedLoops = RegionOps.constructAllXYRegionLoops(merged);
        for (const loop of mergedLoops) {
          for (const negativeLoop of loop.negativeAreaLoops) {
            this._graphics.push({type: "loop", loop:negativeLoop});
          }
        }
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

  protected async stroke() {

    if (this._scratchPointsArray.length > 0) {
      this._scratchPaths.push(this._scratchPointsArray.getArray());
      this._scratchPointsArray.clear();
    }

    if (this._bgGeometry) {
      const promises = [];
      for (const linestring of this._scratchPaths) {

        const pointPromises = [];
        for (const pt of linestring) {
          pointPromises.push(this._bgGeometry.cartographicToDbFromGcs(Cartographic.fromDegrees({longitude: WebMercator.getEPSG4326Lon(pt.x), latitude:WebMercator.getEPSG4326Lat(pt.y)})));
        }
        promises.push(Promise.all(pointPromises));
      }

      try {
        const primitivesPoints = await Promise.all(promises);
        for (const points of primitivesPoints)
          this._graphics.push({type: "linestring", points});
      } catch (error) {
        Logger.logError(loggerCategory, "ArcGisFeatureGraphicsRenderer: Could not reproject points");
      }
    } else {
      for (const points of this._scratchPaths) {
        this._graphics.push({type: "linestring", points});
      }
    }

    this._scratchPaths = [];
  }

  protected async stroke2() {
    if (this._scratchPointsArray.length > 0) {
      this._graphics.push({type: "linestring", points:this._scratchPointsArray.getArray()});
      this._scratchPointsArray.clear();
    }
    if (this._bgGeometry) {
      const geoConverter = this._iModel.geoServices.getConverter()!;
      const reprojected: GraphicPrimitive[] = [];
      const promises = [];
      for (const primitive of this._graphics) {

        if (primitive.type === "linestring") {
          const cartoPoints = [];
          for (const pt of primitive.points)
            cartoPoints.push(Point3d.create(WebMercator.getEPSG4326Lon(pt.x), WebMercator.getEPSG4326Lat(pt.y), 0));
          promises.push(geoConverter.getIModelCoordinatesFromGeoCoordinates(cartoPoints));
        }
      }

      const mergedPromises = await Promise.all(promises);
      for (const response of mergedPromises) {
        const points = [];
        for (const pointRes of response.iModelCoords) {
          if (pointRes.s === GeoCoordStatus.Success)
            points.push(Point3d.fromJSON(pointRes.p));
        }
        reprojected.push({type: "linestring", points});

      }

      this._graphics = reprojected;
    }

  }

  protected override drawPoint(x: number, y: number): void {
    this._scratchPointsArray.push({x, y , z:0});
  }

  protected override async finishPoints() {
    if (this._scratchPointsArray.length > 0) {

      if (this._bgGeometry) {
        const pointPromises = [];
        const pointsArray = this._scratchPointsArray.getArray();
        for (const pt of pointsArray) {
          pointPromises.push(this._bgGeometry.cartographicToDbFromGcs(Cartographic.fromDegrees({longitude: WebMercator.getEPSG4326Lon(pt.x), latitude:WebMercator.getEPSG4326Lat(pt.y)})));
        }
        try {
          const primitivesPoints = await Promise.all(pointPromises);
          this._graphics.push({type: "pointstring", points: primitivesPoints});
        } catch (error) {
          Logger.logError(loggerCategory, "ArcGisFeatureGraphicsRenderer: Could not reproject points");
        }
      } else {
        this._graphics.push({type: "pointstring", points: this._scratchPointsArray.getArray()});
      }

      this._scratchPointsArray.clear();
    }
  }

}
