/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "../geom/Coordinate";
import { Registry } from "./Registry";
import { Unit } from "./Unit";

/**
 * Class Ellipsoid defines the parameters of an earth ellipsoid.
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised May 2005
 * Available at: http://www.epsg.org/
 *
 * Geocentric coordinates are defined as follows:
 * The point (0,0,0) denotes the center of the ellipsoid. The z-axis is defined as being parallel to the earth rotational axis, pointing towards north.
 * The x-axis intersects the ellipsoid at the 0 deg latitude, 0 deg longitude point.
 *
 * @version 1.0 July 2005
 */
/** @internal */
export class Ellipsoid {
  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The code of the unit of measure */
  private _unitCode: int32;
  /** Semi-major axis (meter) */
  private _a: float64;
  /** Semi-minor axis (meter) (derived) */
  private _b: float64;
  /** Flattening (derived) */
  private _f: float64;
  /** Inverse flattening */
  private _invF: float64;
  /** Eccentricity (derived) */
  private _e: float64;
  /** Eccentricity squared (derived) */
  private _e2: float64;

  /**
   * Create a new ellipsoid.
   * @param code the code.
   * @param name the name.
   * @param unitCode the code of the unit of measure.
   * @param a the semi-major axis.
   * @param invF the inverse flattening (value like 300, not like 1/300).
   * @param b the semi-minor axis.
   */
  public constructor(
    code: int32,
    name: string,
    unitCode: int32,
    a: float64,
    invF: float64,
    b: float64
  ) {
    /* Store parameters */
    this._code = code;
    this._name = name;
    this._unitCode = unitCode;
    this._a =
      unitCode == Unit.METER
        ? a
        : Registry.getUnit(this._unitCode).toStandard(a);
    this._invF = invF;
    this._b =
      unitCode == Unit.METER
        ? b
        : Registry.getUnit(this._unitCode).toStandard(b);
    /* Derive parameters */
    if (this._invF == 0.0) this._invF = a / (a - b);
    this._f = 1.0 / this._invF;
    if (this._b == 0.0) this._b = this._a * (1.0 - this._f);
    this._e = Math.sqrt(2.0 * this._f - this._f * this._f);
    this._e2 = this._e * this._e; // or = (a*a-b*b)/(a*a);
  }

  /**
   * Get the code.
   * @return the code.
   */
  public getCode(): int32 {
    return this._code;
  }

  /**
   * Get the name.
   * @return the name.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Get the code of the unit of measure.
   * @return the code of the unit of measure.
   */
  public getUnitCode(): int32 {
    return this._unitCode;
  }

  /**
   * Get the semi-major axis (in meter).
   * @return the semi-major axis.
   */
  public getA(): float64 {
    return this._a;
  }

  /**
   * Get the semi-minor axis (in meter).
   * @return the semi-minor axis.
   */
  public getB(): float64 {
    return this._b;
  }

  /**
   * Get the flattening.
   * @return the flattening.
   */
  public getF(): float64 {
    return this._f;
  }

  /**
   * Get the inverse flattening.
   * @return the inverse flattening.
   */
  public getInvF(): float64 {
    return this._invF;
  }

  /**
   * Get the eccentricity.
   * @return the eccentricity.
   */
  public getE(): float64 {
    return this._e;
  }

  /**
   * Get the radius of curvature of the ellipsoid in the plane of the meridian at a given latitude (how latitude curves).
   * @param lat the latitude (in radians).
   * @return a radius (in meter).
   */
  public getMeridianRadius(lat: float64): float64 {
    // Formula: see http://en.wikipedia.org/wiki/Latitude
    let t: float64 = this._e * Math.sin(lat);
    return (this._a * (1.0 - this._e2)) / Math.pow(1.0 - t * t, 3.5);
  }

  /**
   * Get the radius of the circle defined by all points at a certain latitude (a circle of latitude, also called a parallel) (a at latitude 0, 0 at latitude 90) (how longitude curves).
   * @param lat the latitude (in radians).
   * @return a radius (in meter).
   */
  public getParallelRadius(lat: float64): float64 {
    // Formula: see http://en.wikipedia.org/wiki/Longitude
    let t: float64 = this._e * Math.sin(lat);
    return (this._a * Math.cos(lat)) / Math.sqrt(1.0 - t * t);
  }

