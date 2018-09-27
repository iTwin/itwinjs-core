/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d } from "../PointVector";
import { KnotVector } from "./KnotVector";

/** Bspline knots and poles for 1d-to-Nd. */
export class BSpline1dNd {
  public knots: KnotVector;
  public packedData: Float64Array;
  public poleLength: number;
  public get degree(): number { return this.knots.degree; }
  public get order(): number { return this.knots.degree + 1; }
  public get numSpan(): number { return this.numPoles - this.knots.degree; }
  public get numPoles(): number { return this.packedData.length / this.poleLength; }
  public getPoint3dPole(i: number, result?: Point3d): Point3d | undefined { return Point3d.createFromPacked(this.packedData, i, result); }

  public basisBuffer: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  public poleBuffer: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  public basisBuffer1: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  public basisBuffer2: Float64Array; // one set of basis function values.   ALLOCATED BY CTOR FOR FREQUENT REUSE
  public poleBuffer1: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE
  public poleBuffer2: Float64Array; // one set of target values.  ALLOCATED BY CTOR FOR FREQUENT REUSE

  /**
   * initialize arrays for given spline dimensions.
   * @param numPoles number of poles
   * @param poleLength number of coordinates per pole (e.g.. 3 for 3D unweighted, 4 for 3d weighted, 2 for 2d unweighted, 3 for 2d weigthed)
   * @param order number of poles in support for a section of the bspline
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

  public static create(numPoles: number, poleLength: number, order: number, knots: KnotVector): BSpline1dNd | undefined {
    return new BSpline1dNd(numPoles, poleLength, order, knots);
  }
  public spanFractionToKnot(span: number, localFraction: number): number {
    return this.knots.spanFractionToKnot(span, localFraction);
  }

  // ASSUME f is sized for {order} basis funtions !!!
  public evaluateBasisFunctionsInSpan(spanIndex: number, spanFraction: number, f: Float64Array, df?: Float64Array, ddf?: Float64Array) {
    if (spanIndex < 0) spanIndex = 0;
    if (spanIndex >= this.numSpan) spanIndex = this.numSpan - 1;
    const knotIndex0 = spanIndex + this.degree - 1;
    const globalKnot = this.knots.baseKnotFractionToKnot(knotIndex0, spanFraction);
    return df ?
      this.knots.evaluateBasisFunctions1(knotIndex0, globalKnot, f, df, ddf) :
      this.knots.evaluateBasisFunctions(knotIndex0, globalKnot, f);
  }
  public evaluateBuffersInSpan(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer);
    this.sumPoleBufferForSpan(spanIndex);
  }
  public evaluateBuffersInSpan1(spanIndex: number, spanFraction: number) {
    this.evaluateBasisFunctionsInSpan(spanIndex, spanFraction, this.basisBuffer, this.basisBuffer1);
    this.sumPoleBufferForSpan(spanIndex);
    this.sumPoleBuffer1ForSpan(spanIndex);
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBufferForSpan(spanIndex: number) {
    this.poleBuffer.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer) {
      for (let j = 0; j < this.poleLength; j++) { this.poleBuffer[j] += f * this.packedData[k++]; }
    }
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBuffer1ForSpan(spanIndex: number) {
    this.poleBuffer1.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer1) {
      for (let j = 0; j < this.poleLength; j++) {
        this.poleBuffer1[j] += f * this.packedData[k++];
      }
    }
  }
  /** sum poles by the weights in the basisBuffer, using poles for given span */
  public sumPoleBuffer2ForSpan(spanIndex: number) {
    this.poleBuffer2.fill(0);
    let k = spanIndex * this.poleLength;
    for (const f of this.basisBuffer2) {
      for (let j = 0; j < this.poleLength; j++) {
        this.poleBuffer2[j] += f * this.packedData[k++];
      }
    }
  }
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
}
