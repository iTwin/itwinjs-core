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

/** A specialization of Range2d that represents a cartographic range used by map tiles.
 * @internal
 */
export class MapCartoRectangle extends Range2d {
  public constructor(west = 0, south = 0, east = 0, north = 0) {
    super(west, Math.min(south, north), east, Math.max(south, north));
  }
  public static create(west = -Angle.piRadians, south = -Angle.piOver2Radians, east = Angle.piRadians, north = Angle.piOver2Radians, result?: MapCartoRectangle): MapCartoRectangle {
    if (!result)
      return new MapCartoRectangle(west, south, east, north);
    result.init(west, south, east, north);
    return result;
  }

  public static createFromDegrees(west = -180, south = -90, east = 180, north = 90, result?: MapCartoRectangle): MapCartoRectangle {
    return MapCartoRectangle.create(west * Angle.radiansPerDegree, south * Angle.radiansPerDegree, east * Angle.radiansPerDegree, north * Angle.radiansPerDegree, result);
  }

  public get west() { return this.low.x; }
  public set west(x: number) { this.low.x = x; }
  public get south() { return this.low.y; }
  public set south(y: number) { this.low.y = y; }
  public get east() { return this.high.x; }
  public set east(x: number) { this.high.x = x; }
  public get north() { return this.high.y; }
  public set north(y: number) { this.high.y = y; }
  public get latLongString() { return `Latitude: ${this.low.y * Angle.degreesPerRadian} - ${this.high.y * Angle.degreesPerRadian} Longitude: ${this.low.x * Angle.degreesPerRadian} - ${this.high.x * Angle.degreesPerRadian}`; }
  public get globalLocationArea(): GlobalLocationArea { return { southwest: Cartographic.fromRadians({longitude: this.west, latitude: this.south}), northeast: Cartographic.fromRadians({longitude: this.east, latitude: this.north}) }; }
  public get cartoCenter() { return Cartographic.fromRadians({longitude: (this.low.x + this.high.x) / 2, latitude: (this.low.y + this.high.y) / 2}); }
  public get globalLocation(): GlobalLocation { return { center: this.cartoCenter, area: this.globalLocationArea }; }

  public init(west = 0, south = 0, east = 0, north = 0) {
    this.west = west;
    this.south = south;
    this.east = east;
    this.north = north;
  }
  public containsCartographic(carto: Cartographic) { return this.containsXY(carto.longitude, carto.latitude); }
  public getCenter(result?: Cartographic): Cartographic {
    return Cartographic.fromRadians({longitude: (this.west + this.east) / 2, latitude: (this.north + this.south) / 2, height: 0}, result);
  }
  public fractionFromCartographic(carto: Cartographic): Point2d | undefined { return this.worldToLocal(Point2d.create(carto.longitude, carto.latitude, scratchPoint2d)); }
  public getTileFractionRange(tilingScheme: MapTilingScheme) {
    scratchMercatorFractionRange.low.x = tilingScheme.longitudeToXFraction(this.low.x);
    scratchMercatorFractionRange.high.x = tilingScheme.longitudeToXFraction(this.high.x);
    scratchMercatorFractionRange.low.y = tilingScheme.latitudeToYFraction(this.low.y);
    scratchMercatorFractionRange.high.y = tilingScheme.latitudeToYFraction(this.high.y);

    return scratchMercatorFractionRange;
  }
}
