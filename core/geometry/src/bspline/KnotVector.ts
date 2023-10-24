/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { Geometry } from "../Geometry";
import { NumberArray } from "../geometry3d/PointHelpers";

/**
 * B-spline curve and surface types in this library are non-periodic. But they can be created from legacy periodic data.
 * This enumeration lists the possible ways a B-spline object can have been created from legacy periodic data.
 * @public
 */
export enum BSplineWrapMode {
  /** No conversion performed. */
  None = 0,
  /** The B-spline was opened up by adding degree wrap-around control points to the legacy periodic data.
   * * This is typical of B-splines constructed with maximum (degree - 1) continuity.
   * * Knots are unaffected by this conversion.
   */
  OpenByAddingControlPoints = 1,
  /** The B-spline was opened up by removing degree extreme knots from the legacy periodic data.
   * * This is typical of rational B-spline curves representing full circles and ellipses.
   * * Poles are unaffected by this conversion.
   */
  OpenByRemovingKnots = 2,
}
/**
 * Array of non-decreasing numbers acting as a knot array for B-splines.
 *
 * * Essential identity: numKnots = numPoles + order - 2 = numPoles + degree - 1
 * * Various B-spline libraries have confusion over how many "end knots" are needed. Many libraries (including MicroStation and Parasolid)
 * demand order knots at each end for clamping. But only order-1 are really needed. This class uses the order-1 convention.
 * * A span is a single interval of the knots.
 * * The left knot of span {k} is knot {k+degree-1}.
 * * This class provides queries to convert among spanIndex, knotIndex, spanFraction, fraction of knot range, and knot.
 * * Core computations (evaluateBasisFunctions) have leftKnotIndex and global knot value as inputs.  Callers need to
 * know their primary values (global knot, spanFraction).
 * @public
 */
export class KnotVector {
  /** The simple array of knot values. */
  public knots: Float64Array;
  /** Return the degree of basis functions defined in these knots. */
  public degree: number;
  private _knot0: number;
  private _knot1: number;

