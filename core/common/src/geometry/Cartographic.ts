/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Angle, AngleProps, Constant, Point3d, Range1d, Range2d, Range3d, Transform, Vector3d, XYAndZ, XYZ } from "@bentley/geometry-core";
import { assert } from "@bentley/bentleyjs-core";

// portions adapted from Cesium.js Copyright 2011 - 2017 Cesium Contributors

/** JSON representation of a Cartographic object.
 * @see [[Cartographic]]
 * @public
 * */
export interface CartographicProps {
  /** Angle which represents latitude. */
  latitude: AngleProps;
  /** Angle which represents longitude. */
  longitude: AngleProps;
  /** Height in meters above the ellipsoid; defaults to zero. */
  height?: number;
}

/** A position on the earth defined by longitude, latitude, and height above the [WGS84](https://en.wikipedia.org/wiki/World_Geodetic_System) ellipsoid.
 * @public
 */
export class Cartographic {
  /**
   * @param longitude longitude, as an Angle object.
   * @param latitude latitude, as an Angle object.
   * @param height The height, in meters, above the ellipsoid.
   */
  private constructor(public longitude: Angle, public latitude: Angle, public height: number = 0) { }

  /** Create an empty Cartographic object */
  public static createEmpty(): Cartographic {
    return Cartographic.fromJSON({ longitude: 0, latitude: 0, height: 0 });
  }

  /** Creates a Cartographic object from a JSON representation.
   * @param props object containing longitude, latitude, and height information.
   * @see [[CartographicProps]]
   */
  public static fromJSON(props: CartographicProps, result?: Cartographic): Cartographic {
    const height = props.height !== undefined ? props.height : 0;

    if (!result)
      return new Cartographic(Angle.fromJSON(props.longitude), Angle.fromJSON(props.latitude), height);

    result.longitude = Angle.fromJSON(props.longitude);
    result.latitude = Angle.fromJSON(props.latitude);
    result.height = height;
    return result;
  }

