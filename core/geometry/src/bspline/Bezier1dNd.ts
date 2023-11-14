/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { Geometry } from "../Geometry";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { Segment1d } from "../geometry3d/Segment1d";
import { Point4d } from "../geometry4d/Point4d";
import { BezierCoffs, UnivariateBezier } from "../numerics/BezierPolynomials";
import { KnotVector } from "./KnotVector";

/**
 * Shared implementation details for derived bezier curve classes
 * * BezierCurve3d implements with blockSize 3.
 * * BezierCurve3dH implements with blockSize 4.
 * @public
 */
export class Bezier1dNd {
  private _packedData: Float64Array;
  private _order: number; // bezier order.   probably low
  private _blockSize: number; // loosely expected to be 1 to 4.
  private _basis: BezierCoffs; // server for basis queries.  It carries coefficients that we don't use.
  // constructor CAPTURES the control points array.
  public constructor(blockSize: number, polygon: Float64Array) {
    this._blockSize = blockSize;
    this._order = Math.floor(polygon.length / blockSize); // This should be an integer!!!
    this._packedData = polygon;
    this._basis = new UnivariateBezier(this._order);
  }
  /**
   * Return a clone of the data array.
   * @param result optional destination array. If not the _same_ size as the data array, a new array is returned.
   */
  public clonePolygon(result?: Float64Array): Float64Array {
    const n = this._packedData.length;
    if (!result || result.length !== n)
      return this._packedData.slice();
    /** move data into the supplied result */
    for (let i = 0; i < n; i++)
      result[i] = this._packedData[i];
    return result;
  }
  /** Return the bezier order */
  public get order() { return this._order; }
  /** return the packed data array.  This is a REFERENCE to the array. */
  public get packedData() { return this._packedData; }
  /** Create a Bezier1dNd, using the structure of `data[0]` to determine the bezier order. */
  public static create(data: Point2d[] | Point3d[] | Point4d[]): Bezier1dNd | undefined {
    if (data.length < 1)
      return undefined;
    if (data[0] instanceof Point3d) {
      const polygon = new Float64Array(data.length * 3);
      let i = 0;
      for (const p of (data as Point3d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
      }
      return new Bezier1dNd(3, polygon);
    } else if (data[0] instanceof Point4d) {
      const polygon = new Float64Array(data.length * 4);
      let i = 0;
      for (const p of (data as Point4d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
        polygon[i++] = p.z;
        polygon[i++] = p.w;
      }
      return new Bezier1dNd(4, polygon);
    } else if (data[0] instanceof Point2d) {
      const polygon = new Float64Array(data.length * 2);
      let i = 0;
      for (const p of (data as Point2d[])) {
        polygon[i++] = p.x;
        polygon[i++] = p.y;
      }
      return new Bezier1dNd(2, polygon);
    }
    return undefined;
  }
  /**
   * Return the curve value at bezier fraction `s`.
   * @param s bezier parameter for evaluation
   * @param buffer optional destination of length `blockSize`. If insufficient length, a new array is returned.
   * @return buffer of length `blockSize`.
   */
  public evaluate(s: number, buffer?: Float64Array): Float64Array {
    return this._basis.sumBasisFunctions(s, this._packedData, this._blockSize, buffer);
  }
  /**
   * Return the curve derivative value at bezier fraction `s`.
   * @param s bezier parameter for evaluation
   * @param buffer optional destination of length `blockSize`. If insufficient length, a new array is returned.
   * @return buffer of length `blockSize`.
   */
  public evaluateDerivative(s: number, buffer?: Float64Array): Float64Array {
    return this._basis.sumBasisFunctionDerivatives(s, this._packedData, this._blockSize, buffer);
  }
  /**
   * Return a point of the polygon as a simple array.
   * @param i index of desired point
   * @param buffer optional destination of length `blockSize`. If insufficient length, a new array is returned.
   * @return point as simple array of length `blockSize`, or undefined if index out of range.
   */
  public getPolygonPoint(i: number, buffer?: Float64Array): Float64Array | undefined {
    if (!buffer || buffer.length < this._blockSize)
      buffer = new Float64Array(this._blockSize);
    if (i >= 0 && i < this._order) {
      const k0 = this._blockSize * i;
      for (let k = 0; k < this._blockSize; k++)
        buffer[k] = this._packedData[k0 + k];
      return buffer;
    }
    return undefined;
  }
  /** set a single point of the polygon as a simple array.  */
  public setPolygonPoint(i: number, buffer: Float64Array) {
    if (i >= 0 && i < this._order) {
      const k0 = this._blockSize * i;
      for (let k = 0; k < this._blockSize; k++)
        this._packedData[k0 + k] = buffer[k];
    }
  }
  /** Load order * dimension doubles from data[dimension * spanIndex] as poles
   * @param data packed source array.  block size in `data` assumed to match dimension for this.
   * @param spanIndex block index in data.
   */
  public loadSpanPoles(data: Float64Array, spanIndex: number) {
    let k = spanIndex * this._blockSize;
    for (let i = 0; i < this._packedData.length; i++)
      this._packedData[i] = data[k++];
  }
  /** Load order * (dataDimension + 1)  doubles from data[dataDimension * spanIndex] as poles with weight inserted
   * @param data packed array of data.
   * @param dataDimension dimension of data. Must have `dataDimension+1=this.order`
   * @param spanIndex index of first data block to access.
   * @param weight weight to append to each block
   */
  public loadSpanPolesWithWeight(data: Float64Array, dataDimension: number, spanIndex: number, weight: number) {
    let destIndex = 0;
    const order = this._order;
    let dataIndex = spanIndex * dataDimension;
    for (let i = 0; i < order; i++) {
      for (let j = 0; j < dataDimension; j++)
        this._packedData[destIndex++] = data[dataIndex++];
      this._packedData[destIndex++] = weight;
    }
  }
  /**  return a json array of arrays with each control point as a lower level array of numbers */
  public unpackToJsonArrays(): any[] {
    return Point3dArray.unpackNumbersToNestedArrays(this._packedData, this._blockSize);
  }
  /** equality test with usual metric tolerances */
  public isAlmostEqual(other: any): boolean {
    if (other instanceof Bezier1dNd) {
      if (this._blockSize !== other._blockSize)
        return false;
      if (this._order !== other._order)
        return false;
      if (this._packedData.length !== other._packedData.length)
        return false;
      for (let i = 0; i < this._packedData.length; i++) {
        if (!Geometry.isSameCoordinate(this._packedData[i], other._packedData[i]))
          return false;
      }
      return true;
    }
    return false;
  }
  /** block-by-block reversal */
  public reverseInPlace() {
    const m = this._blockSize;
    const n = this._order;
    let i, j;
    let a;
    for (i = 0, j = (n - 1) * m; i < j; i += m, j -= m) {
      for (let k = 0; k < m; k++) {
        a = this._packedData[i + k];
        this._packedData[i + k] = this._packedData[j + k];
        this._packedData[j + k] = a;
      }
    }
  }

  /**
   * interpolate at `fraction` between poleA and poleB.
   * * Data is left "in place" in poleIndexA
   * @param poleIndexA first pole index
   * @param fraction fractional position
   * @param poleIndexB second pole index
   */
  public interpolatePoleInPlace(poleIndexA: number, fraction: number, poleIndexB: number) {
    let i0 = poleIndexA * this._blockSize;
    let i1 = poleIndexB * this._blockSize;
    const data = this._packedData;
    for (let i = 0; i < this._blockSize; i++ , i0++ , i1++) {
      data[i0] += fraction * (data[i1] - data[i0]);
    }
  }

  /**
   * Compute new control points to "clamp" bspline unsaturated support to saturated form.
   * * At input time, the control points are associated with the input knots (unsaturated)
   * * At output, the control points are modified by repeated knot insertion to be fully clamped.
   * @param knots knot values for the current (unsaturated) pole set
   * @param spanIndex index of span whose (unsaturated) poles are in the bezier.
   */
  public saturateInPlace(knots: KnotVector, spanIndex: number): boolean {
    const degree = knots.degree;
    const kA = spanIndex + degree - 1; // left knot index of the active span
    const kB = kA + 1;
    if (spanIndex < 0 || spanIndex >= knots.numSpans)
      return false;
    const knotArray = knots.knots;
    const knotA = knotArray[kA];
    const knotB = knotArray[kB];
    this.setInterval(knotA, knotB);
    if (knotB <= knotA + KnotVector.knotTolerance)
      return false;
    for (let numInsert = degree - 1; numInsert > 0; numInsert--) {
      //  left numInsert poles are pulled forward
      let k0 = kA - numInsert;
      if (knotArray[k0] < knotA) {
        let k1 = kB;
        for (let i = 0; i < numInsert; i++ , k0++ , k1++) {
          const knot0 = knotArray[k0];
          const knot1 = knotArray[k1];
          const fraction = (knotA - knot0) / (knot1 - knot0);
          this.interpolatePoleInPlace(i, fraction, i + 1);
        }
      }
    }
    for (let numInsert = degree - 1; numInsert > 0; numInsert--) {
      let k2 = kB + numInsert;
      if (knotArray[k2] > knotB) {
        for (let i = 0; i < numInsert; i++ , k2--) {
          const knot2 = knotArray[k2]; // right side of moving window
          // left side of window ia always the (previously saturated) knotA
          const fraction = (knotB - knot2) / (knotA - knot2);
          this.interpolatePoleInPlace(degree - i, fraction, degree - i - 1);
        }
      }
    }
    return true;
  }
  /**
   * Saturate a univariate bspline coefficient array in place
   * * On input, the array is the coefficients of one span of a bspline, packed in an array of `(knots.order)` values.
   * * These are modified in place, and on return are a bezier for the same knot interval.
   * @param coffs input as bspline coefficients, returned as bezier coefficients
   * @param knots knot vector
   * @param spanIndex index of span whose (unsaturated) poles are in the coefficients.
   */
  public static saturate1dInPlace(coffs: Float64Array, knots: KnotVector, spanIndex: number): boolean {
    const degree = knots.degree;
    const kA = spanIndex + degree - 1; // left knot index of the active span
    const kB = kA + 1;
    if (spanIndex < 0 || spanIndex >= knots.numSpans)
      return false;
    const knotArray = knots.knots;
    const knotA = knotArray[kA];
    const knotB = knotArray[kB];
    if (knotB <= knotA + KnotVector.knotTolerance)
      return false;
    for (let numInsert = degree - 1; numInsert > 0; numInsert--) {
      //  left numInsert poles are pulled forward
      let k0 = kA - numInsert;
      if (knotArray[k0] < knotA) {
        let k1 = kB;
        for (let i = 0; i < numInsert; i++ , k0++ , k1++) {
          const knot0 = knotArray[k0];
          const knot1 = knotArray[k1];
          const fraction = (knotA - knot0) / (knot1 - knot0);
          coffs[i] = coffs[i] + fraction * (coffs[i + 1] - coffs[i]);
        }
      }
    }
    for (let numInsert = degree - 1; numInsert > 0; numInsert--) {
      let k2 = kB + numInsert;
      let k;
      if (knotArray[k2] > knotB) {
        for (let i = 0; i < numInsert; i++ , k2--) {
          const knot2 = knotArray[k2]; // right side of moving window
          // left side of window is always the (previously saturated) knotA
          const fraction = (knotB - knot2) / (knotA - knot2);
          k = degree - i;
          coffs[k] += fraction * (coffs[k - 1] - coffs[k]);
        }
      }
    }
    return true;
  }
  /**
   * Apply deCasteljau interpolations to isolate a smaller bezier polygon, representing interval 0..fraction of the original
   * @param fraction "end" fraction for split.
   * @returns false if fraction is 0 or 1 -- no changes applied.
   */
  public subdivideInPlaceKeepLeft(fraction: number): boolean {
    if (Geometry.isAlmostEqualNumber(fraction, 1.0))
      return true;
    if (Geometry.isAlmostEqualNumber(fraction, 0.0))
      return false;
    const g = 1.0 - fraction;   // interpolations will pull towards right indices
    const order = this.order;
    for (let level = 1; level < order; level++) {
      for (let i1 = order - 1; i1 >= level; i1--) {
        this.interpolatePoleInPlace(i1, g, i1 - 1); // leave updates to right
      }
    }
    return true;
  }

  /**
   * Apply deCasteljau interpolations to isolate a smaller bezier polygon, representing interval fraction..1 of the original
   * @param fraction "start" fraction for split.
   * @returns false if fraction is 0 or 1 -- no changes applied.
   */
  public subdivideInPlaceKeepRight(fraction: number): boolean {
    if (Geometry.isAlmostEqualNumber(fraction, 0.0))
      return true;
    if (Geometry.isAlmostEqualNumber(fraction, 1.0))
      return false;
    const order = this.order;
    for (let level = 1; level < order; level++) {
      for (let i0 = 0; i0 + level < order; i0++)
        this.interpolatePoleInPlace(i0, fraction, i0 + 1);   // leave updates to left.
    }
    return true;
  }

  /**
   * Saturate a univariate bspline coefficient array in place
   * @param fraction0 fraction for first split.   This is the start of the output polygon
   * @param fraction1 fraction for second split.   This is the end of the output polygon
   * @return false if fractions are (almost) identical.
   */
  public subdivideToIntervalInPlace(fraction0: number, fraction1: number): boolean {
    if (Geometry.isAlmostEqualNumber(fraction0, fraction1))
      return false;
    if (fraction1 < fraction0) {
      this.subdivideToIntervalInPlace(fraction1, fraction0);
      this.reverseInPlace();
      return true;
    }
    this.subdivideInPlaceKeepLeft(fraction1);
    this.subdivideInPlaceKeepRight(fraction0 / fraction1);
    return true;
  }

  /** optional interval for mapping to a parent object */
  public interval?: Segment1d;
  /** create or update the mapping to parent curve. */
  public setInterval(a: number, b: number) {
    this.interval = Segment1d.create(a, b, this.interval);
  }
  /** map a fraction to the parent space. */
  public fractionToParentFraction(fraction: number): number { return this.interval ? this.interval.fractionToPoint(fraction) : fraction; }
}
