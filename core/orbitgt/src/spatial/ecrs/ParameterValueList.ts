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

import { AList } from "../../system/collection/AList";
import { ParameterValue } from "./ParameterValue";

/**
 * Class ParameterValueList defines a list of parameter values.
 *
 * @version 1.0 January 2007
 */
/** @internal */
export class ParameterValueList {
  /** The list */
  private _list: AList<ParameterValue>;

  /**
   * Create a new list.
   */
  public constructor() {
    this._list = new AList<ParameterValue>();
  }

  /**
   * Get the number of parameter values.
   * @return the number of parameter values.
   */
  public size(): int32 {
    return this._list.size();
  }

  /**
   * Get a certain parameter value.
   * @param index the index of the parameter value.
   * @return the requested parameter value.
   */
  public get(index: int32): ParameterValue {
    return this._list.get(index);
  }

  /**
   * Add a parameter value.
   * @param value the parameter value to add.
   */
  public add(value: ParameterValue): void {
    this._list.add(value);
  }

  /**
   * Remove a parameter value.
   * @param value the parameter value to remove.
   * @return true if the value was removed, false if not.
   */
  public remove(value: ParameterValue): boolean {
    let index: int32 = this._list.indexOf(value);
    if (index < 0) return false;
    this._list.remove(index);
    return true;
  }

  /**
   * Clear the parameter list.
   */
  public clear(): void {
    this._list.clear();
  }

  /**
   * Find a parameter.
   * @param parameterCode the identification code of the parameter.
   * @return a parameter value (null if not found).
   */
  public find(parameterCode: int32): ParameterValue {
    /* Check all values */
    for (let i: number = 0; i < this._list.size(); i++) {
      /* Check the next value */
      let value: ParameterValue = this._list.get(i);
      if (value.getParameterCode() == parameterCode) return value;
    }
    /* Parameter not found */
    return null;
  }

  /**
   * Get the value of a parameter.
   * @param parameterCode the identification code of the parameter.
   * @return the (standard) value of the parameter.
   */
  public getValue(parameterCode: int32): float64 {
    let value: ParameterValue = this.find(parameterCode);
    if (value.getUnit() == null) return value.getParameterValue();
    return value.getUnit().toStandard(value.getParameterValue());
  }

  /**
   * Get the value of a parameter.
   * @param parameterCode the identification code of the parameter.
   * @param defaultValue the default value in case the parameter is not found.
   * @return the (standard) value of the parameter.
   */
  public getValue2(parameterCode: int32, defaultValue: float64): float64 {
    let value: ParameterValue = this.find(parameterCode);
    if (value == null) return defaultValue;
    if (value.getUnit() == null) return value.getParameterValue();
    return value.getUnit().toStandard(value.getParameterValue());
  }

  /**
   * Check if another parameter value list is compatible with this one.
   * @param other the other parameter value list (same parameter value sequence is assumed).
   * @return true if compatible.
   */
  public isCompatible(other: ParameterValueList): boolean {
    if (other.size() != this.size()) return false;
    for (let i: number = 0; i < this.size(); i++) if (other.get(i).isCompatible(this.get(i)) == false) return false;
    return true;
  }
}