  /** Returns a JSON representation of a Cartographic object. */
  public toJSON(): CartographicProps {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      height: this.height,
    };
  }

  /** Freeze this Cartographic */
  public freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /** longitude, in radians */
  public get longitudeRadians() {
    return this.longitude.radians;
  }

  /** latitude, in radians */
  public get latitudeRadians() {
    return this.latitude.radians;
  }

  /** longitude, in degrees */
  public get longitudeDegrees() {
    return this.longitude.degrees;
  }

  /** latitude, in degrees */
  public get latitudeDegrees() {
    return this.latitude.degrees;
  }

  private static _oneMinusF = 1 - (Constant.earthRadiusWGS84.equator - Constant.earthRadiusWGS84.polar) / Constant.earthRadiusWGS84.equator;
  private static _equatorOverPolar = Constant.earthRadiusWGS84.equator / Constant.earthRadiusWGS84.polar;
  /** return the geocentric latitude angle for the input geodetic latitude angle (both in radians).
   * @param geodeticLatitude geodetic latitude angle in radians
   */
  public static geocentricLatitudeFromGeodeticLatitude(geodeticLatitude: number): number {
    return Math.atan(Cartographic._oneMinusF * Cartographic._oneMinusF * Math.tan(geodeticLatitude));
  }
  /** return the parametric latitude angle for the input geodetic latitude angle (both in radians).  The parametric latitude
   * is appropriate for input to the Ellipsoid methods.
   * @param geodeticLatitude geodetic latitude angle in radians
   */
  public static parametricLatitudeFromGeodeticLatitude(geodeticLatitude: number): number {
    return Math.atan(Cartographic._oneMinusF * Cartographic._oneMinusF * Cartographic._equatorOverPolar * Math.tan(geodeticLatitude));
  }

  private static _cartesianToCartographicN = new Point3d();
  private static _cartesianToCartographicP = new Point3d();
  private static _cartesianToCartographicH = new Vector3d();
  private static _wgs84OneOverRadii = new Point3d(1.0 / 6378137.0, 1.0 / 6378137.0, 1.0 / 6356752.3142451793);
  private static _wgs84OneOverRadiiSquared = new Point3d(1.0 / (6378137.0 * 6378137.0), 1.0 / (6378137.0 * 6378137.0), 1.0 / (6356752.3142451793 * 6356752.3142451793));
  private static _wgs84RadiiSquared = new Point3d(6378137.0 * 6378137.0, 6378137.0 * 6378137.0, 6356752.3142451793 * 6356752.3142451793);
  private static _wgs84CenterToleranceSquared = 0.1;
  private static _scratchN = new Vector3d();
  private static _scratchK = new Vector3d();

  /** Creates a new Cartographic from an [ECEF](https://en.wikipedia.org/wiki/ECEF) position.
   * @param cartesian The position, in ECEF, to convert to cartographic representation.
   * @param [result] The object onto which to store the result.
   * @returns The modified result parameter, new Cartographic instance if none was provided, or undefined if the cartesian is at the center of the ellipsoid.
   */
  public static fromEcef(cartesian: Point3d, result?: Cartographic): Cartographic | undefined {
    const oneOverRadiiSquared = Cartographic._wgs84OneOverRadiiSquared;
    const p = Cartographic.scalePointToGeodeticSurface(cartesian, Cartographic._cartesianToCartographicP);

    if (!p)
      return undefined;

    const n = Cartographic._cartesianToCartographicN;
    Cartographic.multiplyComponents(p, oneOverRadiiSquared, n);
    Cartographic.normalize(n, n);

    const h = p.vectorTo(cartesian, Cartographic._cartesianToCartographicH);
    const longitude = Math.atan2(n.y, n.x);
    const latitude = Math.asin(n.z);
    const height = Math.sign(h.dotProduct(cartesian)) * h.magnitude();

    if (!result)
      return Cartographic.fromJSON({ longitude: { radians: longitude }, latitude: { radians: latitude }, height });

    result.longitude = Angle.fromJSON({ radians: longitude });
    result.latitude = Angle.fromJSON({ radians: latitude });
    result.height = height;
    return result;
  }

  /** Scale point to geodetic surface
   * @param point in ECEF to scale to the surface
   * @param [result] The object onto which to store the result.
   * @returns a point on the geodetic surface
   */
  public static scalePointToGeodeticSurface(point: Point3d, result?: Point3d): Point3d | undefined {
    const oneOverRadii = Cartographic._wgs84OneOverRadii;
    const oneOverRadiiSquared = Cartographic._wgs84OneOverRadiiSquared;
    const centerToleranceSquared = Cartographic._wgs84CenterToleranceSquared;
    return Cartographic._scaleToGeodeticSurface(point, oneOverRadii, oneOverRadiiSquared, centerToleranceSquared, result);
  }

  /** Duplicates a Cartographic. */
  public clone(result?: Cartographic): Cartographic {
    if (!result)
      return Cartographic.fromJSON({ longitude: { radians: this.longitudeRadians }, latitude: { radians: this.latitudeRadians }, height: this.height });

    result.longitude = Angle.fromJSON({ radians: this.longitudeRadians });
    result.latitude = Angle.fromJSON({ radians: this.latitudeRadians });
    result.height = this.height;
    return result;
  }

  /** Return true if this Cartographic is the same as right */
  public equals(right: Cartographic): boolean {
    return (this === right) ||
      ((this.longitudeRadians === right.longitudeRadians) &&
        (this.latitudeRadians === right.latitudeRadians) &&
        (this.height === right.height));
  }

  /** Compares this Cartographic component-wise and returns true if they are within the provided epsilon, */
  public equalsEpsilon(right: Cartographic, epsilon: number): boolean {
    const rHeight = right.height !== undefined ? right.height : 0;
    return (this === right) ||
      ((Math.abs(this.longitudeRadians - right.longitudeRadians) <= epsilon) &&
        (Math.abs(this.latitudeRadians - right.latitudeRadians) <= epsilon) &&
        (Math.abs(this.height - rHeight) <= epsilon));
  }

  private static normalize(cartesian: XYZ, result: XYZ) {
    const magnitude = cartesian.magnitude();
    result.x = cartesian.x / magnitude;
    result.y = cartesian.y / magnitude;
    result.z = cartesian.z / magnitude;
  }

  private static multiplyComponents(left: XYAndZ, right: XYAndZ, result: XYZ) {
    result.x = left.x * right.x;
    result.y = left.y * right.y;
    result.z = left.z * right.z;
  }

  private static scalePoint(cartesian: XYAndZ, scalar: number, result: XYZ) {
    result.x = cartesian.x * scalar;
    result.y = cartesian.y * scalar;
    result.z = cartesian.z * scalar;
  }

  private static addPoints(left: XYAndZ, right: XYAndZ, result: XYZ) {
    result.x = left.x + right.x;
    result.y = left.y + right.y;
    result.z = left.z + right.z;
  }

  /** Create a string representing this cartographic in the format '(longitude, latitude, height)'. */
  public toString(): string { return `(${this.longitude}, ${this.latitude}, ${this.height})`; }

  private static _scaleToGeodeticSurfaceIntersection = new Point3d();
  private static _scaleToGeodeticSurfaceGradient = new Point3d();
  private static _scaleToGeodeticSurface(cartesian: Point3d, oneOverRadii: XYAndZ, oneOverRadiiSquared: XYAndZ, centerToleranceSquared: number, result?: Point3d) {
    const positionX = cartesian.x;
    const positionY = cartesian.y;
    const positionZ = cartesian.z;

    const oneOverRadiiX = oneOverRadii.x;
    const oneOverRadiiY = oneOverRadii.y;
    const oneOverRadiiZ = oneOverRadii.z;

    const x2 = positionX * positionX * oneOverRadiiX * oneOverRadiiX;
    const y2 = positionY * positionY * oneOverRadiiY * oneOverRadiiY;
    const z2 = positionZ * positionZ * oneOverRadiiZ * oneOverRadiiZ;

    // Compute the squared ellipsoid norm.
    const squaredNorm = x2 + y2 + z2;
    const ratio = Math.sqrt(1.0 / squaredNorm);

    // As an initial approximation, assume that the radial intersection is the projection point.
    const intersection = Cartographic._scaleToGeodeticSurfaceIntersection;
    Cartographic.scalePoint(cartesian, ratio, intersection);

    // If the position is near the center, the iteration will not converge.
    if (squaredNorm < centerToleranceSquared) {
      return !isFinite(ratio) ? undefined : Point3d.createFrom(intersection, result);
    }

    const oneOverRadiiSquaredX = oneOverRadiiSquared.x;
    const oneOverRadiiSquaredY = oneOverRadiiSquared.y;
    const oneOverRadiiSquaredZ = oneOverRadiiSquared.z;

    // Use the gradient at the intersection point in place of the true unit normal.
    // The difference in magnitude will be absorbed in the multiplier.
    const gradient = Cartographic._scaleToGeodeticSurfaceGradient;
    gradient.x = intersection.x * oneOverRadiiSquaredX * 2.0;
    gradient.y = intersection.y * oneOverRadiiSquaredY * 2.0;
    gradient.z = intersection.z * oneOverRadiiSquaredZ * 2.0;

    // Compute the initial guess at the normal vector multiplier, lambda.
    let lambda = (1.0 - ratio) * cartesian.magnitude() / (0.5 * gradient.magnitude());
    let correction = 0.0;
    let func;
    let denominator;
    let xMultiplier;
    let yMultiplier;
    let zMultiplier;
    let xMultiplier2;
    let yMultiplier2;
    let zMultiplier2;
    let xMultiplier3;
    let yMultiplier3;
    let zMultiplier3;

    do {
      lambda -= correction;

      xMultiplier = 1.0 / (1.0 + lambda * oneOverRadiiSquaredX);
      yMultiplier = 1.0 / (1.0 + lambda * oneOverRadiiSquaredY);
      zMultiplier = 1.0 / (1.0 + lambda * oneOverRadiiSquaredZ);

      xMultiplier2 = xMultiplier * xMultiplier;
      yMultiplier2 = yMultiplier * yMultiplier;
      zMultiplier2 = zMultiplier * zMultiplier;

      xMultiplier3 = xMultiplier2 * xMultiplier;
      yMultiplier3 = yMultiplier2 * yMultiplier;
      zMultiplier3 = zMultiplier2 * zMultiplier;

      func = x2 * xMultiplier2 + y2 * yMultiplier2 + z2 * zMultiplier2 - 1.0;

      // "denominator" here refers to the use of this expression in the velocity and acceleration
      // computations in the sections to follow.
      denominator = x2 * xMultiplier3 * oneOverRadiiSquaredX + y2 * yMultiplier3 * oneOverRadiiSquaredY + z2 * zMultiplier3 * oneOverRadiiSquaredZ;

      const derivative = -2.0 * denominator;

      correction = func / derivative;
    } while (Math.abs(func) > 0.01);

    if (!result)
      return new Point3d(positionX * xMultiplier, positionY * yMultiplier, positionZ * zMultiplier);

    result.x = positionX * xMultiplier;
    result.y = positionY * yMultiplier;
    result.z = positionZ * zMultiplier;
    return result;
  }

  /** Return an ECEF point from a Cartographic point */
  public toEcef(result?: Point3d): Point3d {
    const cosLatitude = Math.cos(this.latitudeRadians);
    const scratchN = Cartographic._scratchN;
    const scratchK = Cartographic._scratchK;
    scratchN.x = cosLatitude * Math.cos(this.longitudeRadians);
    scratchN.y = cosLatitude * Math.sin(this.longitudeRadians);
    scratchN.z = Math.sin(this.latitudeRadians);
    Cartographic.normalize(scratchN, scratchN);

    Cartographic.multiplyComponents(Cartographic._wgs84RadiiSquared, scratchN, scratchK);
    const gamma = Math.sqrt(scratchN.dotProduct(scratchK));
    Cartographic.scalePoint(scratchK, 1.0 / gamma, scratchK);
    Cartographic.scalePoint(scratchN, this.height, scratchN);

    result = result ? result : new Point3d();
    Cartographic.addPoints(scratchK, scratchN, result);
    return result;
  }
}
/** A cartographic range representing a rectangular region if low longitude/latitude > high then area crossing seam is indicated.
 * @public
 */
