/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { XYCurveEvaluator } from "./XYCurveEvaluator";
import { SimpleNewton } from "../../numerics/Newton";
/**
 * Methods to evaluate caller-specified number of terms of the x and y series for a clothoid.
 * Each instance has
 * * Number of x and y terms to use.
 * * constant for theta=c * x * x
 *    * This value is c=1/(2 R L)  for curve length L measured from inflection to point with radius R.
 * @internal
 */
export class ClothoidSeriesRLEvaluator extends XYCurveEvaluator {
  public numXTerms: number;
  public numYTerms: number;
  public constantDiv2LR: number;
  public nominalLength1: number;
  public constructor(nominalLength1: number, constantDiv2LR: number, numXTerms: number = 4, numYTerms: number = 4) {
    super();
    this.nominalLength1 = nominalLength1;
    this.constantDiv2LR = constantDiv2LR;
    this.numXTerms = numXTerms;
    this.numYTerms = numYTerms;
  }
  /** Return a deep clone. */
  public clone(): ClothoidSeriesRLEvaluator {
    return new ClothoidSeriesRLEvaluator(this.nominalLength1, this.constantDiv2LR, this.numXTerms, this.numYTerms);
  }
  public scaleInPlace(scaleFactor: number) {
    this.nominalLength1 *= scaleFactor;
    this.constantDiv2LR /= (scaleFactor * scaleFactor);
  }
  /** Member by member matchup ... */
  public isAlmostEqual(other: any): boolean {
    if (other instanceof ClothoidSeriesRLEvaluator) {
      return this.numXTerms === other.numXTerms
        && this.numYTerms === other.numYTerms
        && Geometry.isAlmostEqualNumber(this.constantDiv2LR, other.constantDiv2LR)
        && Geometry.isSameCoordinate(this.nominalLength1, other.nominalLength1);
    }
    return false;
  }
  /**
   * Evaluate the X series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   */
  public fractionToX(fraction: number): number { return this.fractionToXGo(fraction, this.numXTerms); }
  /**
   * Evaluate the Y series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   */
  public fractionToY(fraction: number): number { return this.fractionToYGo(fraction, this.numYTerms); }

  /**
   * Evaluate the derivative of the X series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   */
  public fractionToDX(fraction: number): number { return this.fractionToDXGo(fraction, this.numXTerms); }
  /**
   * Evaluate the derivative of the Y series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   */
  public fractionToDY(fraction: number): number { return this.fractionToDYGo(fraction, this.numYTerms); }

  /**
   * Evaluate the derivative of the X series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   */
  public fractionToDDX(fraction: number): number { return this.fractionToDDXGo(fraction, this.numXTerms); }
  /**
   * Evaluate the derivative of the Y series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   */
  public fractionToDDY(fraction: number): number { return this.fractionToDDYGo(fraction, this.numYTerms); }

  /**
   * Evaluate the X series at a nominal distance along the curve.
   * @param fraction fractional position along the curve.
   * @param numTerms number of terms to use.
   */
  public fractionToXGo(fraction: number, numTerms: number): number {
    // Write the series for cos (theta)
    // replace theta by s*s*c
    // integrate wrt s
    //  x = s - s^5 c^4/ 2 + s^9 c^8/(4!) - s^13 c^12 / 6!
    //  x = s(1 - (s^4 c^2/2) ( 1/5 -s^4 c^2 / (3*4)  ( 1/9 - ....) ) )
    const s = fraction * this.nominalLength1;
    let result = s;
    if (numTerms < 2)
      return result;
    const q1 = s * s * this.constantDiv2LR;
    const beta = - q1 * q1;
    let alpha = s;
    let m = 1;
    let n = 5;
    for (let i = 1; i < numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha / n;
      m += 2;
      n += 4;
    }
    return result;
  }
  public fractionToYGo(fraction: number, numTerms: number): number {
    // Write the series for sin (theta)
    // replace theta by s*s*c
    // integrate wrt s
    //  x = s^3 c^2/ 3( (1/3)) - s^7 c^6/(3!) ((1/7)) - s^11 c^10 / 5! ((1/9) - ...)
    const s = fraction * this.nominalLength1;
    const q1 = s * s * this.constantDiv2LR;
    let result = q1 * s / 3;
    if (numTerms < 2)
      return result;
    const beta = - q1 * q1;
    let alpha = q1 * s;
    let m = 2;
    let n = 7;
    for (let i = 1; i < numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha / n;
      m += 2;
      n += 4;
    }
    return result;
  }
  public fractionToDXGo(fraction: number, numTerms: number): number {
    // Yes -- this does happen during derivatives of cosines with more than 0 terms !!
    if (numTerms <= 0)
      return 0;
    // dX = 1 - s^4c^2/2 + s^8 c^4 / 4! -
    // new Term = old Term * beta / (m(m+1))
    const s = fraction * this.nominalLength1;
    let result = 1;
    if (numTerms < 2) {
      return result * this.nominalLength1;
    }
    const q1 = s * s * this.constantDiv2LR;
    const beta = - q1 * q1;
    let alpha = 1.0;
    let m = 1;
    for (let i = 1; i < numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha;
      m += 2;
    }
    return result * this.nominalLength1;
  }
  public fractionToDYGo(fraction: number, numTerms: number): number {
    if (numTerms <= 0)
      return 0;
    // dY = q - q^3/3!
    // q = s^2 c
    // dY = s^2 c - s^6 c^3/3! + s^10 c^5/ 5!
    // recurrence  advancing m by 2  alpha *= -(s^4 c^2) / (m(m+1))
    const s = fraction * this.nominalLength1;
    const q1 = s * s * this.constantDiv2LR;
    let result = q1;
    if (numTerms < 2)
      return result * this.nominalLength1;
    const beta = - q1 * q1;
    let alpha = q1;
    let m = 2;
    for (let i = 1; i < numTerms; i++) {
      alpha *= beta / (m * (m + 1));
      result += alpha;
      m += 2;
    }
    return result * this.nominalLength1;
  }