  /**
   * Get the radius of curvature of the ellipsoid perpendicular to the meridian at a given latitude (a at latitude 0, a*a/b at latitude 90).
   * @param lat the latitude (in radians).
   * @return a radius (in meter).
   */
  public getPrimeVerticalRadius(lat: float64): float64 {
    let t: float64 = this._e * Math.sin(lat);
    return this._a / Math.sqrt(1.0 - t * t);
  }

  /**
   * Get the radius of curvature of the ellipsoid perpendicular to the meridian at a given latitude (a at latitude 0, a*a/b at latitude 90).
   * @param lat the latitude (in radians).
   * @param sinLat the sinus of the latitude.
   * @return a radius (in meter).
   */
  private getPrimeVerticalRadius2(lat: float64, sinLat: float64): float64 {
    let t: float64 = this._e * sinLat;
    return this._a / Math.sqrt(1.0 - t * t);
  }

  /**
   * Get the number of meter per radian of longitude.
   * @param lat the latitude (in radians).
   * @return the number of meter per radian.
   */
  public getMeterPerRadOfLon(lat: float64): float64 {
    return this.getParallelRadius(lat);
  }

  /**
   * Get the number of meter per degree of longitude.
   * @param lat the latitude (in radians).
   * @return the number of meter per degree.
   */
  public getMeterPerDegreeOfLon(lat: float64): float64 {
    return (this.getMeterPerRadOfLon(lat) * Math.PI) / 180.0;
  }

  /**
   * Get the number of meter per radian of latitude.
   * @param lat the latitude (in radians).
   * @return the number of meter per radian.
   */
  public getMeterPerRadOfLat(lat: float64): float64 {
    return this.getMeridianRadius(lat);
  }

  /**
   * Get the number of meter per degree of latitude.
   * @param lat the latitude (in radians).
   * @return the number of meter per degree.
   */
  public getMeterPerDegreeOfLat(lat: float64): float64 {
    return (this.getMeterPerRadOfLat(lat) * Math.PI) / 180.0;
  }

  /**
   * Calculate the secant.
   * @param v an angle (in radians).
   * @return the secant.
   */
  private static sec(v: float64): float64 {
    return 1.0 / Math.cos(v);
  }

  /**
   * Convert 3D geographic coordinates to 3D geocentric coordinates.
   * See the EPSG Guidance Note, 2.2.1
   * @param geographic the geographic coordinates (lon(x) and lat(y) in radians, height(z) in meter).
   * @param geocentric the new geocentric coordinates (in meter) (the result object).
   */
  public toGeoCentric(geographic: Coordinate, geocentric: Coordinate): void {
    /* Get the parameters */
    let lon: float64 = geographic.getX();
    let lat: float64 = geographic.getY();
    let h: float64 = geographic.getZ();
    /* Calculate */
    let sinLat: float64 = Math.sin(lat);
    let v: float64 = this.getPrimeVerticalRadius2(lat, sinLat);
    let s: float64 = (v + h) * Math.cos(lat);
    let x: float64 = s * Math.cos(lon);
    let y: float64 = s * Math.sin(lon);
    let z: float64 = ((1.0 - this._e2) * v + h) * sinLat;
    /* Store the new coordinates */
    geocentric.setX(x);
    geocentric.setY(y);
    geocentric.setZ(z);
  }

  /**
   * Convert 3D geographic coordinates to 3D geocentric coordinates.
   * See the EPSG Guidance Note, 2.2.1
   * @param geographic the geographic coordinates (lon(x) and lat(y) in degrees, height(z) in meter).
   * @param geocentric the new geocentric coordinates (in meter) (the result object).
   */
  public toGeoCentricDeg(geographic: Coordinate, geocentric: Coordinate): void {
    /* Get the parameters */
    let lon: float64 = (geographic.getX() / 180.0) * Math.PI;
    let lat: float64 = (geographic.getY() / 180.0) * Math.PI;
    let h: float64 = geographic.getZ();
    /* Calculate */
    let sinLat: float64 = Math.sin(lat);
    let v: float64 = this.getPrimeVerticalRadius2(lat, sinLat);
    let s: float64 = (v + h) * Math.cos(lat);
    let x: float64 = s * Math.cos(lon);
    let y: float64 = s * Math.sin(lon);
    let z: float64 = ((1.0 - this._e2) * v + h) * sinLat;
    /* Store the new coordinates */
    geocentric.setX(x);
    geocentric.setY(y);
    geocentric.setZ(z);
  }

