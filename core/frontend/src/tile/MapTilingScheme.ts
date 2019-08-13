/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { Cartographic } from "@bentley/imodeljs-common";
import { Point2d, Point3d, Angle } from "@bentley/geometry-core";

/** @internal */
export abstract class MapTilingScheme {

  private _scratchFraction = Point2d.createZero();

  /**
   *
   * @param longitude in radians (-pi to pi)
   */
  public longitudeToXFraction(longitude: number) {
    return longitude / Angle.pi2Radians + .5;
  }

  /**
   * Return longitude in radians (-pi to pi from fraction.
   * @param xFraction
   */
  public xFractionToLongitude(xFraction: number) {
    return Angle.pi2Radians * (xFraction - .5);
  }

  public abstract yFractionToLatitude(yFraction: number): number;
  public abstract latitudeToYFraction(latitude: number): number;

  protected constructor(public readonly numberOfLevelZeroTilesX: number, public readonly numberOfLevelZeroTilesY: number, private _rowZeroAtTop: boolean) { }
  /**
   * Gets the total number of tiles in the X direction at a specified level-of-detail.
   *
   * @param {Number} level The level-of-detail.  Level 0 is the root tile.
   * @returns {Number} The number of tiles in the X direction at the given level.
   */
  public getNumberOfXTilesAtLevel(level: number) {
    return 0 === level ? 1 : this.numberOfLevelZeroTilesX << (level - 1);
  }

  /**
   * Gets the total number of tiles in the Y direction at a specified level-of-detail.
   *
   *
   * @param {Number} level The level-of-detail.  Level 0 is the root tile.
   * @returns {Number} The number of tiles in the Y direction at the given level.
   */
  public getNumberOfYTilesAtLevel(level: number): number {
    return (0 === level) ? 1 : this.numberOfLevelZeroTilesY << (level - 1);
  }
  public tileXToFraction(x: number, level: number): number {
    return x / this.getNumberOfXTilesAtLevel(level);
  }

  public tileYToFraction(y: number, level: number): number {
    let yFraction = y / this.getNumberOfYTilesAtLevel(level);

    if (this._rowZeroAtTop)
      yFraction = 1.0 - yFraction;

    return yFraction;
  }

  /**
   * Gets the fraction of the  innormalized (0-1) coordinates with at left, bottom.
   *
   * @param x  column
   * @param y  row
   * @param level depth
   * @param result result (0-1 from left, bottom
   */
  public tileXYToFraction(x: number, y: number, level: number, result?: Point2d): Point2d {
    if (undefined === result)
      result = Point2d.createZero();

    result.x = this.tileXToFraction(x, level);
    result.y = this.tileYToFraction(y, level);

    return result;
  }
  /**
   *
   * @param x column
   * @param y row
   * @param level depth
   * @param result result longitude, latitude.
   * @param height height (optional)
   */
  public tileXYToCartographic(x: number, y: number, level: number, result: Cartographic, height?: number): Cartographic {
    this.tileXYToFraction(x, y, level, this._scratchFraction);
    return this.fractionToCartographic(this._scratchFraction.x, this._scratchFraction.y, result, height);
  }
  /**
   *
   * @param xFraction
   * @param yFraction
   * @param result
   * @param height
   */
  public fractionToCartographic(xFraction: number, yFraction: number, result: Cartographic, height?: number): Cartographic {
    result.longitude = this.xFractionToLongitude(xFraction);
    result.latitude = this.yFractionToLatitude(yFraction);
    result.height = undefined === height ? 0.0 : height;
    return result;
  }
  public cartographicToFraction(latitudeRadians: number, longitudeRadians: number, result: Point2d): Point2d {
    result.x = this.longitudeToXFraction(longitudeRadians);
    result.y = this.latitudeToYFraction(latitudeRadians);
    return result;
  }
  // gets the longitude and latitude into a point with coordinates between 0 and 1
  public ecefToPixelFraction(point: Point3d): Point3d {
    const cartoGraphic = Cartographic.fromEcef(point)!;
    return Point3d.create(this.longitudeToXFraction(cartoGraphic.longitude), this.latitudeToYFraction(cartoGraphic.latitude), 0.0);
  }
}
/** @internal */
export class GeographicTilingScheme extends MapTilingScheme {
  public constructor(numberOfLevelZeroTilesX: number = 2, numberOfLevelZeroTilesY: number = 1, rowZeroAtTop: boolean = false) {
    super(numberOfLevelZeroTilesX, numberOfLevelZeroTilesY, rowZeroAtTop);
  }
  public yFractionToLatitude(yFraction: number): number {
    return Math.PI * (yFraction - .5);
  }
  public latitudeToYFraction(latitude: number): number {
    return .5 + latitude / Math.PI;
  }
}

/** @internal */
export class WebMercatorTilingScheme extends MapTilingScheme {
  public constructor(numberOfLevelZeroTilesX: number = 2, numberOfLevelZeroTilesY: number = 2, rowZeroAtTop: boolean = false) {
    super(numberOfLevelZeroTilesX, numberOfLevelZeroTilesY, rowZeroAtTop);
  }
  public yFractionToLatitude(yFraction: number): number {
    const mercatorAngle = Angle.pi2Radians * (yFraction - .5);
    return Angle.piOver2Radians - (2.0 * Math.atan(Math.exp(mercatorAngle)));
  }
  public latitudeToYFraction(latitude: number): number {
    const sinLatitude = Math.sin(latitude);
    return (0.5 - Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude)) / (4.0 * Angle.piRadians));   // https://msdn.microsoft.com/en-us/library/bb259689.aspx
  }
}
