/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Geometry } from "../Geometry";
import { NumberArray } from "../geometry3d/PointHelpers";
/**
 * Array of non-decreasing numbers acting as a knot array for bsplines.
 *
 * * Essential identity: numKnots = numPoles + order = numPoles + degree - 1
 * * Various bspline libraries have confusion over how many "end knots" are needed. "Many" libraries (including Microstation)
 *     incorrectly demand "order" knots at each end for clamping.   But only "order - 1" are really needed.
 * * This class uses the "order-1" convention.
 * * This class provides queries to convert among spanIndex and knotIndex
 * * A span is a single interval of the knots.
 * * The left knot of span {k} is knot {k+degree-1}
 * * This class provides queries to convert among spanFraction, fraction of knot range, and knot
 * * core computations (evaluateBasisFucntions) have leftKnotIndex and global knot value as inputs.  Caller's need to
 * know their primary values (global knot, spanFraction).
 */
export class KnotVector {
  public knots: Float64Array;
  public degree: number;
  private _knot0: number;
  private _knot1: number;
  private _possibleWrap: boolean;
  public static readonly knotTolerance = 1.0e-9;
  public get leftKnot() { return this._knot0; }
  public get rightKnot() { return this._knot1; }
  public get leftKnotIndex() { return this.degree - 1; }
  public get rightKnotIndex() { return this.knots.length - this.degree; }
  public get wrappable() { return this._possibleWrap; }
  public set wrappable(value: boolean) { this._possibleWrap = value; }
  public get numSpans() { return this.rightKnotIndex - this.leftKnotIndex; }
  /**
   *
   * * If knots is a number array or Float64Array, the those values become the local knot array.
   * * If knots is a simple number, the local knot array is allocated to that size but left as zeros.
   * @param knots
   * @param degree
   */
  private constructor(knots: number[] | Float64Array | number, degree: number) {
    this.degree = degree;
    this._possibleWrap = false;
    // default values to satisfy compiler -- real values hapn setupFixedValues or final else defers to user
    this._knot0 = 0.0;
    this._knot1 = 1.0;
    // satisfy the initialize checker ..
    if (Array.isArray(knots)) {
      this.knots = new Float64Array(knots.length);
      this.setKnots(knots);
      this.setupFixedValues();
    } else if (knots instanceof Float64Array) {
      this.knots = knots.slice();
      this.setupFixedValues();
    } else { // caller is responsible for filling array separately ...
      this.knots = new Float64Array(knots);
    }
  }
  /** copy degree and knots to a new KnotVector. */
  public clone(): KnotVector { return new KnotVector(this.knots, this.degree); }
  private setupFixedValues() {
    // These should be read-only . ..
    this._knot0 = this.knots[this.degree - 1];
    this._knot1 = this.knots[this.knots.length - this.degree];
  }
  /** @returns Return the total knot distance from beginning to end. */
  public get knotLength01(): number { return this._knot1 - this._knot0; }

  public isAlmostEqual(other: KnotVector): boolean {
    if (this.degree !== other.degree) return false;
    return NumberArray.isAlmostEqual(this.knots, other.knots, KnotVector.knotTolerance);
  }
  public setKnots(knots: number[] | Float64Array, skipFirstAndLast?: boolean) {
    const numAllocate = skipFirstAndLast ? knots.length - 2 : knots.length;
    if (numAllocate !== this.knots.length)
      this.knots = new Float64Array(numAllocate);
    if (skipFirstAndLast) {
      for (let i = 1; i + 1 < knots.length; i++)
        this.knots[i - 1] = knots[i];

    } else {
      for (let i = 0; i < knots.length; i++)
        this.knots[i] = knots[i];
    }
    this.setupFixedValues();
  }
  /**
   * Create knot vector with {degree-1} replicated knots at start and end, and uniform knots between.
   * @param numPoles Number of poles
   * @param degree degree of polynomial
   * @param a0 left knot value for active interval
   * @param a1 right knot value for active interval
   */
  public static createUniformClamped(numPoles: number, degree: number, a0: number, a1: number): KnotVector {
    const knots = new KnotVector(numPoles + degree - 1, degree);
    let k = 0;
    for (let m = 0; m < degree; m++)knots.knots[k++] = a0;
    const du = 1.0 / (numPoles - degree);
    for (let i = 1; i + degree < numPoles; i++)
      knots.knots[k++] = a0 + i * du * (a1 - a0);
    for (let m = 0; m < degree; m++)knots.knots[k++] = a1;
    knots.setupFixedValues();
    return knots;
  }
  /**
   * Create knot vector with given knot values and degree.
   * @param knotArray knot values
   * @param degree degree of polynomial
   * @param skipFirstAndLast true to skip class overclamped end knots.
   */
  public static create(knotArray: number[] | Float64Array, degree: number, skipFirstAndLast?: boolean): KnotVector {
    const numAllocate = skipFirstAndLast ? knotArray.length - 2 : knotArray.length;
    const knots = new KnotVector(numAllocate, degree);
    knots.setKnots(knotArray, skipFirstAndLast);
    return knots;
  }

