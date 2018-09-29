/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Geometry */

import { Angle, Point3d, Vector3d, XYZ, XYAndZ } from "@bentley/geometry-core";

// portions adapted from Cesium.js Copyright 2011 - 2017 Cesium Contributors
export interface LatAndLong { longitude: number; latitude: number; }
export interface LatLongAndHeight extends LatAndLong { height: number; }

/** A position on the earth defined by longitude, latitude, and height above the WSG84 ellipsoid . */
export class Cartographic implements LatLongAndHeight {
  /**
   * @param longitude longitude, in radians.
   * @param latitude latitude, in radians.
   * @param height The height, in meters, above the ellipsoid.
   */
  constructor(public longitude: number = 0, public latitude: number = 0, public height: number = 0) { }

  /**
   * Create a new Cartographic from longitude and latitude specified in radians.
   * @param longitude longitude, in radians.
   * @param latitude latitude, in radians.
   * @param height The height, in meters, above the ellipsoid.
   * @param result The object onto which to store the result.
   */
  public static fromRadians(longitude: number, latitude: number, height: number = 0, result?: Cartographic) {
    if (!result)
      return new Cartographic(longitude, latitude, height);

    result.longitude = longitude;
    result.latitude = latitude;
    result.height = height;
    return result;
  }

  /**
   * Create a new Cartographic from longitude and latitude specified in degrees. The values in the resulting object will
   * be in radians.
   * @param longitude longitude, in degrees.
   * @param latitude latitude, in degrees.
   * @param height The height, in meters, above the ellipsoid.
   * @param result The object onto which to store the result.
   */
  public static fromDegrees(longitude: number, latitude: number, height: number, result?: Cartographic) {
    return Cartographic.fromRadians(Angle.degreesToRadians(longitude), Angle.degreesToRadians(latitude), height, result);
  }

  /**
   * Create a new Cartographic from longitude and latitude in [Angle]($geometry)s. The values in the resulting object will
   * be in radians.
   * @param longitude longitude.
   * @param latitude latitude.
   * @param height The height, in meters, above the ellipsoid.
   * @param result The object into which to store the result (optional)
   */
  public static fromAngles(longitude: Angle, latitude: Angle, height: number, result?: Cartographic) {
    return Cartographic.fromRadians(longitude.radians, latitude.radians, height, result);
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

  /**
   * Creates a new Cartographic from an [ECEF](https://en.wikipedia.org/wiki/ECEF) position.
   * @param cartesian The position, in ECEF, to convert to cartographic representation.
   * @param [result] The object onto which to store the result.
   * @returns The modified result parameter, new Cartographic instance if none was provided, or undefined if the cartesian is at the center of the ellipsoid.
   */
  public static fromEcef(cartesian: Point3d, result?: Cartographic): Cartographic | undefined {
    const oneOverRadii = Cartographic._wgs84OneOverRadii;
    const oneOverRadiiSquared = Cartographic._wgs84OneOverRadiiSquared;
    const centerToleranceSquared = Cartographic._wgs84CenterToleranceSquared;
    const p = Cartographic.scaleToGeodeticSurface(cartesian, oneOverRadii, oneOverRadiiSquared, centerToleranceSquared, Cartographic._cartesianToCartographicP);

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
      return new Cartographic(longitude, latitude, height);

    result.longitude = longitude;
    result.latitude = latitude;
    result.height = height;
    return result;
  }

  /** Duplicates a Cartographic. */
  public clone(result?: Cartographic): Cartographic {
    if (!result)
      return new Cartographic(this.longitude, this.latitude, this.height);

    result.longitude = this.longitude;
    result.latitude = this.latitude;
    result.height = this.height;
    return result;
  }

  /** Return true if this Cartographic is the same as right */
  public equals(right: LatLongAndHeight): boolean {
    return (this === right) ||
      ((this.longitude === right.longitude) &&
        (this.latitude === right.latitude) &&
        (this.height === right.height));
  }

  /** Compares this Cartographic component-wise and returns true if they are within the provided epsilon, */
  public equalsEpsilon(right: LatLongAndHeight, epsilon: number): boolean {
    return (this === right) ||
      ((Math.abs(this.longitude - right.longitude) <= epsilon) &&
        (Math.abs(this.latitude - right.latitude) <= epsilon) &&
        (Math.abs(this.height - right.height) <= epsilon));
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
  public toString(): string { return "(" + this.longitude + ", " + this.latitude + ", " + this.height + ")"; }

  private static _scaleToGeodeticSurfaceIntersection = new Point3d();
  private static _scaleToGeodeticSurfaceGradient = new Point3d();
  private static scaleToGeodeticSurface(cartesian: Point3d, oneOverRadii: XYAndZ, oneOverRadiiSquared: XYAndZ, centerToleranceSquared: number, result?: Point3d) {
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
    const cosLatitude = Math.cos(this.latitude);
    const scratchN = Cartographic._scratchN;
    const scratchK = Cartographic._scratchK;
    scratchN.x = cosLatitude * Math.cos(this.longitude);
    scratchN.y = cosLatitude * Math.sin(this.longitude);
    scratchN.z = Math.sin(this.latitude);
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
