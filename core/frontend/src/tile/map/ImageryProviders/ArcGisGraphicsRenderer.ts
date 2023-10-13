/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@itwin/core-bentley";
import { Cartographic } from "@itwin/core-common";
import { GrowableXYZArray, LineString3d, Loop, Point3d, Point3dArray, RegionOps } from "@itwin/core-geometry";
import { ArcGisAttributeDrivenSymbology, ArcGisGeometryBaseRenderer, WebMercator } from "../../internal";
import { GraphicPrimitive } from "../../../render/GraphicPrimitive";
import { IModelConnection } from "../../../IModelConnection";
import { Viewport } from "../../../Viewport";

const loggerCategory = "MapLayerImageryProvider.ArcGisGraphicsRenderer";

/**
 * Properties of [[ArcGisGraphicsRenderer]]
 * @internal
 */
export interface ArcGisGraphicsRendererProps {
  /** The viewport in which the resultant [GraphicPrimitive]($frontend) is to be drawn. */
  viewport: Viewport;
}

/** ArcGIS geometry renderer implementation that will "render" a list of [GraphicPrimitive]($frontend)
 * This renderer initial objective is to read geometries when a call to [[MapLayerImageryProvider.getFeatureInfo]] is performed.
 * @internal
 */
export class ArcGisGraphicsRenderer extends ArcGisGeometryBaseRenderer {
  private _scratchPointsArray = new GrowableXYZArray();
  private _scratchPaths: Point3d[][] = [];
  private _graphics: GraphicPrimitive[] = [];
  private _iModel: IModelConnection;
  private _viewport: Viewport;

  public override get attributeSymbology(): ArcGisAttributeDrivenSymbology | undefined {return undefined;}   // No symbology is applied in this renderer

  constructor(props: ArcGisGraphicsRendererProps) {
    super();
    this._viewport = props.viewport;
    this._iModel = props.viewport.iModel;
  }

  public moveGraphics() {
    const graphics = this._graphics;
    this._graphics = [];
    return graphics;
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

      const pathPromises = [];
      for (const points of this._scratchPaths) {
        pathPromises.push(this.toSpatial(points));
      }

      const pathsArray = await Promise.all(pathPromises);
      for (const pointsArray of pathsArray) {
        loops.push(Loop.create(LineString3d.create(pointsArray)));
      }

      const mergedLoops = RegionOps.constructAllXYRegionLoops(loops);
      for (const loop of mergedLoops) {
        for (const negativeLoop of loop.negativeAreaLoops) {
          this._graphics.push({ type: "loop", loop: negativeLoop });
        }
      }

      this._scratchPaths = [];
    }
  }

  protected async stroke() {
    if (this._scratchPointsArray.length > 0) {
      this._scratchPaths.push(this._scratchPointsArray.getArray());
      this._scratchPointsArray.clear();
    }

    const pathPromises = [];
    for (const geoPt of this._scratchPaths) {
      pathPromises.push(this.toSpatial(geoPt));
    }

    const reprojectedPaths = await Promise.all(pathPromises);
    for (const path of reprojectedPaths) {
      this._graphics.push({ type: "linestring", points: Point3dArray.clonePoint3dArray(path) });
    }

    this._scratchPaths = [];
  }

  protected override drawPoint(x: number, y: number): void {
    this._scratchPointsArray.push({ x, y, z: 0 });
  }

  protected override async finishPoints() {
    if (this._scratchPointsArray.length > 0) {

      // Backend reprojection
      const pointsArray = this._scratchPointsArray.getArray();
      try {
        const spatialPoints = await this.toSpatial(pointsArray);
        this._graphics.push({ type: "pointstring", points: spatialPoints });
      } catch (error) {
        Logger.logError(loggerCategory, "ArcGisFeatureGraphicsRenderer: Could not reproject points");
      }

      this._scratchPointsArray.clear();
    }
  }

  private async toSpatial(geoPoints: Point3d[]) {
    const bgMapGeom = this._viewport.displayStyle.getBackgroundMapGeometry();
    if (bgMapGeom) {
      const cartoPts = geoPoints.map((pt) => Cartographic.fromDegrees({longitude: WebMercator.getEPSG4326Lon(pt.x), latitude: WebMercator.getEPSG4326Lat(pt.y), height: pt.z }));
      return bgMapGeom.cartographicToDbFromWgs84Gcs(cartoPts);
    }

    return [];
  }
}
