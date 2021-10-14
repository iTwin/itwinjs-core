/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

// import { Point2d } from "../Geometry2d";
import { Geometry } from "../Geometry";
/* eslint-disable @typescript-eslint/naming-convention, no-empty */
import { Point3d } from "../geometry3d/Point3dVector3d";
import { BSplineWrapMode, KnotVector } from "./KnotVector";

/** Bspline knots and poles for 1d-to-Nd.
 * * The "pole" (aka control point) of this class is a block of `poleLength` numbers.
 * * Derived classes (not this class) assign meaning such as x,y,z,w.
 * * for instance, an instance of this class with `poleLength===3` does not know if its poles are x,y,z or weighed 2D x,y,w
 * @public
 */
export class BSpline1dNd {
  /** knots of the bspline */
  public knots: KnotVector;
  /** poles, packed in blocks of `poleLength` doubles. */
  public packedData: Float64Array;
  /** (property accessor) Return the number of numeric values per pole. */
  public poleLength: number;
  /** (property accessor) Return the degree of the polynomials. */
  public get degree(): number { return this.knots.degree; }
  /** (property accessor) Return the number of order (one more than degree) of the polynomials */
  public get order(): number { return this.knots.degree + 1; }
  /** (property accessor) Return the number of bezier spans (including null spans at multiple knots)*/
  public get numSpan(): number { return this.numPoles - this.knots.degree; }
  /** (property accessor)  Return the number of poles*/
  public get numPoles(): number { return this.packedData.length / this.poleLength; }
  /** copy 3 values of pole `i` into a point.
   * * The calling clas sis responsible for knowing if this is an appropriate access to the blocked data.
   */
  public getPoint3dPole(i: number, result?: Point3d): Point3d | undefined { return Point3d.createFromPacked(this.packedData, i, result); }
  /** preallocated array (length === `order`) used as temporary in evaluations */
  public basisBuffer: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  /** preallocated array (length === `poleLength`) used as temporary in evaluations */
  public poleBuffer: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  /** preallocated array (length === `order`) used as temporary in evaluations */
  public basisBuffer1: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  /** preallocated array (length === `order`) used as temporary in evaluations */
  public basisBuffer2: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  /** preallocated array (length === `poleLength`) used as temporary in evaluations */
  public poleBuffer1: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  /** preallocated array (length === `poleLength`) used as temporary in evaluations */
  public poleBuffer2: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE

  /**
   * initialize arrays for given spline dimensions.
   * @param numPoles number of poles
   * @param poleLength number of coordinates per pole (e.g.. 3 for 3D unweighted, 4 for 3d weighted, 2 for 2d unweighted, 3 for 2d weighted)
   * @param order number of poles in support for a section of the bspline
   * @param knots KnotVector.  This is captured, not cloned.
   */
  protected constructor(numPoles: number, poleLength: number, order: number, knots: KnotVector) {
    this.knots = knots;
    this.packedData = new Float64Array(numPoles * poleLength);
    this.poleLength = poleLength;
    this.basisBuffer = new Float64Array(order);
    this.poleBuffer = new Float64Array(poleLength);
    this.basisBuffer1 = new Float64Array(order);
    this.basisBuffer2 = new Float64Array(order);
    this.poleBuffer1 = new Float64Array(poleLength);
    this.poleBuffer2 = new Float64Array(poleLength);
  }

  /**
   * create a 1Bspline1dNd`
   * @param numPoles number of poles
   * @param poleLength number of coordinates per pole (e.g.. 3 for 3D unweighted, 4 for 3d weighted, 2 for 2d unweighted, 3 for 2d weighted)
   * @param order number of poles in support for a section of the bspline
   * @param knots KnotVector.  This is captured, not cloned.
   */
  public static create(numPoles: number, poleLength: number, order: number, knots: KnotVector): BSpline1dNd | undefined {
    return new BSpline1dNd(numPoles, poleLength, order, knots);
  }
  /** Map a span index and local fraction to knot value. */
  public spanFractionToKnot(span: number, localFraction: number): number {
    return this.knots.spanFractionToKnot(span, localFraction);
  }

