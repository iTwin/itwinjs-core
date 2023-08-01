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

/** A scheme for converting between two representations of the surface of the Earth: an ellipsoid and a rectangular [tiled map](https://en.wikipedia.org/wiki/Tiled_web_map).
 * Positions on the surface of the ellipsoid are expressed in [Cartographic]($common) coordinates.
 * Rectangular [[MapTile]]s are projected onto this ellipsoid by the tiling scheme. Tile coordinates are represented by [[QuadId]]s.
 *
 * The tiling scheme represents the (x,y) coordinates of its tiles as fractions in [0,1] along the X and Y axes.
 * An X fraction of 0 corresponds to the easternmost longitude and an X fraction of 1 to the westernmost longitude.
 * The scheme can choose to correlate a Y fraction of 0 with either the north or south pole, as specified by [[rowZeroAtNorthPole]].
 * Implementing a tiling scheme only requires implementing the abstract method [[yFractionToLatitude]] and its inverse, [[latitudeToYFraction]].
 * @public
 */
export abstract class MapTilingScheme {
  /** If true, the fractional Y coordinate 0 corresponds to the north pole and 1 to the south pole; otherwise,
   * 0 corresponds to the south pole and 1 to the north.
   */
  public readonly rowZeroAtNorthPole: boolean;
  /** The number of tiles in the X direction at level 0 of the quad tree. */
  public readonly numberOfLevelZeroTilesX;
  /** The number of tiles in the Y direction at level 0 of the quad tree. */
  public readonly numberOfLevelZeroTilesY;
  private readonly _scratchFraction = Point2d.createZero();
  private readonly _scratchPoint2d = Point2d.createZero();

  /** Convert a longitude in [-pi, pi] radisn to a fraction in [0, 1] along the X axis. */
  public longitudeToXFraction(longitude: number) {
    return longitude / Angle.pi2Radians + .5;
  }

  /** Convert a fraction in [0, 1] along the X axis into a longitude in [-pi, pi] radians. */
  public xFractionToLongitude(xFraction: number) {
    return Angle.pi2Radians * (xFraction - .5);
  }

  /** Convert a fraction in [0, 1] along the Y axis into a latitude in [-pi/2, pi/2] radians. */
  public abstract yFractionToLatitude(yFraction: number): number;

  /** Convert a latitude in [-pi/2, pi/2] radians into a fraction in [0, 1] along the Y axis. */
  public abstract latitudeToYFraction(latitude: number): number;

  protected constructor(numberOfLevelZeroTilesX: number, numberOfLevelZeroTilesY: number, rowZeroAtNorthPole: boolean) {
    this.rowZeroAtNorthPole = rowZeroAtNorthPole;
    this.numberOfLevelZeroTilesX = numberOfLevelZeroTilesX;
    this.numberOfLevelZeroTilesY = numberOfLevelZeroTilesY;
  }

  /** The total number of tiles in the X direction at the specified level of detail.
   * @param level The level of detail, with 0 corresponding to the root tile.
   */
  public getNumberOfXTilesAtLevel(level: number) {
    return level < 0 ? 1 : this.numberOfLevelZeroTilesX << level;
  }

  /** The total number of tiles in the Y direction at the specified level of detail.
   * @param level The level of detail, with 0 corresponding to the root tile.
   */
  public getNumberOfYTilesAtLevel(level: number): number {
    return  level < 0 ? 1 : this.numberOfLevelZeroTilesY << level;
  }

  /** @alpha */
  public get rootLevel() {
    return this.numberOfLevelZeroTilesX > 1 || this.numberOfLevelZeroTilesY > 1 ? -1 : 0;
  }

  /** @alpha */
  public getNumberOfXChildrenAtLevel(level: number): number {
    return level === 0 ? this.numberOfLevelZeroTilesX : 2;
  }

  /** @alpha */
  public getNumberOfYChildrenAtLevel(level: number): number {
    return level === 0 ? this.numberOfLevelZeroTilesY : 2;
  }