export class CartographicRange {
  private _ranges: Range2d[] = [];

  // These following are used to preserve the min/max latitude and longitudes.
  // The longitudes are raw values and may cross over the -PI or 2PI boundaries.
  private _minLongitude = 0;
  private _maxLongitude = 0;
  private _minLatitude = 0;
  private _maxLatitude = 0;
  constructor(spatialRange: Range3d, spatialToEcef: Transform) {
    // Compute 8 corners in spatial coordinate system before converting to ECEF
    // We want a box oriented in the spatial coordinate system and not in the ECEF coordinate system
    const spatialCorners = spatialRange.corners();
    const ecefCorners = spatialToEcef.multiplyPoint3dArray(spatialCorners);
    let low: Cartographic | undefined, high: Cartographic | undefined;

    for (const ecefCorner of ecefCorners) {
      const geoPt = Cartographic.fromEcef(ecefCorner);
      if (!geoPt)
        continue;
      if (undefined === low || undefined === high) {
        low = geoPt;
        high = geoPt.clone();
        continue;
      }
      low = Cartographic.fromJSON({ latitude: Math.min(low.latitudeRadians, geoPt.latitudeRadians), longitude: Math.min(low.longitudeRadians, geoPt.longitudeRadians), height: low.height });
      high = Cartographic.fromJSON({ latitude: Math.max(high.latitudeRadians, geoPt.latitudeRadians), longitude: Math.max(high.longitudeRadians, geoPt.longitudeRadians), height: high.height });
    }

    if (!low || !high) {
      assert(false);
      return;
    }

    const longitudeRanges = [];
    this._minLongitude = Math.min(low.longitudeRadians, high.longitudeRadians), this._maxLongitude = Math.max(low.longitudeRadians, high.longitudeRadians);
    if (this._maxLongitude - this._minLongitude > Angle.piRadians) {
      longitudeRanges.push(Range1d.createXX(0.0, this._minLongitude));
      longitudeRanges.push(Range1d.createXX(this._maxLongitude, Angle.pi2Radians));
    } else {
      longitudeRanges.push(Range1d.createXX(this._minLongitude, this._maxLongitude));
    }

    for (const longitudeRange of longitudeRanges) {
      this._minLatitude = Math.min(low.latitudeRadians, high.latitudeRadians), this._maxLatitude = Math.max(low.latitudeRadians, high.latitudeRadians);
      if (this._maxLatitude - this._minLatitude > Angle.piOver2Radians) {
        this._ranges.push(Range2d.createXYXY(longitudeRange.low, 0.0, longitudeRange.high, this._minLatitude));
        this._ranges.push(Range2d.createXYXY(longitudeRange.low, this._maxLatitude, longitudeRange.high, Angle.piRadians));
      } else {
        this._ranges.push(Range2d.createXYXY(longitudeRange.low, this._minLatitude, longitudeRange.high, this._maxLatitude));
      }
    }
  }

  public intersectsRange(other: CartographicRange): boolean {
    for (const range of this._ranges)
      for (const otherRange of other._ranges)
        if (range.intersectsRange(otherRange))
          return true;
    return false;
  }

  /** This method returns the raw latitude / longitude for the range in a Range2d object.
   * The X value represents the longitude and the Y value the latitudes.
   * Y values are kept between -PI and +PI while
   * longitude values can be expressed in any range between -2PI to +2PI
   * given the minimum longitude is always smaller numerically than the maximum longitude.
   * Note that usually the longitudes are usually by convention in the range of -PI to PI except
   * for ranges that overlap the -PI/+PI frontier in which case either representation is acceptable.
   */
  public getLongitudeLatitudeBoundingBox(): Range2d {
    return Range2d.createXYXY(this._minLongitude, this._minLatitude, this._maxLongitude, this._maxLatitude);
  }
}