  public fractionToDDXGo(fraction: number, numTerms: number): number {
    // DX is "cosine"
    // DDX is "- sine" series times chain rule dTheta/ds = 2 * s * this.constantDivLR
    const s = fraction * this.nominalLength1;

    const dTheta = 2 * this.constantDiv2LR * s;
    const sine = this.fractionToDYGo(fraction, numTerms - 1);
    const resultA = (- dTheta * sine * this.nominalLength1);
    return resultA;
  }
  public fractionToDDYGo(fraction: number, numTerms: number): number {
    // DY is "sine"
    // DDY is "cosine" series times chain rule dTheta/ds = 2 * s * this.constantDivLR
    // BUT  .... derivative of the cosine series leading term is zero ... use one less term!
    const s = fraction * this.nominalLength1;
    const dTheta = 2 * this.constantDiv2LR * s;
    const cosine = this.fractionToDXGo(fraction, numTerms);
    return cosine * dTheta * this.nominalLength1;
  }

  public fractionToD3X(fraction: number): number {
    if (this.numXTerms <= 1)
      return 0.0;
    // DX is "cosine"
    // DDX is "- sine" series times chain rule dTheta/ds = 2 * s * this.constantDivLR
    const s = fraction * this.nominalLength1;
    const dTheta = 2.0 * this.constantDiv2LR * s;
    const d2Theta = 2.0 * this.constantDiv2LR;
    const sine = this.fractionToDYGo(fraction, this.numXTerms - 1);
    const cosine = this.fractionToDXGo(fraction, this.numXTerms - 1);
    return (- cosine * dTheta * dTheta - sine * d2Theta) * this.nominalLength1 * this.nominalLength1;
  }
  public fractionToD3Y(fraction: number): number {
    // DY is "sine"
    // DDY is "cosine" series times chain rule dTheta/ds = 2 * s * this.constantDivLR
    const s = fraction * this.nominalLength1;
    const dTheta = 2.0 * this.constantDiv2LR * s;
    const d2Theta = 2.0 * this.constantDiv2LR;
    // dY is sine series with numYTerms.
    // ddY is cosine series.  Leading term of sine series is non-constant, so numYTerms here also
    // d3Y is sine series. Derivative of preceding cosine killed first term.
    const cosine = this.fractionToDXGo(fraction, this.numYTerms);
    const sine = this.fractionToDYGo(fraction, this.numYTerms - 1);
    return (-sine * dTheta * dTheta + cosine * d2Theta) * this.nominalLength1 * this.nominalLength1;
  }

  public xToFraction(x: number): number | undefined {
    const fraction0 = x / this.nominalLength1;
    const fraction1 = SimpleNewton.runNewton1D(fraction0,
      (f: number) => (this.fractionToX(f) - x),
      (f: number) => this.fractionToDX(f));
    if (fraction1 === undefined)
      return undefined;
    return fraction1;
  }
}