  /**
   * Return the average of degree consecutive knots begining at spanIndex.
   */
  public grevilleKnot(spanIndex: number): number {
    if (spanIndex < 0) return this.leftKnot;
    if (spanIndex > this.rightKnotIndex) return this.rightKnot;
    let sum = 0.0;
    for (let i = spanIndex; i < spanIndex + this.degree; i++)
      sum += this.knots[i];
    return sum / this.degree;
  }
  /** Return an array sized for a set of the basis function values. */
  public createBasisArray(): Float64Array { return new Float64Array(this.degree + 1); }
  // public createTargetArray(numCoff: number): Float64Array { return new Float64Array(numCoff); }

  public baseKnotFractionToKnot(knotIndex0: number, localFraction: number): number {
    const knot0 = this.knots[knotIndex0];
    return knot0 + localFraction * (this.knots[knotIndex0 + 1] - knot0);
  }

  public spanFractionToKnot(spanIndex: number, localFraction: number): number {
    const k = this.spanIndexToLeftKnotIndex(spanIndex);
    return this.knots[k] + localFraction * (this.knots[k + 1] - this.knots[k]);
  }
  public spanFractionToFraction(spanIndex: number, localFraction: number): number {
    const knot = this.spanFractionToKnot(spanIndex, localFraction);
    return (knot - this.leftKnot) / (this.rightKnot - this.leftKnot);
  }

  public fractionToKnot(fraction: number): number {
    return Geometry.interpolate(this.knots[this.degree - 1], fraction, this.knots[this.knots.length - this.degree]);
  }
  /**
   * Evaluate basis fucntions f[] at knot value u.
   *
   * @param u knot value for evaluation
   * @param f array of basis values.  ASSUMED PROPER LENGTH
   */
  public evaluateBasisFunctions(knotIndex0: number, u: number, f: Float64Array) {
    f[0] = 1.0;
    if (this.degree < 1) return;
    // direct compute for linear part ...
    const u0 = this.knots[knotIndex0];
    const u1 = this.knots[knotIndex0 + 1];
    f[1] = (u - u0) / (u1 - u0);
    f[0] = 1.0 - f[1];
    if (this.degree < 2) return;

    for (let depth = 1; depth < this.degree; depth++) {
      let kLeft = knotIndex0 - depth;
      let kRight = kLeft + depth + 1;
      let gCarry = 0.0;
      for (let step = 0; step <= depth; step++) {
        const tLeft = this.knots[kLeft++];
        const tRight = this.knots[kRight++];
        const fraction = (u - tLeft) / (tRight - tLeft);
        const g1 = f[step] * fraction;
        const g0 = f[step] * (1.0 - fraction);
        f[step] = gCarry + g0;
        gCarry = g1;
      }
      f[depth + 1] = gCarry;
    }
  }

