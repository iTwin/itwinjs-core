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

import { Strings } from "../../system/runtime/Strings";
import { Coordinate } from "../geom/Coordinate";
import { CRS } from "./CRS";
import { Operation } from "./Operation";
import { ParameterValueList } from "./ParameterValueList";

/**
 * Class OperationMethod defines a general method for transforming coordinates.
 *
 * @version 1.0 July 2005
 */
/** @internal */
export abstract class OperationMethod {
  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The parameter list */
  private _parameters: ParameterValueList;

  /**
   * Create a new method.
   * @param code the code.
   * @param name the name.
   */
  public constructor(code: int32, name: string, parameters: ParameterValueList) {
    this._code = code;
    this._name = name;
    this._parameters = parameters;
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
   * Get the parameter list.
   * @return the parameter list.
   */
  public getParameterList(): ParameterValueList {
    return this._parameters;
  }

  /**
   * Check if another method is compatible with this one.
   * @param other the other method.
   * @return true if compatible.
   */
  public isCompatible(other: OperationMethod): boolean {
    //        if (other.getClass()!=this.getClass()) return false;
    if (Strings.equals(other.getName(), this.getName()) == false) return false;
    if (other._parameters == null) return false;
    if (this._parameters == null) return false;
    if (other._parameters.isCompatible(this._parameters) == false) return false;
    return true;
  }

  /**
   * Initialize the method before making forward and reverse transforms.
   * @param operation the operation that is using this method.
   */
  public initialize(operation: Operation): void {
    /* Override when necessary */
  }

  /**
   * Convert a source coordinate to a target coordinate.
   * @param sourceCRS the source CRS.
   * @param source the coordinates in the source CRS.
   * @param targetCRS the target CRS.
   * @param target the coordinates in the target CRS.
   */
  public abstract forward(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void;

  /**
   * Convert a target coordinate to a source coordinate.
   * @param sourceCRS the source CRS.
   * @param source the coordinates in the source CRS.
   * @param targetCRS the target CRS.
   * @param target the coordinates in the target CRS.
   */
  public abstract reverse(sourceCRS: CRS, source: Coordinate, targetCRS: CRS, target: Coordinate): void;
}