  /** Evaluate the `order` basis functions (and optionally one or two derivatives) at a given fractional position within indexed span. */
  public evaluateBasisFunctionsInSpan(spanIndex: number, spanFraction: number, f: Float64Array, df?: Float64Array, ddf?: Float64Array) {
    if (spanIndex < 0) spanIndex = 0;
    if (spanIndex >= this.numSpan) spanIndex = this.numSpan - 1;
    const knotIndex0 = spanIndex + this.degree - 1;
    const globalKnot = this.knots.baseKnotFractionToKnot(knotIndex0, spanFraction);
    return df ?
      this.knots.evaluateBasisFunctions1(knotIndex0, globalKnot, f, df, ddf) :
      this.knots.evaluateBasisFunctions(knotIndex0, globalKnot, f);
  }
  /**
   * * Evaluate the basis functions at spanIndex and fraction.
   *   * Evaluations are stored in the preallocated `this.basisBuffer`
   * * Immediately do the summations of the basis values times the respective control points
   *   * Summations are stored in the preallocated `this.poleBuffer`
   * */
  public evaluateBuffersInSpan(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer);
    this.sumPoleBufferForSpan(spanIndex);
  }
  /**
   * * Evaluate the basis functions and one derivative at spanIndex and fraction.
   *   * Evaluations are stored in the preallocated `this.basisBuffer`
   * * Immediately do the summations of the basis values times the respective control points
   *   * Summations are stored in the preallocated `this.poleBuffer` and `this.poleBuffer`
   * */
  public evaluateBuffersInSpan1(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer, this.basisBuffer1);
    this.sumPoleBufferForSpan(spanIndex);
    this.sumPoleBuffer1ForSpan(spanIndex);
  }
  /** sum poles at span `spanIndex` by the weights in the `poleBuffer` */
  public sumPoleBufferForSpan(spanIndex: number) {
    this.poleBuffer.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer) {
      for (let j = 0; j < this.poleLength; j++) { this.poleBuffer[j] += f * this.packedData[k++]; }
    }
  }
  /** sum poles at span `spanIndex` by the weights in the `poleBuffer1`, i.e. form first derivatives */
  public sumPoleBuffer1ForSpan(spanIndex: number) {
    this.poleBuffer1.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer1) {
      for (let j = 0; j < this.poleLength; j++) {
        this.poleBuffer1[j] += f * this.packedData[k++];
      }
    }
  }
  /** sum poles at span `spanIndex` by the weights in the `poleBuffer2`, i.e. form second derivatives */
  public sumPoleBuffer2ForSpan(spanIndex: number) {
    this.poleBuffer2.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer2) {
      for (let j = 0; j < this.poleLength; j++) {
        this.poleBuffer2[j] += f * this.packedData[k++];
      }
    }
  }
  /** Evaluate the function values and 1 or 2 derivatives into `this.poleBuffer`, `this.poleBuffer1` and `this.poleBuffer2` */
  public evaluateBuffersAtKnot(u: number, numDerivative: number = 0) {
    const knotIndex0 = this.knots.knotToLeftKnotIndex(u);
    if (numDerivative < 1) {
      this.knots.evaluateBasisFunctions(knotIndex0, u, this.basisBuffer);
      this.sumPoleBufferForSpan(knotIndex0 - this.degree + 1);
    } else if (numDerivative === 1) {
      this.knots.evaluateBasisFunctions1(knotIndex0, u, this.basisBuffer, this.basisBuffer1);
      this.sumPoleBufferForSpan(knotIndex0 - this.degree + 1);
      this.sumPoleBuffer1ForSpan(knotIndex0 - this.degree + 1);
    } else {
      this.knots.evaluateBasisFunctions1(knotIndex0, u, this.basisBuffer, this.basisBuffer1, this.basisBuffer2);
      this.sumPoleBufferForSpan(knotIndex0 - this.degree + 1);
      this.sumPoleBuffer1ForSpan(knotIndex0 - this.degree + 1);
      this.sumPoleBuffer2ForSpan(knotIndex0 - this.degree + 1);
    }
  }
  /**
   * Reverse the (blocked) poles (in `this.packedData` in place.
   */
  public reverseInPlace(): void {
    // reverse poles in blocks ...
    const b = this.poleLength;
    const data = this.packedData;
    for (let i0 = 0, j0 = b * (this.numPoles - 1);
      i0 < j0;
      i0 += b, j0 -= b) {
      let t = 0;
      for (let i = 0; i < b; i++) {
        t = data[i0 + i];
        data[i0 + i] = data[j0 + i];
        data[j0 + i] = t;
      }
    }
    this.knots.reflectKnots();
  }
  /**
   * Test if the leading and trailing polygon coordinates are replicated in the manner of a "closed" bspline polygon which has been expanded
   * to act as a normal bspline.
   * @returns true if `degree` leading and trailing polygon blocks match
   */
  public testCloseablePolygon(mode?: BSplineWrapMode): boolean {
    if (mode === undefined)
      mode = this.knots.wrappable;
    const degree = this.degree;
    const blockSize = this.poleLength;
    const indexDelta = (this.numPoles - this.degree) * blockSize;
    const data = this.packedData;
    if (mode === BSplineWrapMode.OpenByAddingControlPoints) {
      // expect {degree} matched points.
      const numValuesToTest = degree * blockSize;
      for (let i0 = 0; i0 < numValuesToTest; i0++) {
        if (!Geometry.isSameCoordinate(data[i0], data[i0 + indexDelta]))
          return false;
      }
      return true;
    }

    if (mode === BSplineWrapMode.OpenByRemovingKnots) {
      // no pole conditions are applied.
      return true;
    }

    return false;
  }
}
