/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "../Geometry";

/** @packageDocumentation
 * @module Numerics
 */

/** Support class for quadrature -- approximate integrals by summing weighted function values.
 * These are filled with x and weight for quadrature between xA and xB
 *
 * Since quadrature is done in side tight loops, these methods are structured for minimum object
 * allocation.
 * For methods names setupGauss<N> (where N is a smallish integer), the CALLER creates arrays xMapped and wMapped
 * The method installs particular x and weight values.
 * @internal
 */
export class Quadrature {
  /** x value for 1 point gauss rule in 0..1 interval */
  public static readonly gaussX1Interval01 = new Float64Array([0.5]);
  /** weight for 1 point gauss rule in 0..1 interval */
  public static readonly gaussW1Interval01 = new Float64Array([1.0]);

  /** x value for 2 point gauss rule in 0..1 interval */
  public static readonly gaussX2Interval01 = new Float64Array([0.21132486540518708, 0.7886751345948129]);
  /** weight for 2 point gauss rule in 0..1 interval */
  public static readonly gaussW2Interval01 = new Float64Array([0.5, 0.5]);

  /** x value for 3 point gauss rule in 0..1 interval */
  public static readonly gaussX3Interval01 = new Float64Array([0.1127016653792583, 0.5, 0.8872983346207417]);
  /** weight for 3 point gauss rule in 0..1 interval */
  public static readonly gaussW3Interval01 = new Float64Array([0.2777777777777778, 0.4444444444444444, 0.2777777777777778]);

  /** x value for 4 point gauss rule in 0..1 interval */
  public static readonly gaussX4Interval01 = new Float64Array([0.06943184420297371, 0.33000947820757187, 0.6699905217924281, 0.9305681557970262]);
  /** weight for 4 point gauss rule in 0..1 interval */
  public static readonly gaussW4Interval01 = new Float64Array([0.17392742256872692, 0.3260725774312731, 0.3260725774312731, 0.17392742256872692]);

  /** x value for 5 point gauss rule in 0..1 interval */
  public static readonly gaussX5Interval01 = new Float64Array([0.04691007703066802, 0.23076534494715845, 0.5, 0.7692346550528415, 0.9530899229693319]);
  /** weight for 5 point gauss rule in 0..1 interval */
  public static readonly gaussW5Interval01 = new Float64Array([0.11846344252809454, 0.23931433524968324, 0.28444444444444444, 0.23931433524968324, 0.11846344252809454]);

  /**
   * Given points and weights in a reference interval (usually 0 to 1):
   *
   * * map each xRef[i] to xA + h * xRef[i];
   * * scale each weight wRef[i] to h * wRef[i]
   * * all arrays are assumed to have xRef.length entries.
   * * the return value is xRef.length
   * @param xA beginning of target interval
   * @param h length of target interval
   * @param xRef x coordinates in reference interval
   * @param wRef weights for integration in the reference interval
   * @param xMapped x coordinates to evaluate integrands
   * @param wMapped weights for evaluated integrands
   */
  public static mapWeights(xA: number, h: number, xRef: Float64Array, wRef: Float64Array, xMapped: Float64Array, wMapped: Float64Array): number {
    const n = xRef.length;
    for (let i = 0; i < n; i++) {
      xMapped[i] = xA + h * xRef[i];
      wMapped[i] = h * wRef[i];
    }
    return n;
  }

  /** Install 1 (ONE) x and weight values for quadrature from xA to xB. */
  public static setupGauss1(xA: number, xB: number, xMapped: Float64Array, wMapped: Float64Array): number {
    return Quadrature.mapWeights(xA, xB - xA, Quadrature.gaussX1Interval01, Quadrature.gaussW1Interval01, xMapped, wMapped);
  }

  /** Install 2 (TWO) x and weight values for quadrature from xA to xB. */
  public static setupGauss2(xA: number, xB: number, xMapped: Float64Array, wMapped: Float64Array): number {
    return Quadrature.mapWeights(xA, xB - xA, Quadrature.gaussX2Interval01, Quadrature.gaussW2Interval01, xMapped, wMapped);
    /*  // exact formulas for interval xA..xB:
        const x0 = 0.5 * (xA + xB);
            const h = 0.5 * (xB - xA);
            const dx = h / Math.sqrt(3);
            xMapped[0] = x0 - dx; xMapped[1] = x0 + dx;
            wMapped[0] = wMapped[1] = h;
            */
  }
  /** Install 3 (THREE) x and weight values for quadrature from xA to xB. */
  public static setupGauss3(xA: number, xB: number, xMapped: Float64Array, wMapped: Float64Array): number {
    return Quadrature.mapWeights(xA, xB - xA, Quadrature.gaussX3Interval01, Quadrature.gaussW3Interval01, xMapped, wMapped);
    /*  // exact formulas for interval xA..xB:
    const x0 = 0.5 * (xA + xB);
    const h = 0.5 * (xB - xA);
    const a = Math.sqrt(0.6);
    const b = h * 5.0 / 9.0;
    const dx = a * h;
    xMapped[0] = x0 - dx; xMapped[1] = x0; xMapped[2] = x0 + dx;
    wMapped[0] = wMapped[2] = b;
    wMapped[1] = h * 8.0 / 9.0;
    return 3;
    */
  }

