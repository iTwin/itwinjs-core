/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { CoordinatesUtils, FeatureGeometryRenderer } from "@itwin/core-frontend";
import { Coord, GeoJSONGeometryUtils, MultiPath, MultiRingCoords, RingCoords } from "./GeoJSONGeometry";
import * as GeoJson from "geojson";

const loggerCategory = "MapLayersFormats.GeoJSONGeometryReader";

/** @internal */
export class GeoJSONGeometryReader {
  private _renderer: FeatureGeometryRenderer;

  public constructor(renderer: FeatureGeometryRenderer) {
    this._renderer = renderer;
  }

  public async readGeometry(geometry: GeoJson.Geometry) {

    if (GeoJSONGeometryUtils.isRingOrPath(geometry)) {
      await this.readRingsAndPaths(geometry, this._renderer, GeoJSONGeometryUtils.isFilled(geometry), false /* relativeCoords*/);
    } else if (GeoJSONGeometryUtils.isPoint(geometry)) {
      await this.readPoints(geometry, this._renderer, false/* relativeCoords*/);
    } else {
      Logger.logError(loggerCategory, `GeoJSONGeometryReader:readGeometry - Unknown geometry type '${geometry.type}'`);
    }
  }

  private async readRingsAndPaths(geometry: GeoJson.Geometry, renderer: FeatureGeometryRenderer, fill: boolean, relativeCoords: boolean) {
    const multiPath: MultiPath = {coords: [], lengths: []};
    let polys: MultiPath[] | undefined;

    const readPath = (ring: RingCoords, offset: number, result: MultiPath) => {
      const newOffset = CoordinatesUtils.deflateCoordinates(ring, result.coords, 2, offset);
      result.lengths.push(ring.length);
      return newOffset;
    };

    const readMultiPath = (multiRings: MultiRingCoords, result: MultiPath) => {
      let offset = 0;
      for (const ring of multiRings) {
        offset = readPath(ring, offset, result);
      }
    };

    if (geometry.type === "LineString") {
      readPath(geometry.coordinates, 0, multiPath);
    } else if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
      readMultiPath(geometry.coordinates, multiPath);
    } else if (geometry.type === "MultiPolygon") {
      polys = [];
      for (const poly of geometry.coordinates) {
        const tmpMultiPath: MultiPath = {coords: [], lengths: [] };
        readMultiPath(poly, tmpMultiPath);
        polys.push(tmpMultiPath);
      }
    }

    if (polys) {
      for (const poly of polys) {
        await renderer.renderPath(poly.lengths, poly.coords, fill, 2, relativeCoords);
      }
    } else {
      await renderer.renderPath(multiPath.lengths, multiPath.coords, fill, 2, relativeCoords);
    }

  }

  private async readPoints(geom: GeoJson.Geometry, renderer: FeatureGeometryRenderer, relativeCoords: boolean) {

    const lengths: Coord = [];
    const coords: Coord = [];
    const readPoint = (coord: Coord) => {
      lengths.push(1);
      coords.push(coord[0]);
      coords.push(coord[1]);
    };

    if (geom.type === "MultiPoint") {
      geom.coordinates.forEach(readPoint);
    } else if (geom.type === "Point") {
      readPoint(geom.coordinates);
    }

    await renderer.renderPoint(lengths, coords, 2, relativeCoords);
  }
}
