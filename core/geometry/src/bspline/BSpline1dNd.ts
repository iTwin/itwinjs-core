/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { Geometry } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { BSplineWrapMode, KnotVector } from "./KnotVector";

/**
 * Knots and poles for a B-spline function mapping R to R^n.
 * * The "pole" (aka control point) of this class is a block of `poleLength` numbers.
 * * Derived classes (not this class) assign meaning such as x,y,z,w.
 * * For instance, an instance of this class with `poleLength===3` does not know if its poles are x,y,z or
 * weighted 2D x,y,w.
 * @public
 */
export class BSpline1dNd {
  /** Knots of the bspline. */
  public knots: KnotVector;
  /** Poles packed in blocks of `poleLength` doubles. */
  public packedData: Float64Array;
  /** The number of numeric values per pole. */
  public poleLength: number;
  /** (property accessor) Return the degree of the polynomials. */
  public get degree(): number {
    return this.knots.degree;
  }
  /** (property accessor) Return the order (one more than degree) of the polynomials. */
  public get order(): number {
    return this.knots.degree + 1;
  }
  /** (property accessor) Return the number of bezier spans (including null spans at multiple knots). */
  public get numSpan(): number {
    return this.numPoles - this.knots.degree;
  }
  /** (property accessor) Return the number of poles. */
  public get numPoles(): number {
    return this.packedData.length / this.poleLength;
  }
  /**
   * Copy 3 values of pole `i` into a point.
   * * The calling class is responsible for knowing if this is an appropriate access to the blocked data.
   */
  public getPoint3dPole(i: number, result?: Point3d): Point3d | undefined {
    return Point3d.createFromPacked(this.packedData, i, result);
  }
  /**
   * Values of the `order` relevant B-spline basis functions at a parameter.
   * * Preallocated to length `order` in the constructor and used as a temporary in evaluations.
   */
  public basisBuffer: Float64Array;
  /**
   * Derivatives of the `order` relevant B-spline basis functions at a parameter.
   * * Preallocated to length `order` in the constructor and used as a temporary in evaluations.
   */
  public basisBuffer1: Float64Array;
  /**
   * Second derivatives of the `order` relevant B-spline basis functions at a parameter.
   * * Preallocated to length `order` in the constructor and used as a temporary in evaluations.
   */
  public basisBuffer2: Float64Array;
  /**
   * Temporary to hold a single point.
   * * Preallocated to length `poleLength` in the constructor.
   */
  public poleBuffer: Float64Array;
  /**
   * Temporary to hold a single derivative vector.
   * * Preallocated to length `poleLength` in the constructor.
   */
  public poleBuffer1: Float64Array;
  /**
   * Temporary to hold a single second derivative vector.
   * * Preallocated to length `poleLength` in the constructor.
   */
  public poleBuffer2: Float64Array;
  /**
   * Initialize arrays for given spline dimensions.
   * @param numPoles number of poles.
   * @param poleLength number of coordinates per pole (e.g.. 3 for 3D unweighted, 4 for 3d weighted, 2 for 2d unweighted,
   * 3 for 2d weighted).
   * @param order number of poles defining a Bezier segment of the B-spline function.
   * @param knots the KnotVector. This is captured, not cloned.
   */
  protected constructor(numPoles: number, poleLength: number, order: number, knots: KnotVector) {
    this.knots = knots;
    this.packedData = new Float64Array(numPoles * poleLength);
    this.poleLength = poleLength;
    this.basisBuffer = new Float64Array(order);
    this.basisBuffer1 = new Float64Array(order);
    this.basisBuffer2 = new Float64Array(order);
    this.poleBuffer = new Float64Array(poleLength);
    this.poleBuffer1 = new Float64Array(poleLength);
    this.poleBuffer2 = new Float64Array(poleLength);
  }
  /**
   * Create a `BSpline1dNd`.
   * @param numPoles number of poles.
   * @param poleLength number of coordinates per pole (e.g.. 3 for 3D unweighted, 4 for 3d weighted, 2 for 2d unweighted,
   * 3 for 2d weighted).
   * @param order number of poles defining a Bezier segment of the B-spline function.
   * @param knots the KnotVector. This is captured, not cloned.
   */
  public static create(numPoles: number, poleLength: number, order: number, knots: KnotVector): BSpline1dNd {
    return new BSpline1dNd(numPoles, poleLength, order, knots);
  }
  /** Map a span index and span fraction to knot value. */
  public spanFractionToKnot(spanIndex: number, spanFraction: number): number {
    return this.knots.spanFractionToKnot(spanIndex, spanFraction);
  }
  /**
   * Evaluate the `order` basis functions (and optionally one or two derivatives) at a given fractional position within
   * indexed span.
   * @returns true if and only if output arrays are sufficiently sized.
  */
  public evaluateBasisFunctionsInSpan(
    spanIndex: number, spanFraction: number, f: Float64Array, df?: Float64Array, ddf?: Float64Array,
  ): boolean {
    if (spanIndex < 0)
      spanIndex = 0;
    if (spanIndex >= this.numSpan)
      spanIndex = this.numSpan - 1;
    const knotIndex0 = spanIndex + this.degree - 1;
    const globalKnot = this.knots.baseKnotFractionToKnot(knotIndex0, spanFraction);
    return df ?
      this.knots.evaluateBasisFunctions1(knotIndex0, globalKnot, f, df, ddf) :
      this.knots.evaluateBasisFunctions(knotIndex0, globalKnot, f);
  }
  /**
   * Compute the linear combination of the given span's poles and the weights in `basisBuffer`, and store this point
   * in `poleBuffer`.
   */
  public sumPoleBufferForSpan(spanIndex: number) {
    this.poleBuffer.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer)
      for (let j = 0; j < this.poleLength; j++)
        this.poleBuffer[j] += f * this.packedData[k++];
  }
  /**
   * Compute the linear combination of the given span's poles and the weights in `basisBuffer1`, and store this
   * derivative vector in `poleBuffer1`.
   */
  public sumPoleBuffer1ForSpan(spanIndex: number) {
    this.poleBuffer1.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer1)
      for (let j = 0; j < this.poleLength; j++)
        this.poleBuffer1[j] += f * this.packedData[k++];
  }
  /**
   * Compute the linear combination of the given span's poles and the weights in `basisBuffer2`, and store this
   * second derivative vector in `poleBuffer2`.
   */
  public sumPoleBuffer2ForSpan(spanIndex: number) {
    this.poleBuffer2.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer2) {
      for (let j = 0; j < this.poleLength; j++)
        this.poleBuffer2[j] += f * this.packedData[k++];
    }
  }
  /**
   * * Evaluate the basis functions at spanIndex and fraction.
   *   * Evaluations are stored in the preallocated `this.basisBuffer`.
   * * Immediately do the summations of the basis values times the respective poles.
   *   * Summations are stored in the preallocated `this.poleBuffer`
   * */
  public evaluateBuffersInSpan(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer);
    this.sumPoleBufferForSpan(spanIndex);
  }
  /**
   * * Evaluate the basis functions and one derivative at spanIndex and fraction.
   *   * Function evaluations are stored in the preallocated `this.basisBuffer`; derivative evaluations in `this.basisBuffer1`.
   * * Immediately do the summations of the basis values times the respective poles.
   *   * Summations are stored in the preallocated `this.poleBuffer` and `this.poleBuffer1`
   * */
  public evaluateBuffersInSpan1(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer, this.basisBuffer1);
    this.sumPoleBufferForSpan(spanIndex);
    this.sumPoleBuffer1ForSpan(spanIndex);
  }
  /**
   * Evaluate the B-spline function and optional derivatives at the given parameter in knot space.
   * * Function value is stored in `poleBuffer`; optional derivative vectors in `poleBuffer1` and `poleBuffer2`.
   */
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
  /** Reverse the instance poles and knots in place. */
  public reverseInPlace(): void {
    const pLen = this.poleLength;
    const data = this.packedData;
    for (let i0 = 0, j0 = pLen * (this.numPoles - 1); i0 < j0; i0 += pLen, j0 -= pLen) {
      for (let i = 0; i < pLen; i++)
        [data[i0 + i], data[j0 + i]] = [data[j0 + i], data[i0 + i]];
    }
    this.knots.reflectKnots();
  }
  /**
   * Test if the leading and trailing polygon coordinates are replicated in the manner of a "closed" bspline polygon
   * which has been expanded to act as a normal bspline.
   * @returns true if `degree` leading and trailing polygon blocks match.
   * @deprecated in 4.x. Use `testClosablePolygon` instead.
   */
  public testCloseablePolygon(mode?: BSplineWrapMode): boolean {
    return this.testClosablePolygon(mode);
  }
  /**
   * Test if the leading and trailing poles are replicated in the manner of a "closed" B-spline function with wraparound
   * control polygon.
   * @param mode wrap mode, indicating the number of wraparound poles to check. If undefined, `knots.wrappable` is used.
   * @returns true if the expected leading and trailing poles match, according to `mode`.
   */
  public testClosablePolygon(mode?: BSplineWrapMode): boolean {
    if (mode === undefined)
      mode = this.knots.wrappable;
    let numPolesToTest = 0;
    if (mode === BSplineWrapMode.OpenByAddingControlPoints)
      numPolesToTest = this.degree;
    else if (mode === BSplineWrapMode.OpenByRemovingKnots)
      numPolesToTest = 1;
    else
      return false;
    // check for wraparound poles
    const blockSize = this.poleLength;
    const indexDelta = (this.numPoles - numPolesToTest) * blockSize;
    const numValuesToTest = numPolesToTest * blockSize;
    for (let i0 = 0; i0 < numValuesToTest; i0++) {
      if (!Geometry.isSameCoordinate(this.packedData[i0], this.packedData[i0 + indexDelta]))
        return false;
    }
    return true;
  }
  /**
   * Insert the knot and resulting pole into the instance, optionally multiple times.
   * @param knot the knot to be inserted (may already exist in the KnotVector).
   * @param totalMultiplicity the total multiplicity of the knot on return.
   */
  public addKnot(knot: number, totalMultiplicity: number): boolean {
    if (knot < this.knots.leftKnot || knot > this.knots.rightKnot)
      return false; // invalid input
    let iLeftKnot = this.knots.knotToLeftKnotIndex(knot);
    // snap input if too close to an existing knot
    if (Math.abs(knot - this.knots.knots[iLeftKnot]) < KnotVector.knotTolerance) {
      knot = this.knots.knots[iLeftKnot]; // snap to left knot of bracket
    } else if (Math.abs(knot - this.knots.knots[iLeftKnot + 1]) < KnotVector.knotTolerance) {
      iLeftKnot += this.knots.getKnotMultiplicityAtIndex(iLeftKnot + 1);
      if (iLeftKnot > this.knots.rightKnotIndex)
        return true; // nothing to do
      knot = this.knots.knots[iLeftKnot]; // snap to left knot of next bracket
    }
    const numKnotsToAdd = Math.min(totalMultiplicity, this.degree) - this.knots.getKnotMultiplicity(knot);
    if (numKnotsToAdd <= 0)
      return true; // nothing to do
    // working arrays and pole buffer
    let currKnotCount = this.knots.knots.length;
    const newKnots = new Float64Array(currKnotCount + numKnotsToAdd);
    for (let i = 0; i < currKnotCount; ++i)
      newKnots[i] = this.knots.knots[i];
    let currPoleCount = this.numPoles;
    const newPackedData = new Float64Array(this.packedData.length + (numKnotsToAdd * this.poleLength));
    for (let i = 0; i < this.packedData.length; ++i)
      newPackedData[i] = this.packedData[i];
    const dataBuf = new Float64Array(this.degree * this.poleLength);  // holds degree poles
    // each iteration adds one knot and one pole to the working arrays (cf. Farin 4e)
    for (let iter = 0; iter < numKnotsToAdd; ++iter) {
      // fill the buffer with new poles obtained from control polygon corner cutting
      let iBuf = 0;
      const iStart = iLeftKnot - this.degree + 2;
      for (let i = iStart; i < iStart + this.degree; ++i) {
        const fraction = (knot - newKnots[i - 1]) / (newKnots[i + this.degree - 1] - newKnots[i - 1]);
        for (let j = i * this.poleLength; j < (i + 1) * this.poleLength; ++j) {
          dataBuf[iBuf++] = Geometry.interpolate(newPackedData[j - this.poleLength], fraction, newPackedData[j]);
        }
      }
      // overwrite degree-1 poles with degree new poles, shifting tail to the right by one
      newPackedData.copyWithin((iStart + this.degree) * this.poleLength, (iStart + this.degree - 1) * this.poleLength, currPoleCount * this.poleLength);
      let iData = iStart * this.poleLength;
      for (const d of dataBuf)
        newPackedData[iData++] = d; // overwrite degree new poles
      // add the knot to newKnots in position, shifting tail to the right by one
      newKnots.copyWithin(iLeftKnot + 2, iLeftKnot + 1, currKnotCount);
      newKnots[iLeftKnot + 1] = knot;
      ++iLeftKnot;
      ++currKnotCount;
      ++currPoleCount;
    }
    this.knots.setKnotsCapture(newKnots);
    this.packedData = newPackedData;
    return true;
  }
}
