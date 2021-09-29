/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Angle, Matrix3d, Point2d, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { Cartographic } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { MapCartoRectangle } from "../internal";

/** @internal */
export abstract class MapTilingScheme {
  private _scratchFraction = Point2d.createZero();

  /**
   * @param longitude in radians (-pi to pi)
   */
  public longitudeToXFraction(longitude: number) {
    return longitude / Angle.pi2Radians + .5;
  }

  /**
   * Return longitude in radians (-pi to pi from fraction).
   */
  public xFractionToLongitude(xFraction: number) {
    return Angle.pi2Radians * (xFraction - .5);
  }

  public abstract yFractionToLatitude(yFraction: number): number;
  public abstract latitudeToYFraction(latitude: number): number;

  protected constructor(public readonly numberOfLevelZeroTilesX: number, public readonly numberOfLevelZeroTilesY: number, public rowZeroAtNorthPole: boolean) { }
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
    return y / this.getNumberOfYTilesAtLevel(level);
  }
  public xFractionToTileX(xFraction: number, level: number): number {
    const nTiles = this.getNumberOfXTilesAtLevel(level);
    return Math.min(Math.floor(xFraction * nTiles), nTiles - 1);
  }

  public yFractionToTileY(yFraction: number, level: number): number {
    const nTiles = this.getNumberOfYTilesAtLevel(level);
    return Math.min(Math.floor(nTiles * (this.rowZeroAtNorthPole ? (1.0 - yFraction) : yFraction)), nTiles - 1);
  }

  public tileXToLongitude(x: number, level: number) {
    return this.xFractionToLongitude(this.tileXToFraction(x, level));
  }
  public tileYToLatitude(y: number, level: number) {
    return this.yFractionToLatitude(this.tileYToFraction(y, level));
  }
  /**
   * Gets the fraction of the normalized (0-1) coordinates with at left, bottom.
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
  private static _scratchPoint2d = Point2d.createZero();
  /** Get Cartographic from tile XY
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

  public tileXYToRectangle(x: number, y: number, level: number, result?: MapCartoRectangle) {
    return MapCartoRectangle.create(this.tileXToLongitude(x, level), this.tileYToLatitude(this.rowZeroAtNorthPole ? (y + 1) : y, level), this.tileXToLongitude(x + 1, level), this.tileYToLatitude(this.rowZeroAtNorthPole ? y : (y + 1), level), result);
  }
  public tileBordersNorthPole(row: number, level: number) {
    return this.rowZeroAtNorthPole ? this.tileYToFraction(row, level) === 0.0 : this.tileYToFraction(row + 1, level) === 1.0;
  }

  public tileBordersSouthPole(row: number, level: number) {
    return this.rowZeroAtNorthPole ? this.tileYToFraction(row + 1, level) === 1.0 : this.tileYToFraction(row, level) === 0.0;
  }

  /** Get tile XY  from Cartographic.
   *
   * @param x column
   * @param y row
   * @param level depth
   * @param result result longitude, latitude.
   * @param height height (optional)
   */
  public cartographicToTileXY(carto: Cartographic, level: number, result?: Point2d): Point2d {
    const fraction = this.cartographicToFraction(carto.latitude, carto.longitude, MapTilingScheme._scratchPoint2d);
    return Point2d.create(this.xFractionToTileX(fraction.x, level), this.yFractionToTileY(fraction.y, level), result);

  }
  /** Get fraction from Cartographic.
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
  private ecefToPixelFraction(point: Point3d, applyTerrain: boolean): Point3d {
    const cartoGraphic = Cartographic.fromEcef(point)!;
    return Point3d.create(this.longitudeToXFraction(cartoGraphic.longitude), this.latitudeToYFraction(cartoGraphic.latitude), applyTerrain ? cartoGraphic.height : 0);
  }

  public computeMercatorFractionToDb(ecefToDb: Transform, bimElevationOffset: number, iModel: IModelConnection, applyTerrain: boolean) {
    const dbToEcef = ecefToDb.inverse()!;

    const projectCenter = Point3d.create(iModel.projectExtents.center.x, iModel.projectExtents.center.y, bimElevationOffset);
    const projectEast = projectCenter.plusXYZ(1, 0, 0);
    const projectNorth = projectCenter.plusXYZ(0, 1, 0);

    const mercatorOrigin = this.ecefToPixelFraction(dbToEcef.multiplyPoint3d(projectCenter), applyTerrain);
    const mercatorX = this.ecefToPixelFraction(dbToEcef.multiplyPoint3d(projectEast), applyTerrain);
    const mercatorY = this.ecefToPixelFraction(dbToEcef.multiplyPoint3d(projectNorth), applyTerrain);

    const deltaX = Vector3d.createStartEnd(mercatorOrigin, mercatorX);
    const deltaY = Vector3d.createStartEnd(mercatorOrigin, mercatorY);
    const matrix = Matrix3d.createColumns(deltaX, deltaY, Vector3d.create(0, 0, 1));

    const dbToMercator = Transform.createMatrixPickupPutdown(matrix, projectCenter, mercatorOrigin);
    const mercatorToDb = dbToMercator.inverse();
    return mercatorToDb === undefined ? Transform.createIdentity() : mercatorToDb;
  }
}

/** @internal */
export class GeographicTilingScheme extends MapTilingScheme {
  public constructor(numberOfLevelZeroTilesX: number = 2, numberOfLevelZeroTilesY: number = 1, rowZeroAtNorthPole: boolean = false) {
    super(numberOfLevelZeroTilesX, numberOfLevelZeroTilesY, rowZeroAtNorthPole);
  }

