/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs.transformation;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "../../geom/Coordinate";
import { CRS } from "../CRS";
import { OperationMethod } from "../OperationMethod";
import { ParameterValue } from "../ParameterValue";
import { ParameterValueList } from "../ParameterValueList";

/**
 * Class PositionVector defines a Position Vector 7-parameter transformation (see Guidance Note 2.4.3.2.1).
 *
 * NOTE: this method is also known as "Bursa-Wolf".
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised May 2005
 * Available at: http://www.epsg.org/
 *
 * Used in Europe. To convert to "Coordinate Frame Rotation" inverse the sign of the three rotations.
 *
 * @version 1.0 July 2005
 */
/** @internal */
export class PositionVector extends OperationMethod {
  /** The code of this method */
  public static readonly METHOD_CODE: int32 = 9606;

  /** The translation vector */
  private _dX: float64;
  private _dY: float64;
  private _dZ: float64;
  /** The rotations (radians) */
  private _rX: float64;
  private _rY: float64;
  private _rZ: float64;
  /** The scale factor (offset from 1.0) */
  private _dS: float64;

  /**
   * Create a new transformation.
   * @param parameters the values of the parameters.
   */
  public constructor(parameters: ParameterValueList) {
    super(PositionVector.METHOD_CODE, "Position Vector 7-param. transformation", parameters);
    /* Store the parameters */
    this._dX = parameters.getValue(8605);
    this._dY = parameters.getValue(8606);
    this._dZ = parameters.getValue(8607);
    this._rX = parameters.getValue(8608);
    this._rY = parameters.getValue(8609);
    this._rZ = parameters.getValue(8610);
    this._dS = parameters.getValue(8611);
  }

  /**
   * Create a new transformation.
   * @param dX the translation vector x.
   * @param dY the translation vector y.
   * @param dZ the translation vector z.
   * @param rX the first rotation (radians).
   * @param rY the second rotation (radians).
   * @param rZ the third rotation (radians).
   * @param dS the scale factor (offset from 1.0) (normal units, not ppm).
   * @return the new transformation.
   */
  public static create(
    dX: float64,
    dY: float64,
    dZ: float64,
    rX: float64,
    rY: float64,
    rZ: float64,
    dS: float64
  ): PositionVector {
    let parameters: ParameterValueList = new ParameterValueList();
    parameters.add(new ParameterValue(8605, dX, null));
    parameters.add(new ParameterValue(8606, dY, null));
    parameters.add(new ParameterValue(8607, dZ, null));
    parameters.add(new ParameterValue(8608, rX, null));
    parameters.add(new ParameterValue(8609, rY, null));
    parameters.add(new ParameterValue(8610, rZ, null));
    parameters.add(new ParameterValue(8611, dS, null));
    return new PositionVector(parameters);
  }

  /**
   * Get the 7 parameters of the method.
   * @return the parameters of the method {dX,dY,dZ,rX,rY,rZ,dS} in units {meter,meter,meter, radian,radian,radian, scale_offset-1}.
   */
  public getParameters(): Float64Array {
    let parameters: Float64Array = new Float64Array(7);
    parameters[0] = this._dX;
    parameters[1] = this._dY;
    parameters[2] = this._dZ;
    parameters[3] = this._rX;
    parameters[4] = this._rY;
    parameters[5] = this._rZ;
    parameters[6] = this._dS;
    return parameters;
  }

  /**
   * Make a forward transformation.
   * @param source the source coordinate (the coordinate to transform).
   * @param target the target coordinate (holds the result).
   */
  public transformForward(source: Coordinate, target: Coordinate): void {
    let x: float64 = source.getX();
    let y: float64 = source.getY();
    let z: float64 = source.getZ();
    let m: float64 = 1.0 + this._dS;
    target.setX(m * (1.0 * x - this._rZ * y + this._rY * z) + this._dX);
    target.setY(m * (this._rZ * x + 1.0 * y - this._rX * z) + this._dY);
    target.setZ(m * (-this._rY * x + this._rX * y + 1.0 * z) + this._dZ);
  }

  /**
   * Make a reverse transformation.
   * @param source the source coordinate (holds the result).
   * @param target the target coordinate (the coordinate to transform).
   */
  public transformReverse(source: Coordinate, target: Coordinate): void {
    this.createInverse().transformForward(target, source);
  }

  /**
   * OperationMethod interface method.
   * @see OperationMethod#forward
   */
  public forward(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void {
    this.transformForward(source, target);
  }

  /**
   * OperationMethod interface method.
   * @see OperationMethod#reverse
   */
  public reverse(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void {
    this.transformReverse(source, target);
  }

  /**
   * Create an inverse transformation.
   * @return the inverse transformation.
   */
  public createInverse(): PositionVector {
    return PositionVector.create(-this._dX, -this._dY, -this._dZ, -this._rX, -this._rY, -this._rZ, -this._dS);
  }
}
