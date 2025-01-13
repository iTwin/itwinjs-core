/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as GeoJson from "geojson";

/** @internal */
export type Coord = number[];

/** @internal */      // Array of 2 or 3 numbers
export type RingCoords = Coord[];

/** @internal */
export type MultiRingCoords = RingCoords[];

/** @internal */
export interface MultiPath {
  lengths: number[];
  coords: number[];
}

/** @internal */
export class GeoJSONGeometryUtils {
  public static isRingOrPath(geom: GeoJson.Geometry) {return geom.type === "LineString" || geom.type === "MultiLineString" || geom.type === "Polygon" || geom.type === "MultiPolygon";}
  public static isFilled(geom: GeoJson.Geometry) {return  geom.type === "Polygon" || geom.type === "MultiPolygon";}
  public static isPoint(geom: GeoJson.Geometry) {return geom.type === "Point" || geom.type === "MultiPoint";}
}
