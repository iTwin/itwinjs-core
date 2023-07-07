/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ArcGisGeometryRenderer } from "../../internal";

/** @internal */
export class ArcGisGeometryReaderJSON {
  private _ringsOrPaths: boolean;
  private _points: boolean;
  private _fill: boolean;
  private _relativeCoords: boolean;
  private _renderer: ArcGisGeometryRenderer;

  public constructor(geometryType: string, renderer: ArcGisGeometryRenderer, relativeCoords = false) {
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

  private async readRingsAndPaths(geometry: any, renderer: ArcGisGeometryRenderer, fill: boolean, relativeCoords: boolean) {
    let offset = 0;
    const lengths: number[] = [];
    const coords: number[] = [];

    if (geometry?.rings) {
      for (const ring of geometry?.rings) {
        offset = ArcGisGeometryReaderJSON.deflateCoordinates(ring, coords, 2, offset);
        lengths.push(ring.length);
      }
    } else if (geometry?.paths) {
      for (const path of geometry?.paths) {
        offset = ArcGisGeometryReaderJSON.deflateCoordinates(path, coords, 2, offset);
        lengths.push(path.length);
      }
    }
    await renderer.renderPath(lengths, coords, fill, 2, relativeCoords);
  }

  private async readPoints(geometry: any, renderer: ArcGisGeometryRenderer, relativeCoords: boolean) {
    if (geometry) {
      const lengths: number[] = [];
      const coords: number[] = [geometry.x, geometry.y];
      await renderer.renderPoint(lengths, coords, 2, relativeCoords);
    }
  }

  // Converts an [[x1,y1], [x2,y2], ...] to [x1,y1,x2,y2, ...]
  // stride is the number of dimensions
  // https://github.com/openlayers/openlayers/blob/7a2f87caca9ddc1912d910f56eb5637445fc11f6/src/ol/geom/flat/deflate.js#L26
  protected static deflateCoordinates(coordinates: number[][], flatCoordinates: number[], stride: number, offset: number) {
    for (let i = 0, ii = coordinates.length; i < ii; ++i) {
      const coordinate = coordinates[i];
      for (let j = 0; j < stride; ++j)
        flatCoordinates[offset++] = coordinate[j];
    }

    return offset;
  }
}