  public yFractionToLatitude(yFraction: number): number {
    return Math.PI * (yFraction - .5);
  }

  public latitudeToYFraction(latitude: number): number {
    return .5 + latitude / Math.PI;
  }
}

/** @internal */
export class WebMercatorProjection {
  /**
   * Converts a Mercator angle, in the range -PI to PI, to a geodetic latitude
   * in the range -PI/2 to PI/2.
   *
   * @param {Number} mercatorAngle The angle to convert.
   * @returns {Number} The geodetic latitude in radians.
   */
  public static mercatorAngleToGeodeticLatitude(mercatorAngle: number) {
    return Angle.piOver2Radians - (2.0 * Math.atan(Math.exp(-mercatorAngle)));
  }

  public static maximumLatitude = WebMercatorProjection.mercatorAngleToGeodeticLatitude(Angle.piRadians);
  public static geodeticLatitudeToMercatorAngle(latitude: number) {
    // Clamp the latitude coordinate to the valid Mercator bounds.
    if (latitude > WebMercatorProjection.maximumLatitude) {
      latitude = WebMercatorProjection.maximumLatitude;
    } else if (latitude < -WebMercatorProjection.maximumLatitude) {
      latitude = -WebMercatorProjection.maximumLatitude;
    }
    const sinLatitude = Math.sin(latitude);
    return 0.5 * Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude));
  }
}

/** @internal */
export class WebMercatorTilingScheme extends MapTilingScheme {

  public constructor(numberOfLevelZeroTilesX: number = 2, numberOfLevelZeroTilesY: number = 2, rowZeroAtNorthPole: boolean = true /* Bing uses 0 north */) {
    super(numberOfLevelZeroTilesX, numberOfLevelZeroTilesY, rowZeroAtNorthPole);
  }

  public yFractionToLatitude(yFraction: number): number {
    const mercatorAngle = Angle.pi2Radians * (this.rowZeroAtNorthPole ? (.5 - yFraction) : (yFraction - .5));
    return WebMercatorProjection.mercatorAngleToGeodeticLatitude(mercatorAngle);
  }

  public latitudeToYFraction(latitude: number): number {
    // Clamp the latitude coordinate to the valid Mercator bounds.
    if (latitude > WebMercatorProjection.maximumLatitude) {
      latitude = WebMercatorProjection.maximumLatitude;
    } else if (latitude < -WebMercatorProjection.maximumLatitude) {
      latitude = -WebMercatorProjection.maximumLatitude;
    }
    const sinLatitude = Math.sin(latitude);
    return (0.5 - Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude)) / (4.0 * Angle.piRadians));   // https://msdn.microsoft.com/en-us/library/bb259689.aspx
  }
}