  /**
   * Convert 3D geocentric coordinates to 3D geographic coordinates.
   * See the EPSG Guidance Note, 2.2.1
   * @param geocentric the geocentric coordinates (in meter).
   * @param geographic the new geographic coordinates (lon(x) and lat(y) in radians, height(z) in meter) (the result object).
   */
  public toGeoGraphic(geocentric: Coordinate, geographic: Coordinate): void {
    /* Get the parameters */
    let x: float64 = geocentric.getX();
    let y: float64 = geocentric.getY();
    let z: float64 = geocentric.getZ();
    /* Calculate */
    let r: float64 = Math.sqrt(x * x + y * y);
    let ir: float64 = 1.0 / r;
    let lat: float64 = Math.atan(z * ir);
    for (let i: number = 0; i < 7; i++) {
      let sinLat: float64 = Math.sin(lat);
      let vi: float64 = this.getPrimeVerticalRadius2(lat, sinLat);
      lat = Math.atan((z + this._e2 * vi * sinLat) * ir);
    }
    let lon: float64 = Math.atan2(y, x);
    let v: float64 = this.getPrimeVerticalRadius(lat);
    let h: float64 = x * Ellipsoid.sec(lon) * Ellipsoid.sec(lat) - v;
    /* Store the new coordinates */
    geographic.setX(lon);
    geographic.setY(lat);
    geographic.setZ(h);
    //
    // loop lat error:
    //
    // i=0: 0.0031239393816600014 // km level
    // i=1: 6.753891540589585E-6 // m level
    // i=2: 1.4568768968992174E-8 // mm level
    // i=3: 3.1426083957342144E-11 // um level
    // i=4: 6.783462680459706E-14 // nm level
    // i=5: 1.1102230246251565E-16 // atomic level
    // i=6: 0.0
    //
    // EPSG example for the WGS84 datum/ellipsoid:
    // X = 3771793.97;
    // Y =  140253.34;
    // Z = 5124304.35;
    // lat = 53.8093944; (degrees)
    // lon =  2.12955; (degrees)
    // h = 73.001873;
  }

  /**
   * Convert 3D geocentric coordinates to 3D geographic coordinates.
   * See the EPSG Guidance Note, 2.2.1
   * @param geocentric the geocentric coordinates (in meter).
   * @param geographic the new geographic coordinates (lon(x) and lat(y) in degrees, height(z) in meter) (the result object).
   */
  public toGeoGraphicDeg(geocentric: Coordinate, geographic: Coordinate): void {
    /* Get the parameters */
    let x: float64 = geocentric.getX();
    let y: float64 = geocentric.getY();
    let z: float64 = geocentric.getZ();
    /* Calculate */
    let r: float64 = Math.sqrt(x * x + y * y);
    let ir: float64 = 1.0 / r;
    let lat: float64 = Math.atan(z * ir);
    for (let i: number = 0; i < 7; i++) {
      let sinLat: float64 = Math.sin(lat);
      let vi: float64 = this.getPrimeVerticalRadius2(lat, sinLat);
      lat = Math.atan((z + this._e2 * vi * sinLat) * ir);
    }
    let lon: float64 = Math.atan2(y, x);
    let v: float64 = this.getPrimeVerticalRadius(lat);
    let h: float64 = x * Ellipsoid.sec(lon) * Ellipsoid.sec(lat) - v;
    /* Store the new coordinates */
    geographic.setX((lon / Math.PI) * 180.0);
    geographic.setY((lat / Math.PI) * 180.0);
    geographic.setZ(h);
  }

  /**
   * Check if another ellipsoid is compatible with this one.
   * @param other the other ellipsoid.
   * @return true if compatible.
   */
  public isCompatible(other: Ellipsoid): boolean {
    if (other._code == this._code) return true;
    if (other._unitCode != this._unitCode) return false;
    if (Math.abs(other._a - this._a) > 0.001) return false;
    if (Math.abs(other._b - this._b) > 0.001) return false;
    return true;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return "[Ellipsoid:code=" + this._code + ",name='" + this._name + "']";
  }
}