  /** Install 5 (FIVE) x and weight values for quadrature from xA to xB. */
  public static setupGauss5(xA: number, xB: number, xMapped: Float64Array, wMapped: Float64Array): number {
    return Quadrature.mapWeights(xA, xB - xA, Quadrature.gaussX5Interval01, Quadrature.gaussW5Interval01, xMapped, wMapped);
    /*  // exact formulas for interval xA..xB:
    const x0 = 0.5 * (xA + xB);
    const h = 0.5 * (xB - xA);
    const q = 2.0 * Math.sqrt(10.0 / 7.0);
    const b = 13.0 * Math.sqrt(70.0);
    const a1 = h * Math.sqrt(5.0 - q) / 3.0;
    const a2 = h * Math.sqrt(5.0 + q) / 3.0;
    const w1 = h * (322.0 + b) / 900.0;
    const w2 = h * (322.0 - b) / 900;
    const w0 = h * 128.0 / 225.0;
    xMapped[0] = x0 - a2; xMapped[1] = x0 - a1; xMapped[2] = x0; xMapped[3] = x0 + a1; xMapped[4] = x0 + a2;
    wMapped[0] = w2; wMapped[1] = w1; wMapped[2] = w0; wMapped[3] = w1; wMapped[4] = w2;
    return 5;
    */
  }

  /** Install 4 (FOUR) x and weight values for quadrature from xA to xB. */
  public static setupGauss4(xA: number, xB: number, xMapped: Float64Array, wMapped: Float64Array): number {
    return Quadrature.mapWeights(xA, xB - xA, Quadrature.gaussX4Interval01, Quadrature.gaussW4Interval01, xMapped, wMapped);
    /*  // exact formulas for interval xA..xB:
const x0 = 0.5 * (xA + xB);
const h = 0.5 * (xB - xA);
const q = 2.0 * Math.sqrt(6.0 / 5.0);
const r = Math.sqrt(30.0);
const a1 = h * Math.sqrt((3 - q) / 7.0);
const w1 = h * (18.0 + r) / 36.0;
const a2 = h * Math.sqrt((3 + q) / 7.0);
const w2 = h * (18.0 - r) / 36.0;
xMapped[0] = x0 - a2; xMapped[1] = x0 - a1; xMapped[2] = x0 + a1; xMapped[3] = x0 + a2;
wMapped[0] = w2; wMapped[1] = w1; wMapped[2] = w1; wMapped[3] = w2;
return 4;
*/
  }
  /** Sum function values with given weights and x values. */
  public static sum1(
    xx: Float64Array,
    ww: Float64Array,
    n: number,
    f: (x: number) => number): number {
    let sum = 0;
    for (let i = 0; i < n; i++)sum += ww[i] * f(xx[i]);
    return sum;
  }
  /**
   * Do a Guass quadrature integral for a (number)=>number function over an interval, with caller specified sub-interval count and
   * @param x0 start of overall interval
   * @param x1 end of overall interval
   * @param f function to evaluate
   * @param numInterval number of internal intervals
   * @param numGauss number of gauss points.    must be supported by GaussMapper, i.e. 1,2,3,4,5
   */
  public static doGaussIntegral(x0: number, x1: number, f: (x: number) => number, numInterval: number, numGauss: number = 5) {
    const mapper = new GaussMapper(numGauss);
    if (numInterval < 1)
      numInterval = 1;
    const df = 1.0 / numInterval;
    let sum = 0;
    for (let i = 1; i <= numInterval; i++) {
      const xA = Geometry.interpolate(x0, (i - 1) * df, x1);
      const xB = i === numInterval ? x1 : Geometry.interpolate(x0, (i) * df, x1);
      const n = mapper.mapXAndW(xA, xB);
      for (let k = 0; k < n; k++) {
        sum += mapper.gaussW[k] * f(mapper.gaussX[k]);
      }
    }
    return sum;
  }
}

/**
 * This class carries public members as needed for users to have gauss points that are used
 * in the callers loops.
 * @internal
 */
export class GaussMapper {
  /** x values for integration */
  public gaussX: Float64Array;
  /** weights for integration */
  public gaussW: Float64Array;
  /** function to be called (at each interval) to map integration values */
  public mapXAndWFunction: (xA: number, xB: number, xx: Float64Array, ww: Float64Array) => number;
  /** Execute the mapXAndWFunction to set up arrays for integration from xA to xB */
  public mapXAndW(xA: number, xB: number): number {
    return this.mapXAndWFunction(xA, xB, this.gaussX, this.gaussW);
  }
  /** setup gauss arrays.
   * * Number of gauss points must be 1 to 5 (inclusive)
   * @param numGauss requested number of gauss points.
   */
  public constructor(numGaussPoints: number) {
    const maxGauss = 7;  // (As of Nov 2 2018, 7 is a fluffy over-allocation-- the quadrature class only handles up to 5.)
    this.gaussX = new Float64Array(maxGauss);
    this.gaussW = new Float64Array(maxGauss);
    // This sets the number of gauss points.  This integrates exactly for polynomials of (degree 2*numGauss - 1).
    if (numGaussPoints > 5 || numGaussPoints < 1)
      numGaussPoints = 5;
    switch (numGaussPoints) {
      case 1: this.mapXAndWFunction = Quadrature.setupGauss1; break;
      case 2: this.mapXAndWFunction = Quadrature.setupGauss2; break;
      case 3: this.mapXAndWFunction = Quadrature.setupGauss3; break;
      case 4: this.mapXAndWFunction = Quadrature.setupGauss4; break;
      default: this.mapXAndWFunction = Quadrature.setupGauss5; break;
    }

  }
}
// someday .... http://www.holoborodko.com/pavel/numerical-methods/numerical-integration/overlapped-newton-cotes-quadratures/
