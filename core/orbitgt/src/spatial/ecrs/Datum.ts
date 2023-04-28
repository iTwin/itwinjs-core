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

import { ASystem } from "../../system/runtime/ASystem";
import { Strings } from "../../system/runtime/Strings";
import { Coordinate } from "../geom/Coordinate";
import { Ellipsoid } from "./Ellipsoid";
import { OperationMethod } from "./OperationMethod";
import { PrimeMeridian } from "./PrimeMeridian";

/**
 * Class Datum defines the parameters of a Datum.
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised May 2005
 * Available at: http://www.epsg.org/
 *
 * @version 1.0 July 2005
 */
/** @internal */
export class Datum {
  /** The type of a geodetic datum */
  public static readonly TYPE_GEODETIC: string = "geodetic";
  /** The type of a vertical datum */
  public static readonly TYPE_VERTICAL: string = "vertical";

  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The type */
  private _type: string;
  /** The ellipsoid */
  private _ellipsoid: Ellipsoid;
  /** The prime meridian */
  private _primeMeridian: PrimeMeridian;

  /** An optional preferred transformation to the WGS84 datum */
  private _toWGS84: OperationMethod;

  /**
   * Create a new datum.
   * @param code the code.
   * @param name the name.
   * @param type the type.
   * @param ellipsoid the ellipsoid.
   * @param primeMeridian the prime meridian.
   */
  public constructor(
    code: int32,
    name: string,
    type: string,
    ellipsoid: Ellipsoid,
    primeMeridian: PrimeMeridian
  ) {
    /* Check the parameters */
    ASystem.assertNot(name == null, "A datum needs a name");
    ASystem.assertNot(type == null, "A datum needs a type");
    /* Store the parameters */
    this._code = code;
    this._name = name;
    this._type = type;
    this._ellipsoid = ellipsoid;
    this._primeMeridian = primeMeridian;
    this._toWGS84 = null;
    /* Check the parameters */
    if (this.isTypeGeodetic()) {
      /* Check ellipsoid and prime meridian */
      ASystem.assertNot(
        ellipsoid == null,
        "A geodetic datum needs an ellipsoid"
      );
      ASystem.assertNot(
        primeMeridian == null,
        "A geodetic datum needs a prime meridian"
      );
    } else if (this.isTypeVertical()) {
      /* No ellipsoid and prime meridian */
      ASystem.assertNot(
        ellipsoid != null,
        "A vertical datum does not have an ellipsoid"
      );
      ASystem.assertNot(
        primeMeridian != null,
        "A vertical datum does not have a prime meridian"
      );
    } else {
      /* Invalid type */
      ASystem.assertNot(true, "Invalid datum type '" + type + "'");
    }
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
   * Get the type.
   * @return the type.
   */
  public getType(): string {
    return this._type;
  }

  /**
   * Is this a geodetic datum?
   * @return true for a geodetic datum.
   */
  public isTypeGeodetic(): boolean {
    return Strings.equalsIgnoreCase(this._type, Datum.TYPE_GEODETIC);
  }

  /**
   * Is this a vertical datum?
   * @return true for a vertical datum.
   */
  public isTypeVertical(): boolean {
    return Strings.equalsIgnoreCase(this._type, Datum.TYPE_VERTICAL);
  }

  /**
   * Get the ellipsoid.
   * @return the ellipsoid.
   */
  public getEllipsoid(): Ellipsoid {
    return this._ellipsoid;
  }

  /**
   * Get the prime meridian.
   * @return the prime meridian.
   */
  public getPrimeMeridian(): PrimeMeridian {
    return this._primeMeridian;
  }

  /**
   * Get the optional toWGS84 datum transformation.
   * @return the optional toWGS84 datum transformation.
   */
  public getToWGS84(): OperationMethod {
    return this._toWGS84;
  }

  /**
   * Set the optional toWGS84 datum transformation.
   * @param toWGS84 the optional toWGS84 datum transformation.
   */
  public setToWGS84(toWGS84: OperationMethod): void {
    this._toWGS84 = toWGS84;
  }

  /**
   * Check if another datum is compatible with this one.
   * @param other the other datum.
   * @return true if compatible.
   */
  public isCompatible(other: Datum): boolean {
    if (other._code == this._code) return true;
    if (Strings.equalsIgnoreCase(other._type, this._type) == false)
      return false;
    if (other._ellipsoid.isCompatible(this._ellipsoid) == false) return false;
    if (other._primeMeridian.isCompatible(this._primeMeridian) == false)
      return false;
    return true;
  }

  /**
   * Check if two datums are compatible.
   * @param datum1 the first datum.
   * @param datum2 the second datum.
   * @return true if compatible.
   */
  public static areCompatible(datum1: Datum, datum2: Datum): boolean {
    if (datum1 == null) return datum2 == null;
    if (datum2 == null) return false;
    return datum1.isCompatible(datum2);
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[Datum:code=" +
      this._code +
      ",name='" +
      this._name +
      "',ellipsoid=" +
      this._ellipsoid +
      ",primeMeridian=" +
      this._primeMeridian +
      "]"
    );
  }
}
