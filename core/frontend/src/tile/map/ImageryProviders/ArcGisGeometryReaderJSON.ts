/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { deflateCoordinates, FeatureGeometryRenderer } from "../../internal";

/** @internal */
export class ArcGisGeometryReaderJSON {
  private _ringsOrPaths: boolean;
  private _points: boolean;
  private _fill: boolean;
  private _relativeCoords: boolean;
  private _renderer: FeatureGeometryRenderer;

  public constructor(geometryType: string, renderer: FeatureGeometryRenderer, relativeCoords = false) {
    this._ringsOrPaths = geometryType === "esriGeometryPolyline" || geometryType === "esriGeometryPolygon";
    this._points = geometryType === "esriGeometryPoint" || geometryType === "esriGeometryMultiPoint";
    this._fill = geometryType === "esriGeometryPolygon";
    this._renderer = renderer;
    this._relativeCoords = relativeCoords;
  }

  public async readGeometry(geometry: any) {
    if (this._ringsOrPaths) {
      await this.readRingsAndPaths(geometry, this._renderer, this._fill, this._relativeCoords);

    } else if (this._points) {
      await this.readPoints(geometry, this._renderer, this._relativeCoords);
    }
  }

  private async readRingsAndPaths(geometry: any, renderer: FeatureGeometryRenderer, fill: boolean, relativeCoords: boolean) {
    let offset = 0;
    const lengths: number[] = [];
    const coords: number[] = [];

    if (geometry?.rings) {
      for (const ring of geometry?.rings) {
        offset = deflateCoordinates(ring, coords, 2, offset);
        lengths.push(ring.length);
      }
    } else if (geometry?.paths) {
      for (const path of geometry?.paths) {
        offset = deflateCoordinates(path, coords, 2, offset);
        lengths.push(path.length);
      }
    }
    await renderer.renderPath(lengths, coords, fill, 2, relativeCoords);
  }

  private async readPoints(geometry: any, renderer: FeatureGeometryRenderer, relativeCoords: boolean) {
    if (geometry) {
      const lengths: number[] = [];
      const coords: number[] = [geometry.x, geometry.y];
      await renderer.renderPoint(lengths, coords, 2, relativeCoords);
    }
  }
}
