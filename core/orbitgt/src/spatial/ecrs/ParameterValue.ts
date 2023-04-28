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

import { Unit } from "./Unit";

/**
 * Class ParameterValue defines the value of a parameter of a certain method.
 *
 * @version 1.0 January 2007
 */
/** @internal */
export class ParameterValue {
  /** The identification code of the parameter */
  private _parameterCode: int32;
  /** The value of the parameter */
  private _parameterValue: float64;
  /** The unit of measure */
  private _unit: Unit;

  /**
   * Create a new value.
   * @param parameterCode the identification code of the parameter.
   * @param parameterValue the value of the parameter.
   * @param unit the unit of measure.
   */
  public constructor(
    parameterCode: int32,
    parameterValue: float64,
    unit: Unit
  ) {
    this._parameterCode = parameterCode;
    this._parameterValue = parameterValue;
    this._unit = unit;
  }

  /**
   * Get the identification code of the parameter.
   * @return the code.
   */
  public getParameterCode(): int32 {
    return this._parameterCode;
  }

  /**
   * Get the value of the parameter.
   * @return the value.
   */
  public getParameterValue(): float64 {
    return this._parameterValue;
  }

  /**
   * Get the unit of measure.
   * @return the unit.
   */
  public getUnit(): Unit {
    return this._unit;
  }

  /**
   * Check if another parameter value is compatible with this one.
   * @param other the other parameter value.
   * @return true if compatible.
   */
  public isCompatible(other: ParameterValue): boolean {
    if (other._parameterCode != this._parameterCode) return false;
    if (other._parameterValue != this._parameterValue) return false;
    if (other._unit.isCompatible(this._unit) == false) return false;
    return true;
  }
}
