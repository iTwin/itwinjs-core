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

/**
 * Class Axis defines the parameters of a coordinate axis.
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised May 2005
 * Available at: http://www.epsg.org/
 *
 * @version 1.0 July 2008
 */
/** @internal */
export class Axis {
  /** The code */
  private _code: int32;
  /** The axis name */
  private _axisName: string;
  /** The axis orientation */
  private _axisOrientation: string;
  /** The abbreviation */
  private _abbreviation: string;
  /** The unit-of-measurement code */
  private _unitCode: int32;
  /** The axis order */
  private _order: int32;

  /**
   * Create a new axis.
   * @param code the code.
   * @param axisName the name of the axis.
   * @param axisOrientation the orientation of the axis.
   * @param abbreviation the abbreviation.
   * @param unitCode the unit-of-measurement code.
   * @param order the axis order.
   */
  public constructor(
    code: int32,
    axisName: string,
    axisOrientation: string,
    abbreviation: string,
    unitCode: int32,
    order: int32
  ) {
    /* Store parameters */
    this._code = code;
    this._axisName = axisName;
    this._axisOrientation = axisOrientation;
    this._abbreviation = abbreviation;
    this._unitCode = unitCode;
    this._order = order;
  }

  /**
   * Get the code.
   * @return the code.
   */
  public getCode(): int32 {
    return this._code;
  }

  /**
   * Get the axis name.
   * @return the axis name.
   */
  public getAxisName(): string {
    return this._axisName;
  }

  /**
   * Get the axis orientation.
   * @return the axis orientation.
   */
  public getAxisOrientation(): string {
    return this._axisOrientation;
  }

  /**
   * Get the abbreviation.
   * @return the abbreviation.
   */
  public getAbbreviation(): string {
    return this._abbreviation;
  }

  /**
   * Get the unit-of-measurement code.
   * @return the unit-of-measurement code.
   */
  public getUnitCode(): int32 {
    return this._unitCode;
  }

  /**
   * Get the axis order.
   * @return the axis order.
   */
  public getOrder(): int32 {
    return this._order;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[Axis:code=" +
      this._code +
      ",name='" +
      this._axisName +
      "',orientation='" +
      this._axisOrientation +
      "',abbreviation='" +
      this._abbreviation +
      "',unit=" +
      this._unitCode +
      ",order=" +
      this._order +
      "]"
    );
  }
}