  /**
   * Evaluate basis fucntions f[] at knot value u.
   *
   * @param u knot value for evaluation
   * @param f array of basis values.  ASSUMED PROPER LENGTH
   */
  public evaluateBasisFunctions1(knotIndex0: number, u: number, f: Float64Array, df: Float64Array, ddf?: Float64Array) {
    f[0] = 1.0; df[0] = 0.0;
    if (this.degree < 1) return;
    // direct compute for linear part ...
    const u0 = this.knots[knotIndex0];
    const u1 = this.knots[knotIndex0 + 1];
    // ah = 1/(u1-u0)      is the derivative of fraction0
    // (-ah) is the derivative of fraction1.
    let ah = 1.0 / (u1 - u0);
    f[1] = (u - u0) * ah;
    f[0] = 1.0 - f[1];
    df[0] = -ah; df[1] = ah;
    if (ddf) {  // first derivative started constant, second derivative started zero.
      ddf[0] = 0.0; ddf[1] = 0.0;
    }
    if (this.degree < 2) return;
    for (let depth = 1; depth < this.degree; depth++) {
      let kLeft = knotIndex0 - depth;
      let kRight = kLeft + depth + 1;
      let gCarry = 0.0;
      let dgCarry = 0.0;
      let ddgCarry = 0.0;
      // f, df, ddf, are each row vectors with product of `step` ilnear terms.
      // f is multiplied on the right by matrix V.  Each row has 2 nonzero entries (which sum to 1)  (0,0,1-fraction, fraction,0,0,0)
      //    Each row of the derivative dV is two entries (0,0, -1/h, 1/h,0,0,0)
      // Hence fnew = f * V
      //      dfnew = df * V + f * dV
      //      ddfnew = ddf * V + df*dV + df * dV + f * ddV
      // but ddV is zero so
      //      ddfnew = ddf * V + 2 * df * dV
      for (let step = 0; step <= depth; step++) {
        const tLeft = this.knots[kLeft++];
        const tRight = this.knots[kRight++];
        ah = 1.0 / (tRight - tLeft);
        const fraction = (u - tLeft) * ah;
        const fraction1 = 1.0 - fraction;
        const g1 = f[step] * fraction;
        const g0 = f[step] * fraction1;
        const dg1 = df[step] * fraction + f[step] * ah;
        const dg0 = df[step] * fraction1 - f[step] * ah;
        const dfSave = 2.0 * df[step] * ah;
        f[step] = gCarry + g0;
        df[step] = dgCarry + dg0;
        gCarry = g1;
        dgCarry = dg1;
        if (ddf) {  // do the backward reference to df before rewriting df !!!
          const ddg1 = ddf[step] * fraction + dfSave;
          const ddg0 = ddf[step] * fraction1 - dfSave;
          ddf[step] = ddgCarry + ddg0;
          ddgCarry = ddg1;
        }
      }
      f[depth + 1] = gCarry;
      df[depth + 1] = dgCarry;
      if (ddf)
        ddf[depth + 1] = ddgCarry;
    }
  }

  public knotToLeftKnotIndex(u: number): number {
    // Anything to left is in the first span . .
    const firstLeftKnot = this.degree - 1;
    if (u < this.knots[firstLeftKnot + 1]) return firstLeftKnot;
    // Anything to right is in the last span ...
    const lastLeftKnot = this.knots.length - this.degree - 1;
    if (u >= this.knots.length - this.degree) return this.knots[lastLeftKnot];
    // ugh ... linear search ...
    for (let i = firstLeftKnot + 1; i < lastLeftKnot; i++)
      if (u < this.knots[i + 1]) return i;  // testing against right side skips over multiple knot cases???
    return lastLeftKnot;
  }
  /**
   * Given a span index, return the index of the knot at its left.
   * @param spanIndex index of span
   */
  public spanIndexToLeftKnotIndex(spanIndex: number): number {
    const d = this.degree;
    if (spanIndex <= 0.0) return d - 1;
    return Math.min(spanIndex + d - 1, this.knots.length - d);
  }
  public spanIndexToSpanLength(spanIndex: number): number {
    const k = this.spanIndexToLeftKnotIndex(spanIndex);
    return this.knots[k + 1] - this.knots[k];
  }
/**
 * Given a span index, test if it is withn range and has nonzero length.
 * * note that a false return does not imply there are no more spans.  This may be a double knot (zero length span) followed by more real spans
 * @param spanIndex index of span to test.
 */
  public isIndexOfRealSpan(spanIndex: number): boolean {
    if (spanIndex >= 0 && spanIndex < this.knots.length - this.degree)
      return !Geometry.isSmallMetricDistance(this.spanIndexToSpanLength(spanIndex));
    return false;
  }

  public reflectKnots() {
    const a = this.leftKnot;
    const b = this.rightKnot;
    const numKnots = this.knots.length;
    for (let i = 0; i < numKnots; i++)
      this.knots[i] = a + (b - this.knots[i]);
    this.knots.reverse();
  }
  /**
   * return a simple array form of the knots.  optionally replicate the first and last
   * in classic over-clamped manner
   */
  public copyKnots(includeExtraEndKnot: boolean): number[] {
    const values: number[] = [];
    if (includeExtraEndKnot)
      values.push(this.knots[0]);
    for (const u of this.knots) values.push(u);
    if (includeExtraEndKnot)
      values.push(values[values.length - 1]);
    return values;
  }
}
