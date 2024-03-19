/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export type Coord = number[];

/** @internal */      // Array of 2 or 3 numbers
export type RingCoords = Coord[];

/** @internal */
export type MultiRingCoords = RingCoords[];

export type GeoJSONGeometryType = "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";

/** @internal */
export interface GeoJSONGeometry {
  type: GeoJSONGeometryType;
  coordinates: Coord | RingCoords | MultiRingCoords | MultiRingCoords[];
}

/** @internal */
export interface GeoJSONMultiRing extends GeoJSONGeometry {
  type:  "Polygon" | "MultiLineString";
  coordinates:  MultiRingCoords;
}

/** @internal */
export interface GeoJSONPoint extends GeoJSONGeometry {
  type: "Point";
  coordinates: Coord;
}

/** @internal */
export interface GeoJSONMultiPoint extends GeoJSONGeometry  {
  type: "MultiPoint";
  coordinates: Coord[];
}

/** @internal */
export interface GeoJSONLineString extends GeoJSONGeometry {
  type: "LineString";
  coordinates: RingCoords;
}

/** @internal */
export interface GeoJSONMultiLineString extends GeoJSONMultiRing  {
  type: "MultiLineString";
}

/** @internal */
export interface GeoJSONPolygon extends GeoJSONMultiRing {
  type: "Polygon";
}

/** @internal */
export interface GeoJSONMultiPolygon extends GeoJSONGeometry  {
  type: "MultiPolygon";
  coordinates: MultiRingCoords[];
}
