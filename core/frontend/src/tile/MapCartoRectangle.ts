/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  Angle,
  Range2d,
} from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";

import {
  MapTilingScheme,
} from "./internal";

const scratchMercatorFractionRange = Range2d.createNull();

/** @internal */
export class MapCartoRectangle extends Range2d {
  public constructor(west = 0, south = 0, east = 0, north = 0) {
    super(west, south, east, north);
  }
  public static create(west = 0, south = 0, east = 0, north = 0, result?: MapCartoRectangle): MapCartoRectangle {
    if (!result)
      return new MapCartoRectangle(west, south, east, north);
    result.init(west, south, east, north);
    return result;
  }
  public get west() { return this.low.x; }
  public set west(x: number) { this.low.x = x; }
  public get south() { return this.low.y; }
  public set south(y: number) { this.low.y = y; }
  public get east() { return this.high.x; }
  public set east(x: number) { this.high.x = x; }
  public get north() { return this.high.y; }
  public set north(y: number) { this.high.y = y; }
  public get latLongString() { return "Latitude: " + this.low.y * Angle.degreesPerRadian + " - " + this.high.y * Angle.degreesPerRadian + " Longitude: " + this.low.x * Angle.degreesPerRadian + " - " + this.high.x * Angle.degreesPerRadian; }

  public init(west = 0, south = 0, east = 0, north = 0) {
    this.west = west;
    this.south = south;
    this.east = east;
    this.north = north;
  }
  public containsCartographic(carto: Cartographic) { return this.containsXY(carto.longitude, carto.latitude); }
  public getCenter(result?: Cartographic): Cartographic {
    return Cartographic.fromRadians((this.west + this.east) / 2, (this.north + this.south) / 2, 0, result);
  }
  public getTileFractionRange(tilingScheme: MapTilingScheme) {
    scratchMercatorFractionRange.low.x = tilingScheme.longitudeToXFraction(this.low.x);
    scratchMercatorFractionRange.high.x = tilingScheme.longitudeToXFraction(this.high.x);
    scratchMercatorFractionRange.low.y = tilingScheme.latitudeToYFraction(this.low.y);
    scratchMercatorFractionRange.high.y = tilingScheme.latitudeToYFraction(this.high.y);

    return scratchMercatorFractionRange;
  }
}
