/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Angle, Point2d, Range2d } from "@itwin/core-geometry";
import { Cartographic } from "@itwin/core-common";
import { GlobalLocation, GlobalLocationArea } from "../../ViewGlobalLocation";
import { MapTilingScheme } from "../internal";

const scratchMercatorFractionRange = Range2d.createNull();
const scratchPoint2d = Point2d.createZero();

/** A specialization of [Range2d]($geometry-core) representing a [Cartographic]($common) region on the surface of the Earth,
 * used by [[MapTile]]s.
 * The `x` components of the `low` and `high` points refer to the western and eastern longitudes, respectively.
 * The `y` components of the `low` and `high` points refer to the southern and northern latitudes, respectively.
 * Longitudes are stored in radians in the range [-pi, pi].
 * Latitudes are stored in radians in the range [-pi/2, pi/2].
 * @beta
 */
export class MapCartoRectangle extends Range2d {
  /** Construct a new rectangle with angles specified in radians.
   * @param west The western longitude in radians, in [-pi, pi].
   * @param south The southern latitude in radians, in [-pi/2, pi/2].
   * @param east The eastern latitude in radians, in [-pi, pi].
   * @param north The northern latitude in radians, in [-pi/2, pi/2].
   * @note If `north` is less than `south`, they will be swapped.
   * @see [[fromRadians]], [[fromDegrees]], [[createZero]], and [[createMaximum]] to construct a new rectangle.
   */
  protected constructor(west: number, south: number, east: number, north: number) {
    super(west, Math.min(south, north), east, Math.max(south, north));
  }

  /** Create a rectangle with all angles set to zero. */
  public static createZero(): MapCartoRectangle {
    return new MapCartoRectangle(0, 0, 0, 0);
  }

  /** Create a rectangle encompassing all points on the surface of the Earth. */
  public static createMaximum(): MapCartoRectangle {
    return new MapCartoRectangle(-Angle.piRadians, -Angle.piOver2Radians, Angle.piRadians, Angle.piOver2Radians);
  }

  /** Create a new rectangle with angles specified in radians.
   * @param west The western longitude in radians, in [-pi, pi].
   * @param south The southern latitude in radians, in [-pi/2, pi/2].
   * @param east The eastern latitude in radians, in [-pi, pi].
   * @param north The northern latitude in radians, in [-pi/2, pi/2].
   * @param result An optional preallocated rectangle to hold the result.
   * @note If `north` is less than `south`, they will be swapped.
   */
  public static fromRadians(west: number, south: number, east: number, north: number, result?: MapCartoRectangle): MapCartoRectangle {
    result = result ?? MapCartoRectangle.createZero();
    result.setRadians(west, south, east, north);
    return result;
  }

  /** Create a new rectangle with angles specified in degrees.
   * @param west The western longitude in degrees, in [-180, 180].
   * @param south The southern latitude in degrees, in [-90, 90].
   * @param east The eastern latitude in degrees, in [-180, 180].
   * @param north The northern latitude in degrees, in [-90, 90].
   * @param result An optional preallocated rectangle to hold the result.
   * @note If `north` is less than `south`, they will be swapped.
   */
  public static fromDegrees(west: number, south: number, east: number, north: number, result?: MapCartoRectangle): MapCartoRectangle {
    const mult = Angle.radiansPerDegree;
    return MapCartoRectangle.fromRadians(west * mult, south * mult, east * mult, north * mult, result);
  }

  /** The western longitude in radians. */
  public get west() { return this.low.x; }
  public set west(x: number) { this.low.x = x; }

  /** The southern latitude in radians. */
  public get south() { return this.low.y; }
  public set south(y: number) { this.low.y = y; }

  /** The eastern longitude in radians. */
  public get east() { return this.high.x; }
  public set east(x: number) { this.high.x = x; }

  /** The northern latitude in radians. */
  public get north() { return this.high.y; }
  public set north(y: number) { this.high.y = y; }

  /** A non-localized string representation of this rectangle, for debugging purposes. */
  public get latLongString() {
    return `Latitude: ${this.low.y * Angle.degreesPerRadian} - ${this.high.y * Angle.degreesPerRadian} Longitude: ${this.low.x * Angle.degreesPerRadian} - ${this.high.x * Angle.degreesPerRadian}`;
  }

  /** A pair of [[Cartographic]]s representing the same area as this rectangle. */
  public get globalLocationArea(): GlobalLocationArea {
    return {
      southwest: Cartographic.fromRadians({longitude: this.west, latitude: this.south}),
      northeast: Cartographic.fromRadians({longitude: this.east, latitude: this.north}),
    };
  }

  /** The cartographic center of this rectangle. */
  public get cartoCenter(): Cartographic {
    return Cartographic.fromRadians({
      longitude: (this.low.x + this.high.x) / 2,
      latitude: (this.low.y + this.high.y) / 2,
    });
  }

  /** The [[globalLocationArea]] and [[cartoCenter]] of this rectangle. */
  public get globalLocation(): GlobalLocation {
    return {
      center: this.cartoCenter,
      area: this.globalLocationArea,
    };
  }

  /** Reinitialize this rectangle using angles specified in radians.
   * @param west The western longitude in radians, in [-pi, pi].
   * @param south The southern latitude in radians, in [-pi/2, pi/2].
   * @param east The eastern latitude in radians, in [-pi, pi].
   * @param north The northern latitude in radians, in [-pi/2, pi/2].
   * @note If `north` is less than `south`, they will be swapped.
   */
  public setRadians(west = 0, south = 0, east = 0, north = 0) {
    this.west = west;
    this.south = south;
    this.east = east;
    this.north = north;
  }

  /** Returns true if the specified cartographic location is contained within this rectangle's area, ignoring elevation. */
  public containsCartographic(carto: Cartographic) {
    return this.containsXY(carto.longitude, carto.latitude);
  }

  /** Returns the position at the center of this rectangle, at an elevation of zero.
   * @param result An optional preallocated Cartographic to store the result.
   * @returns the center of this rectangle.
   */
  public getCenter(result?: Cartographic): Cartographic {
    return Cartographic.fromRadians({
      longitude: (this.west + this.east) / 2,
      latitude: (this.north + this.south) / 2,
      height: 0,
    }, result);
  }

  /** Computes fractional coordinates of the specified position within this rectangle's area.
   * @see [Range2d.worldToLocal]($geometry-core)
   */
  public fractionFromCartographic(carto: Cartographic): Point2d | undefined {
    const pt = Point2d.create(carto.longitude, carto.latitude, scratchPoint2d);
    return this.worldToLocal(pt);
  }

  /** @internal */
  public getTileFractionRange(tilingScheme: MapTilingScheme) {
    scratchMercatorFractionRange.low.x = tilingScheme.longitudeToXFraction(this.low.x);
    scratchMercatorFractionRange.high.x = tilingScheme.longitudeToXFraction(this.high.x);
    scratchMercatorFractionRange.low.y = tilingScheme.latitudeToYFraction(this.low.y);
    scratchMercatorFractionRange.high.y = tilingScheme.latitudeToYFraction(this.high.y);

    return scratchMercatorFractionRange;
  }
}
