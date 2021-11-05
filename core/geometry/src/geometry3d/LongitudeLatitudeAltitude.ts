/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { BeJSONFunctions, Geometry } from "../Geometry";
import { Angle } from "./Angle";

/**
 * An `AngleAngleNumber` is a pair of angles (named `longitude` and `latitude`) and an additional number.
 * * This is directly intended to support `Ellipsoid` computations, with the two angles used as
 *    * `longitude` is "around the equator"
 *    * `latitude` is "equator to pole"
 *    * `h` is altitude above the `Ellipsoid surface.
 * * The structure may also be used for torus coordinates.
 * @public
 */
export class LongitudeLatitudeNumber implements BeJSONFunctions {
  private _longitude: Angle;
  private _latitude: Angle;
  private _altitude: number;
  /** (property getter) longitude in radians */
  public get longitudeRadians(): number { return this._longitude.radians; }
  /** (property getter) longitude in degrees */
  public get longitudeDegrees(): number { return this._longitude.degrees; }
  /** (property getter) (reference to) longitude as a strongly typed `Angle` */
  public get longitudeRef(): Angle { return this._longitude; }
  /** (property getter) (clone of)  longitude as a strongly typed `Angle` */
  public get longitude(): Angle { return this._longitude.clone(); }

  /** (property getter) latitude in radians */
  public get latitudeRadians(): number { return this._latitude.radians; }
  /** (property getter) latitude in degrees */
  public get latitudeDegrees(): number { return this._latitude.degrees; }
  /** (property getter) (reference to) latitude as a strongly typed `Angle` */
  public get latitudeRef(): Angle { return this._latitude; }
  /** (property getter) (clone of)  latitude as a strongly typed `Angle` */
  public get latitude(): Angle { return this._latitude.clone(); }

  /** Get or set the altitude. */
  public get altitude(): number { return this._altitude; }
  public set altitude(value: number) { this._altitude = value; }
  /** Constructor: Capture angles and altitude */
  private constructor(longitude: Angle, latitude: Angle, altitude: number) {
    this._longitude = longitude;
    this._latitude = latitude;
    this._altitude = altitude;
  }
  /** Create with all zero angles and altitude. */
  public static createZero(): LongitudeLatitudeNumber { return new LongitudeLatitudeNumber(Angle.createDegrees(0), Angle.createDegrees(0), 0); }
  /** Create with strongly typed `Angle` inputs */
  public static create(longitude: Angle, latitude: Angle, h: number = 0, result?: LongitudeLatitudeNumber): LongitudeLatitudeNumber {
    if (result) {
      result._latitude.setFrom(latitude);
      result._longitude.setFrom(longitude);
      result._altitude = h;
      return result;
    }
    return new LongitudeLatitudeNumber(longitude.clone(), latitude.clone(), h);
  }
  /** Create with angles in radians. */
  public static createRadians(longitudeRadians: number, latitudeRadians: number, h: number = 0, result?: LongitudeLatitudeNumber): LongitudeLatitudeNumber {
    if (result) {
      result._longitude.setRadians(longitudeRadians);
      result._latitude.setRadians(latitudeRadians);
      result._altitude = h;
      return result;
    }
    return new LongitudeLatitudeNumber(Angle.createRadians(longitudeRadians), Angle.createRadians(latitudeRadians), h);
  }
  /** Create with angles in degrees. */
  public static createDegrees(longitudeDegrees: number, latitudeDegrees: number, h: number = 0, result?: LongitudeLatitudeNumber): LongitudeLatitudeNumber {
    if (result) {
      result._longitude.setRadians(longitudeDegrees);
      result._latitude.setRadians(latitudeDegrees);
      result._altitude = h;
      return result;
    }
    return new LongitudeLatitudeNumber(Angle.createDegrees(longitudeDegrees), Angle.createDegrees(latitudeDegrees), h);
  }
  /**
   * Set content from a JSON object.
   * If the json object is undefined or unrecognized, always set a default value.
   *
   */
  public setFromJSON(json: any) {
    if (json.latitude !== undefined) {
      this._latitude.setFromJSON(json.latitude);
    } else {
      this._latitude.setDegrees(0);
    }

    if (json.longitude !== undefined) {
      this._longitude.setFromJSON(json.longitude);
    } else {
      this._longitude.setDegrees(0);
    }

    if (json.h !== undefined && Number.isFinite(json.h)) {
      this._altitude = json.h;
    } else {
      this._altitude = 0;
    }
  }

  /** Return a json object with this object's contents.
   * * Tag names are: longitude, latitude, h
   */
  public toJSON(): any {
    return { latitude: this._latitude.toJSON(), longitude: this._longitude.toJSON(), h: this._altitude };
  }
  /** Test for near equality */
  public isAlmostEqual(other: LongitudeLatitudeNumber): boolean {
    return this._latitude.isAlmostEqual(other._latitude)
      && this._longitude.isAlmostEqual(other._longitude)
      && Geometry.isSameCoordinate(this._altitude, other._altitude);
  }
  /** Return a copy */
  public clone(): LongitudeLatitudeNumber {
    return new LongitudeLatitudeNumber(this._longitude.clone(), this._latitude.clone(), this._altitude);
  }
}