  /** Given the X component and level of a [[QuadId]], convert it to a fractional distance along the X axis. */
  public tileXToFraction(x: number, level: number): number {
    return x / this.getNumberOfXTilesAtLevel(level);
  }

  /** Given the Y component and level of a [[QuadId]], convert it to a fractional distance along the Y axis. */
  public tileYToFraction(y: number, level: number): number {
    return y / this.getNumberOfYTilesAtLevel(level);
  }

  /** Given a fractional distance along the X axis and a level of the quad tree, compute the X component of the corresponding [[QuadId]]. */
  public xFractionToTileX(xFraction: number, level: number): number {
    const nTiles = this.getNumberOfXTilesAtLevel(level);
    return Math.min(Math.floor(xFraction * nTiles), nTiles - 1);
  }

  /** Given a fractional distance along the Y axis and a level of the quad tree, compute the Y component of the corresponding [[QuadId]]. */
  public yFractionToTileY(yFraction: number, level: number): number {
    const nTiles = this.getNumberOfYTilesAtLevel(level);
    return Math.min(Math.floor(yFraction * nTiles), nTiles - 1);
  }

  /** Given the X component and level of a [[QuadId]], compute its longitude in [-pi, pi] radians. */
  public tileXToLongitude(x: number, level: number) {
    return this.xFractionToLongitude(this.tileXToFraction(x, level));
  }

  /** Given the Y component and level of a [[QuadId]], compute its latitude in [-pi/2, pi/2] radians. */
  public tileYToLatitude(y: number, level: number) {
    return this.yFractionToLatitude(this.tileYToFraction(y, level));
  }

  /** Given the components of a [[QuadId]], compute its fractional coordinates in the XY plane. */
  public tileXYToFraction(x: number, y: number, level: number, result?: Point2d): Point2d {
    if (undefined === result)
      result = Point2d.createZero();

    result.x = this.tileXToFraction(x, level);
    result.y = this.tileYToFraction(y, level);

    return result;
  }

  /** Given the components of a [[QuadId]] and an elevation, compute the corresponding [Cartographic]($common) position.
   * @param x The X component of the QuadId.
   * @param y The Y component of the QuadId.
   * @param level The level component of the QuadId.
   * @param height The elevation above the ellipsoid.
   * @returns the corresponding cartographic position.
   */
  public tileXYToCartographic(x: number, y: number, level: number, result: Cartographic, height = 0): Cartographic {
    const pt = this.tileXYToFraction(x, y, level, this._scratchFraction);
    return this.fractionToCartographic(pt.x, pt.y, result, height);
  }

  /** Given the components of a [[QuadId]], compute the corresponding region of the Earth's surface. */
  public tileXYToRectangle(x: number, y: number, level: number, result?: MapCartoRectangle) {
    if (level < 0)
      return MapCartoRectangle.createMaximum();

    return MapCartoRectangle.fromRadians(
      this.tileXToLongitude(x, level),
      this.tileYToLatitude(this.rowZeroAtNorthPole ? (y + 1) : y, level),
      this.tileXToLongitude(x + 1, level),
      this.tileYToLatitude(this.rowZeroAtNorthPole ? y : (y + 1), level),
      result,
    );
  }

  /** Returns true if the tile at the specified X coordinate and level is adjacent to the north pole. */
  public tileBordersNorthPole(row: number, level: number) {
    return this.rowZeroAtNorthPole ? this.tileYToFraction(row, level) === 0.0 : this.tileYToFraction(row + 1, level) === 1.0;
  }

  /** Returns true if the tile at the specified X coordinate and level is adjacent to the south pole. */
  public tileBordersSouthPole(row: number, level: number) {
    return this.rowZeroAtNorthPole ? this.tileYToFraction(row + 1, level) === 1.0 : this.tileYToFraction(row, level) === 0.0;
  }

  /** Given a cartographic position, compute the corresponding position on the surface of the Earth as fractional distances along the
   * X and Y axes.
   */
  public cartographicToTileXY(carto: Cartographic, level: number, result?: Point2d): Point2d {
    const fraction = this.cartographicToFraction(carto.latitude, carto.longitude, this._scratchPoint2d);
    return Point2d.create(this.xFractionToTileX(fraction.x, level), this.yFractionToTileY(fraction.y, level), result);

  }