  private _wrapMode?: BSplineWrapMode;
  /** tolerance for considering two knots to be the same. */
  public static readonly knotTolerance = 1.0e-9;
  /** Return the leftmost knot value (of the active interval, ignoring unclamped leading knots)*/
  public get leftKnot() { return this._knot0; }
  /** Return the rightmost knot value (of the active interval, ignoring unclamped leading knots)*/
  public get rightKnot() { return this._knot1; }
  /** Return the index of the leftmost knot of the active interval */
  public get leftKnotIndex() { return this.degree - 1; }
  /** Return the index of the rightmost knot of the active interval */
  public get rightKnotIndex() { return this.knots.length - this.degree; }
  /** Whether this KnotVector was created by converting legacy periodic data during deserialization. The conversion used is specified by BSplineWrapMode, and is reversed at serialization time. */
  public get wrappable() { return this._wrapMode === undefined ? BSplineWrapMode.None : this._wrapMode; }
  public set wrappable(value: BSplineWrapMode) { this._wrapMode = value; }
  /** Return the number of bezier spans.  Note that this includes zero-length spans if there are repeated knots. */
  public get numSpans() { return this.rightKnotIndex - this.leftKnotIndex; }
  /**
   *
   * * If knots is a number array or Float64Array, the those values become the local knot array.
   * * If knots is a simple number, the local knot array is allocated to that size but left as zeros.
   * @param knots
   * @param degree
   */
  private constructor(knots: number[] | Float64Array | number, degree: number, wrapMode?: BSplineWrapMode) {
    this.degree = degree;
    this._wrapMode = wrapMode;
    // default values to satisfy compiler -- real values happen in setupFixedValues, or final else defers to user
    this._knot0 = 0.0;
    this._knot1 = 1.0;
    // satisfy the initialize checker ..
    if (Array.isArray(knots)) { // remark:  This ctor is private.  The callers (as of April 2019) do not use this path.
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
  public clone(): KnotVector { return new KnotVector(this.knots, this.degree, this.wrappable); }
  private setupFixedValues() {
    if (this.degree > 0 && this.knots.length > this.degree) {
      this._knot0 = this.knots[this.degree - 1];
      this._knot1 = this.knots[this.knots.length - this.degree];
    }
  }
  /** Return the total knot distance from beginning to end. */
  public get knotLength01(): number { return this._knot1 - this._knot0; }
  /**
   * Returns true if all numeric values have wraparound conditions that allow the knots to be closed with specified wrap mode.
   * @param mode optional test mode.  If undefined, use this.wrappable.
   */
  public testClosable(mode?: BSplineWrapMode): boolean {
    if (mode === undefined)
      mode = this.wrappable;
    const degree = this.degree;
    const leftKnotIndex = this.leftKnotIndex;
    const rightKnotIndex = this.rightKnotIndex;
    if (mode === BSplineWrapMode.OpenByAddingControlPoints) {
      // maximum continuity mode: we expect degree periodically extended knots at each end
      const period = this.rightKnot - this.leftKnot;
      const indexDelta = rightKnotIndex - leftKnotIndex;
      for (let k0 = 0; k0 < leftKnotIndex + degree; k0++) {
        const k1 = k0 + indexDelta;
        if (Math.abs(this.knots[k0] + period - this.knots[k1]) >= KnotVector.knotTolerance)
          return false;
      }
      return true;
    }
    if (mode === BSplineWrapMode.OpenByRemovingKnots) {
      // legacy periodic mode: we expect multiplicity degree knots at each end
      const numRepeated = degree - 1;
      const leftKnot = this.leftKnot;
      const rightKnot = this.rightKnot;
      for (let i = 0; i < numRepeated; i++) {
        if (Math.abs(leftKnot - this.knots[leftKnotIndex - i - 1]) >= KnotVector.knotTolerance)
          return false;
        if (Math.abs(rightKnot - this.knots[rightKnotIndex + i + 1]) >= KnotVector.knotTolerance)
          return false;
      }
      return true;
    }
    return false;
  }
  /** Test matching degree and knot values */
  public isAlmostEqual(other: KnotVector): boolean {
    if (this.degree !== other.degree) return false;
    return NumberArray.isAlmostEqual(this.knots, other.knots, KnotVector.knotTolerance);
  }

  /** Compute the multiplicity of the input knot, or zero if not a knot. */
  public getKnotMultiplicity(knot: number): number {
    let m = 0;
    for (const k of this.knots) {
      if (Math.abs(k - knot) < KnotVector.knotTolerance)
        ++m;
      else if (knot < k)
        break;
    }
    return m;
  }

  /** Compute the multiplicity of the knot at the given index. */
  public getKnotMultiplicityAtIndex(knotIndex: number): number {
    let m = 0;
    if (knotIndex >= 0 && knotIndex < this.knots.length) {
      const knot = this.knots[knotIndex];
      ++m;  // count this knot
      for (let i = knotIndex - 1; i >= 0; --i) {
        const k = this.knots[i];
        if (Math.abs(k - knot) < KnotVector.knotTolerance)
          ++m;  // found multiple to left of knot
        else if (knot > k)
          break;
      }
      for (let i = knotIndex + 1; i < this.knots.length; ++i) {
        const k = this.knots[i];
        if (Math.abs(k - knot) < KnotVector.knotTolerance)
          ++m;  // found multiple to right of knot
        else if (knot < k)
          break;
      }
    }
    return m;
  }

  /** Transform knots to span [0,1].
   * @returns false if and only if this.knotLength01 is trivial
   */
  public normalize(): boolean {
    if (this.knotLength01 < KnotVector.knotTolerance)
      return false;
    const divisor = 1.0 / this.knotLength01;
    const leftKnot = this.leftKnot;
    for (let i = 0; i < this.knots.length; ++i)
      this.knots[i] = (this.knots[i] - leftKnot) * divisor;
    // explicitly set rightKnot and its multiples to 1.0 to avoid round-off
    for (let i = this.rightKnotIndex - 1; i > this.leftKnotIndex && (this.knots[i] === this.knots[this.rightKnotIndex]); --i) this.knots[i] = 1.0;
    for (let i = this.rightKnotIndex + 1; i < this.knots.length && (this.knots[i] === this.knots[this.rightKnotIndex]); ++i) this.knots[i] = 1.0;
    this.knots[this.rightKnotIndex] = 1.0;
    this.setupFixedValues();
    return true;
  }

  /** install knot values from an array, optionally ignoring first and last.
   */
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

  /** Set knots to input array (CAPTURED)  */
  public setKnotsCapture(knots: Float64Array) {
    this.knots = knots;
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
   * Create knot vector with wraparound knots at start and end, and uniform knots between.
   * @param  numInterval number of intervals in knot space.  (NOT POLE COUNT)
   * @param degree degree of polynomial
   * @param a0 left knot value for active interval
   * @param a1 right knot value for active interval
   */
  public static createUniformWrapped(numInterval: number, degree: number, a0: number, a1: number): KnotVector {
    const knots = new KnotVector(numInterval + 2 * degree - 1, degree);
    const du = 1.0 / numInterval;
    for (let i = 1 - degree, k = 0; i < numInterval + degree; i++, k++) {
      knots.knots[k] = Geometry.interpolate(a0, i * du, a1);
    }
    knots.setupFixedValues();
    return knots;
  }

  /**
   * Create knot vector with given knot values and degree.
   * @param knotArray knot values
   * @param degree degree of polynomial
   * @param skipFirstAndLast true to skip copying the first and last knot values.
   */
  public static create(knotArray: number[] | Float64Array, degree: number, skipFirstAndLast?: boolean): KnotVector {
    const numAllocate = skipFirstAndLast ? knotArray.length - 2 : knotArray.length;
    const knots = new KnotVector(numAllocate, degree);
    knots.setKnots(knotArray, skipFirstAndLast);
    return knots;
  }

  /**
   * Return the average of degree consecutive knots beginning at knotIndex.
   */
  public grevilleKnot(knotIndex: number): number {
    if (knotIndex < 0) return this.leftKnot;
    if (knotIndex > this.rightKnotIndex) return this.rightKnot;
    let sum = 0.0;
    for (let i = knotIndex; i < knotIndex + this.degree; i++)
      sum += this.knots[i];
    return sum / this.degree;
  }
  /** Return an array sized for a set of the basis function values. */
  public createBasisArray(): Float64Array { return new Float64Array(this.degree + 1); }
  /** Convert localFraction within the interval following an indexed knot to a knot value. */
  public baseKnotFractionToKnot(knotIndex0: number, localFraction: number): number {
    const knot0 = this.knots[knotIndex0];
    localFraction = Geometry.clamp(localFraction, 0, 1);
    return knot0 + localFraction * (this.knots[knotIndex0 + 1] - knot0);
  }
  /** Convert localFraction within an indexed bezier span to a knot value. */
  public spanFractionToKnot(spanIndex: number, localFraction: number): number {
    const k = this.spanIndexToLeftKnotIndex(spanIndex);
    localFraction = Geometry.clamp(localFraction, 0, 1);
    return this.knots[k] + localFraction * (this.knots[k + 1] - this.knots[k]);
  }
  /** Convert localFraction within an indexed bezier span to fraction of active knot range. */
  public spanFractionToFraction(spanIndex: number, localFraction: number): number {
    const knot = this.spanFractionToKnot(spanIndex, localFraction);
    return (knot - this.leftKnot) / (this.rightKnot - this.leftKnot);
  }
  /** Return fraction of active knot range to knot value. */
  public fractionToKnot(fraction: number): number {
    fraction = Geometry.clamp(fraction, 0, 1);   // B-splines are not extendable
    return Geometry.interpolate(this.knots[this.degree - 1], fraction, this.knots[this.knots.length - this.degree]);
  }
  /**
   * Evaluate basis functions f[] at knot value u.
   *
   * @param u knot value for evaluation
   * @param f preallocated output array of order basis function values
   * @returns true if and only if output array is sufficiently sized
   */
  public evaluateBasisFunctions(knotIndex0: number, u: number, f: Float64Array): boolean {
    if (f.length < this.degree + 1)
      return false;
    f[0] = 1.0;
    if (this.degree < 1)
      return true;
    // direct compute for linear part ...
    const u0 = this.knots[knotIndex0];
    const u1 = this.knots[knotIndex0 + 1];
    f[1] = (u - u0) / (u1 - u0);
    f[0] = 1.0 - f[1];
    if (this.degree < 2)
      return true;
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
    return true;
  }

  /**
   * Evaluate basis functions f[], derivatives df[], and optional second derivatives ddf[] at knot value u.
   *
   * @param u knot value for evaluation
   * @param f preallocated output array of order basis function values
   * @param df preallocated output array of order basis derivative values
   * @param ddf optional preallocated output array of order basis second derivative values
   * @returns true if and only if output arrays are sufficiently sized
   */
  public evaluateBasisFunctions1(knotIndex0: number, u: number, f: Float64Array, df: Float64Array, ddf?: Float64Array): boolean {
    if (f.length < this.degree + 1)
      return false;
    if (df.length < this.degree + 1)
      return false;
    if (ddf && ddf.length < this.degree + 1)
      return false;
    f[0] = 1.0; df[0] = 0.0;
    if (this.degree < 1)
      return true;
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
    if (this.degree < 2)
      return true;
    for (let depth = 1; depth < this.degree; depth++) {
      let kLeft = knotIndex0 - depth;
      let kRight = kLeft + depth + 1;
      let gCarry = 0.0;
      let dgCarry = 0.0;
      let ddgCarry = 0.0;
      // f, df, ddf, are each row vectors with product of `step` linear terms.
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
    return true;
  }
  /** Find the knot span bracketing knots[i] <= u < knots[i+1] and return i.
   * * If u has no such bracket, return the smaller index of the closest nontrivial bracket.
   * @param u value to bracket
   */
  public knotToLeftKnotIndex(u: number): number {
    for (let i = this.leftKnotIndex; i < this.rightKnotIndex; ++i) {
      if (u < this.knots[i + 1])
        return i;
    }
    // for u >= rightKnot, return left index of last nontrivial span
    for (let i = this.rightKnotIndex; i > this.leftKnotIndex; --i) {
      if (this.knots[i] - this.knots[i - 1] >= KnotVector.knotTolerance)
        return i - 1;
    }
    return this.rightKnotIndex - 1; // shouldn't get here
  }
  /**
   * Given a span index, return the index of the knot at its left.
   * @param spanIndex index of span
   */
  public spanIndexToLeftKnotIndex(spanIndex: number): number {
    const d = this.degree;
    if (spanIndex <= 0.0) return d - 1;
    return Math.min(spanIndex + d - 1, this.knots.length - d - 1);
  }
  /** Return the knot interval length of indexed bezier span. */
  public spanIndexToSpanLength(spanIndex: number): number {
    const k = this.spanIndexToLeftKnotIndex(spanIndex);
    return this.knots[k + 1] - this.knots[k];
  }
  /**
   * Given a span index, test if it is within range and has nonzero length.
   * * note that a false return does not imply there are no more spans.  This may be a double knot (zero length span) followed by more real spans
   * @param spanIndex index of span to test.
   */
  public isIndexOfRealSpan(spanIndex: number): boolean {
    if (spanIndex >= 0 && spanIndex < this.numSpans)
      return !Geometry.isSmallMetricDistance(this.spanIndexToSpanLength(spanIndex));
    return false;
  }
  /** Reflect all knots so `leftKnot` and `rightKnot` are maintained but interval lengths reverse. */
  public reflectKnots() {
    const a = this.leftKnot;
    const b = this.rightKnot;
    const numKnots = this.knots.length;
    for (let i = 0; i < numKnots; i++)
      this.knots[i] = a + (b - this.knots[i]);
    this.knots.reverse();
  }

  /** Return a simple array form of the knots. Optionally replicate the first and last in classic over-clamped manner. */
  public static copyKnots(knots: number[] | Float64Array, degree: number, includeExtraEndKnot?: boolean, wrapMode?: BSplineWrapMode): number[] {
    const isExtraEndKnotPeriodic = (includeExtraEndKnot && wrapMode === BSplineWrapMode.OpenByAddingControlPoints);
    const leftIndex = degree - 1;
    const rightIndex = knots.length - degree;
    const a0 = knots[leftIndex];
    const a1 = knots[rightIndex];
    const delta = a1 - a0;
    const values: number[] = [];
    if (includeExtraEndKnot) {
      if (isExtraEndKnotPeriodic)
        values.push(knots[rightIndex - degree] - delta);
      else
        values.push(knots[0]);
    }
    for (const u of knots) {
      values.push(u);
    }
    if (includeExtraEndKnot) {
      if (isExtraEndKnotPeriodic)
        values.push(knots[leftIndex + degree] + delta);
      else
        values.push(knots[knots.length - 1]);
    }
    return values;
  }

  /** Return a simple array form of the knots. Optionally replicate the first and last in classic over-clamped manner. */
  public copyKnots(includeExtraEndKnot: boolean): number[] {
    const wrapMode = (includeExtraEndKnot && this.testClosable()) ? this.wrappable : undefined;
    return KnotVector.copyKnots(this.knots, this.degree, includeExtraEndKnot, wrapMode);
  }
}
