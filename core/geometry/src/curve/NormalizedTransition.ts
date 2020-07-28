/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
/**
 * NormalizedTransition is the (abstract) base class for clothoid, bloss, biquadratic, sine, and cosine transition functions.
 * * Each function maps fractional progress to a curvature value.
 *   * f(0) === 0
 *   * f(1) === 1
 *   * f(u) === 1 - f (1-u)
 * * Each implementation provides:
 *   * fractionToCurvature -- the f(u) function described above
 *   * fractionToCurvatureDerivative -- df(u)/du
 *   * fractionToArea -- integral of the area under f(u) from 0 to u.
 * * the symmetry condition ensures that the integral from 0 to 1 is 1/2
 * @internal
 */
export abstract class NormalizedTransition {
  /** Constructor initializes with 0..1 values .. call "setBearingCurvatureLengthCurvature" to apply real values */
  constructor() { }
  /** At fractional position on the x axis, return the (normalized) curvature fraction. */
  public abstract fractionToCurvatureFraction(fractionX: number): number;
  /** Return the derivative of the (normalized) curvature fraction */
  public abstract fractionToCurvatureFractionDerivative(fractionX: number): number;
  /** Return the integrated area under the curve
   * * This is equal to the accumulated angle change.
   */
  public abstract fractionToArea(fractionX: number): number;
  private static _clothoidEvaluator?: NormalizedClothoidTransition;
  private static _biquadraticEvaluator?: NormalizedBiQuadraticTransition;
  private static _blossEvaluator?: NormalizedBlossTransition;
  private static _sineEvaluator?: NormalizedSineTransition;
  private static _cosineEvaluator?: NormalizedCosineTransition;

  /**
   * Return a standard evaluator identified by string as:
   * * clothoid
   * * bloss
   * * biquadratic
   * * sine
   * * cosine
   * Each of these types
   * * is instantiated (only once) as a single static object within the NormalizedTransition class.
   * * has no instance data or mutator methods.
   * @param name string name of the transition.
   */
  public static findEvaluator(name: string): NormalizedTransition | undefined {
    if (name === "clothoid")
      return this._clothoidEvaluator ? this._clothoidEvaluator : (this._clothoidEvaluator = new NormalizedClothoidTransition());
    if (name === "bloss")
      return this._blossEvaluator ? this._clothoidEvaluator : (this._blossEvaluator = new NormalizedBlossTransition());
    if (name === "biquadratic")
      return this._biquadraticEvaluator ? this._biquadraticEvaluator : (this._biquadraticEvaluator = new NormalizedBiQuadraticTransition());
    if (name === "sine")
      return this._sineEvaluator ? this._sineEvaluator : (this._sineEvaluator = new NormalizedSineTransition());
    if (name === "cosine")
      return this._cosineEvaluator ? this._cosineEvaluator : (this._cosineEvaluator = new NormalizedCosineTransition());
    return undefined;
  }
}

export class NormalizedClothoidTransition extends NormalizedTransition {
  constructor() { super(); }
  /** At fractional position on the x axis, return the (normalized) curvature fraction. */
  public fractionToCurvatureFraction(fractionX: number): number { return fractionX; }
  /** Return the derivative of the (normalized) curvature fraction */
  public fractionToCurvatureFractionDerivative(_u: number): number { return 1.0; }
  /** Return the integrated area under the curve.
   * * This fraction is the angular change fraction.
   */
  public fractionToArea(fractionX: number): number {
    return fractionX * fractionX * 0.5;
  }
}

export class NormalizedBlossTransition extends NormalizedTransition {
  // bloss curve is (3 - 2x) x ^2 = 3 x^2 - 2 x^3
  //    derivative    6x (1-x)
  //   2nd derivative 6 - 12 x
  //     derivatives zero at 0,1
  //     inflection zero at 0.5
  //   integral is   x^3 - x^4 / 2 = x^3 ( 1-x/2)
  constructor() { super(); }
  /** At fractional position on the x axis, return the (normalized) curvature fraction. */
  public fractionToCurvatureFraction(u: number): number { return u * u * (3 - 2 * u); }
  /** Return the derivative of the (normalized) curvature fraction */
  public fractionToCurvatureFractionDerivative(u: number): number {
    return 6.0 * u * (1.0 - u);
  }
  /** Return the integrated area under the curve.
   * * This fraction is the angular change fraction.
   */
  public fractionToArea(u: number): number {
    return u * u * u * (1 - 0.5 * u);
  }
}
/**
 * * For [u <= 0.5, u >= 0.5]
 *   * f(u) = [2 u^2, 1 - 2 (1-u)^2]
 *   * f'(u) = [4 u, 4 (1-u)]
 *   * If(u) = [2 u^3 / 3, 0.5 (1 -u )^3/3]
 */
export class NormalizedBiQuadraticTransition extends NormalizedTransition {
  constructor() { super(); }
  private integratedBasis(u: number): number { return u * u * u * (2.0 / 3.0); }
  private basis(u: number): number { return 2 * u * u; }
  private basisDerivative(u: number): number { return 4 * u; }
  /** At fractional position on the x axis, return the (normalized) curvature fraction. */
  public fractionToCurvatureFraction(u: number): number {
    return u <= 0.5 ? this.basis(u) : 1.0 - this.basis(1.0 - u);
  }
  /** Return the derivative of the (normalized) curvature fraction */
  public fractionToCurvatureFractionDerivative(u: number): number {
    return u < 0.5 ? this.basisDerivative(u) : this.basisDerivative(1 - u);
  }
  /** Return the integrated area under the curve.
   * * This fraction is the angular change fraction.
   */
  public fractionToArea(u: number): number {
    if (u <= 0.5)
      return this.integratedBasis(u);
    const v = 1 - u;
    return 0.5 - v + this.integratedBasis(v);
  }
}
/**
 * curvature (itself) is a full period of a sine wave height from a straight line.
 */
export class NormalizedSineTransition extends NormalizedTransition {
  constructor() { super(); }
  /** At fractional position on the x axis, return the (normalized) curvature fraction. */
  public fractionToCurvatureFraction(u: number): number {
    const a = 2.0 * Math.PI;
    return u - Math.sin(u * a) / a;
  }
  /** Return the derivative of the (normalized) curvature fraction */
  public fractionToCurvatureFractionDerivative(u: number): number {
    const a = 2.0 * Math.PI;
    return 1 - Math.cos(u * a);
  }
  /** Return the integrated area under the curve.
   * * This fraction is the angular change fraction.
   */
  public fractionToArea(u: number): number {
    const a = 2.0 * Math.PI;
    return 0.5 * u * u + (Math.cos(u * a) - 1.0) / (a * a);
  }
}
/**
 * curvature (itself) is a half period of a cosine wave.
 */
export class NormalizedCosineTransition extends NormalizedTransition {
  constructor() { super(); }
  /** At fractional position on the x axis, return the (normalized) curvature fraction. */
  public fractionToCurvatureFraction(u: number): number {
    const a = Math.PI;
    return 0.5 * (1 - Math.cos(u * a));
  }
  /** Return the derivative of the (normalized) curvature fraction */
  public fractionToCurvatureFractionDerivative(u: number): number {
    const a = Math.PI;
    return 0.5 * a * Math.sin(u * a);
  }
  /** Return the integrated area under the curve.
   * * This fraction is the angular change fraction.
   */
  public fractionToArea(u: number): number {
    const a = Math.PI;
    return 0.5 * u - 0.5 * Math.sin(u * a) / a;
  }
}
