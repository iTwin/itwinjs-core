/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { XYCurveEvaluator } from "./XYCurveEvaluator";
/** Intermediate class for evaluation of bare cubic spirals `y = m ^x^3` with x axis from [0..xLength]
 * * This implements all the computations among fraction, x, and y.
 * * Derived classes implement specialized logic such as (a) precomputing `m` and (b) domain-specific fraction-to-distance approximations.
 * @internal
 */
export abstract class CubicEvaluator extends XYCurveEvaluator {
  protected _cubicM: number;
  protected _axisLength: number;
  protected constructor(axisLength: number, cubicM: number) {
    super();
    this._cubicM = cubicM;
    this._axisLength = axisLength;
  }
  /** Update both constants. */
  public setConstants(axisLength: number, cubicM: number) {
    this._axisLength = axisLength;
    this._cubicM = cubicM;
  }
  public get axisLength() { return this._axisLength; }
  public get cubicM() { return this._cubicM; }
  /**
   * Apply `scaleFactor` to the xLength and cubicM.
   * * Derived classes commonly call this as `super.scaleInPlace()`, and additionally apply the scale to their members.
   * @param scaleFactor
   */
  public scaleInPlace(scaleFactor: number) {
    this._axisLength *= scaleFactor;
    // "x" arriving at "m * x^3" will be scaled. "m" has to be divided by the scale to cancel 2 of the 3 . .
    this._cubicM /= (scaleFactor * scaleFactor);
  }
  /** Evaluate X at fraction. */
  public fractionToX(fraction: number): number { return fraction * this._axisLength; }
  /** Evaluate derivative of X with respect to fraction */
  public fractionToDX(_fraction: number): number { return this._axisLength; }
  /** Evaluate second derivative of X with respect to fraction */
  public fractionToDDX(_fraction: number): number { return 0.0; }
  /** Evaluate third derivative of X with respect to fraction */
  public fractionToD3X(_fraction: number): number { return 0.0; }
  /** Evaluate Y at fraction. */
  public fractionToY(fraction: number): number {
    const x = fraction * this._axisLength;
    return this._cubicM * x * x * x;
  }
  /** Evaluate derivative of Y with respect to fraction. */
  public fractionToDY(fraction: number): number {
    const x = fraction * this._axisLength;
    return 3.0 * this._cubicM * x * x * this._axisLength;
  }
  /** Evaluate second derivative of Y with respect to fraction. */
  public fractionToDDY(fraction: number): number {
    const x = fraction * this._axisLength;
    return 6.0 * this._cubicM * x * this._axisLength * this._axisLength;
  }
  /** Evaluate third derivative of Y with respect to fraction. */
  public fractionToD3Y(_fraction: number): number {
    return 6.0 * this._cubicM * this._axisLength * this._axisLength * this._axisLength;
  }
  /** Evaluate fraction at x. */
  public xToFraction(x: number): number { return x / this._axisLength; }
}