  /** Given fractional coordinates in the XY plane and an elevation, compute the corresponding cartographic position. */
  public fractionToCartographic(xFraction: number, yFraction: number, result: Cartographic, height = 0): Cartographic {
    result.longitude = this.xFractionToLongitude(xFraction);
    result.latitude = this.yFractionToLatitude(yFraction);
    result.height = height;
    return result;
  }

  /** Given a cartographic location on the surface of the Earth, convert it to fractional coordinates in the XY plane. */
  public cartographicToFraction(latitudeRadians: number, longitudeRadians: number, result: Point2d): Point2d {
    result.x = this.longitudeToXFraction(longitudeRadians);
    result.y = this.latitudeToYFraction(latitudeRadians);
    return result;
  }

  /** @alpha */
  private ecefToPixelFraction(point: Point3d, applyTerrain: boolean): Point3d {
    const cartoGraphic = Cartographic.fromEcef(point)!;
    return Point3d.create(this.longitudeToXFraction(cartoGraphic.longitude), this.latitudeToYFraction(cartoGraphic.latitude), applyTerrain ? cartoGraphic.height : 0);
  }

  /** @alpha */
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

  /** @alpha */
  protected yFractionFlip(fraction: number) {
    return this.rowZeroAtNorthPole ? (1.0 - fraction) : fraction;
  }
}

/** A [[MapTilingScheme]] using a simple geographic projection by which longitude and latitude are mapped directly to X and Y.
 * This projection is commonly known as "geographic", "equirectangular", "equidistant cylindrical", or "plate carrée".
 * @beta
 */
export class GeographicTilingScheme extends MapTilingScheme {
  public constructor(numberOfLevelZeroTilesX = 2, numberOfLevelZeroTilesY = 1, rowZeroAtNorthPole = false) {
    super(numberOfLevelZeroTilesX, numberOfLevelZeroTilesY, rowZeroAtNorthPole);
  }

  /** Implements [[MapTilingScheme.yFractionToLatitude]]. */
  public yFractionToLatitude(yFraction: number): number {
    return Math.PI * (this.yFractionFlip(yFraction) - .5);
  }

  /** Implements [[MapTilingScheme.latitudeToYFraction]]. */
  public latitudeToYFraction(latitude: number): number {
    return this.yFractionFlip(.5 + latitude / Math.PI);
  }
}

/** @alpha */
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
    if (latitude > WebMercatorProjection.maximumLatitude)
      latitude = WebMercatorProjection.maximumLatitude;
    else if (latitude < -WebMercatorProjection.maximumLatitude)
      latitude = -WebMercatorProjection.maximumLatitude;

    const sinLatitude = Math.sin(latitude);
    return 0.5 * Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude));
  }
}

/** A [[MapTilingScheme]] using the [EPSG:3857](https://en.wikipedia.org/wiki/Web_Mercator_projection) projection.
 * This scheme is used by most [tiled web maps](https://en.wikipedia.org/wiki/Tiled_web_map), including Bing Maps and Google Maps.
 * @beta
 */
export class WebMercatorTilingScheme extends MapTilingScheme {
  public constructor(numberOfLevelZeroTilesX = 1, numberOfLevelZeroTilesY = 1, rowZeroAtNorthPole = true) {
    super(numberOfLevelZeroTilesX, numberOfLevelZeroTilesY, rowZeroAtNorthPole);
  }

  /** Implements [[MapTilingScheme.yFractionToLatitude]]. */
  public yFractionToLatitude(yFraction: number): number {
    const mercatorAngle = Angle.pi2Radians * (this.rowZeroAtNorthPole ? (.5 - yFraction) : (yFraction - .5));
    return WebMercatorProjection.mercatorAngleToGeodeticLatitude(mercatorAngle);
  }

  /** Implements [[MapTilingScheme.latitudeToYFraction. */
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
