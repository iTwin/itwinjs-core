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

import { Registry } from "./Registry";
import { Unit } from "./Unit";

/**
 * Class PrimeMeridian defines the parameters of a prime meridian.
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
export class PrimeMeridian {
  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The longitude from Greenwich */
  private _lonFromGreenwich: float64;
  /** The code of the unit of longitude */
  private _unitCode: int32;

  /**
   * Create a new prime meridian.
   * @param code the code.
   * @param name the name.
   * @param lonFromGreenwich the longitude from Greenwich.
   * @param unitCode the code of the unit of longitude.
   */
  public constructor(
    code: int32,
    name: string,
    lonFromGreenwich: float64,
    unitCode: int32
  ) {
    /* Store parameters */
    this._code = code;
    this._name = name;
    this._lonFromGreenwich = lonFromGreenwich;
    this._unitCode = unitCode;
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
   * Get the longitude from Greenwich.
   * @return the longitude from Greenwich.
   */
  public getLonFromGreenwich(): float64 {
    return this._lonFromGreenwich;
  }

  /**
   * Get the longitude from Greenwich in radians.
   * @return the longitude from Greenwich in radians.
   */
  public getLonFromGreenwichRad(): float64 {
    let unit: Unit = Registry.getUnit(this._unitCode);
    return unit.toStandard(this._lonFromGreenwich);
  }

  /**
   * Get the longitude from Greenwich in degrees.
   * @return the longitude from Greenwich in degrees.
   */
  public getLonFromGreenwichDeg(): float64 {
    if (this._unitCode == Unit.DEGREE) return this._lonFromGreenwich;
    return (this.getLonFromGreenwichRad() / Math.PI) * 180.0;
  }

  /**
   * Get the code of the unit of longitude.
   * @return the code of the unit of longitude.
   */
  public getUnitCode(): int32 {
    return this._unitCode;
  }

  /**
   * Check if another prime meridian is compatible with this one.
   * @param other the other prime meridian.
   * @return true if compatible.
   */
  public isCompatible(other: PrimeMeridian): boolean {
    if (other._code == this._code) return true;
    if (other._unitCode != this._unitCode) return false;
    if (other._lonFromGreenwich != this._lonFromGreenwich) return false;
    return true;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return "[PrimeMeridian:code=" + this._code + ",name='" + this._name + "']";
  }
}
