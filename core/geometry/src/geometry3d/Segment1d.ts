/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";

/**
 * * A Segment1d is an interval of an axis named x.
 * * The interval is defined by two values x0 and x1.
 * * The x0 and x1 values can be in either order.
 *   * if `x0 < x1` fractional coordinates within the segment move from left to right.
 *   * if `x0 > x1` fractional coordinates within the segment move from right to left.
 * * This differs from a Range1d in that:
 * * For a Range1d the reversed ordering of its limit values means "empty interval".
 * * For a Segment1d the reversed ordering is a real interval but fractional positions move backwards.
 * * The segment is parameterized with a fraction
 * * * Fraction 0 is the start (`x0`)
 * * * Fraction 1 is the end (`x1`)
 * * * The fraction equation is `x = x0 + fraction * (x1-x0)` or (equivalently) `x = (1-fraction) * x0 + fraction * x1`
 * @public
 */
export class Segment1d {
  /** start coordinate */
  public x0: number;
  /** end coordinate */
  public x1: number;
  private constructor(x0: number, x1: number) {
    this.x0 = x0;
    this.x1 = x1;
  }
  /**
   * replace both end values.
   * @param x0 new x0 value
   * @param x1 new y0 value
   */
  public set(x0: number, x1: number) { this.x0 = x0, this.x1 = x1; }
  /**
   * shift (translate) the segment along its axis by adding `dx` to both `x0` and `x1`.
   * @param dx value to add to both x0 and x1
   */
  public shift(dx: number) { this.x0 += dx, this.x1 += dx; }
  /**
   * create segment1d with given end values
   * @param x0 start value
   * @param x1 end value
   * @param result optional pre-existing result to be reinitialized.
   */
  public static create(x0: number = 0, x1: number = 1, result?: Segment1d): Segment1d {
    if (!result)
      return new Segment1d(x0, x1);
    result.set(x0, x1);
    return result;
  }
  /**
   * Copy both end values from other Segment1d
   * @param other source Segment1d
   */
  public setFrom(other: Segment1d) { this.x0 = other.x0; this.x1 = other.x1; }
  /**
   * clone this Segment1d, return as a separate object.
   */
  public clone(): Segment1d { return new Segment1d(this.x0, this.x1); }
  /**
   * Returns true if both coordinates (`x0` and `x1`) are in the 0..1 range.
   */
  public get isIn01() {
    return Geometry.isIn01(this.x0) && Geometry.isIn01(this.x1);

  }
  /**
   * Evaluate the segment at fractional position
   * @returns position within the segment
   * @param fraction fractional position within this segment
   */
  public fractionToPoint(fraction: number): number { return Geometry.interpolate(this.x0, fraction, this.x1); }
  /**
   * Return the signed start-to-end shift (aka signed distance)
   */
  public signedDelta(): number { return this.x1 - this.x0; }
  /**
   * Return the absolute start-to-end shift (aka distance)
   */
  public absoluteDelta(): number { return Math.abs(this.x1 - this.x0); }
  /**
   * * swap the x0 and x1 member values.
   * * This makes the fractionToPoint evaluates reverse direction.
   */
  public reverseInPlace(): void { const x = this.x0; this.x0 = this.x1; this.x1 = x; }
  /**
   * * if `x1<x0` multiplied by the scale factor is (strictly) negative, swap the x0 and x1 member values.
   * * This makes the fractionToPoint evaluates reverse direction.
   */
  public reverseIfNeededForDeltaSign(sign: number = 1): void {
    if (sign * (this.x1 - this.x0) < 0)
      this.reverseInPlace();
  }
  /**
   * Near equality test, using Geometry.isSameCoordinate for tolerances.
   */
  public isAlmostEqual(other: Segment1d): boolean {
    return Geometry.isSameCoordinate(this.x0, other.x0) && Geometry.isSameCoordinate(this.x1, other.x1);
  }
  /**
   * Return true if the segment limits are (exactly) 0 and 1
   */
  public get isExact01(): boolean { return this.x0 === 0.0 && this.x1 === 1.0; }
  /**
   * Return true if the segment limits are (exactly) 1 and 0
   */
  public get isExact01Reversed(): boolean { return this.x0 === 1.0 && this.x1 === 0.0; }

  /** On input, `this` is an interval of a line.  On output, the interval has been clipped to positive parts of a linear function
   * * f0 and f1 are values at parameter values 0 and 1 (which are in general NOT x0 and x1)
   * * From that determine where the segment crosses function value 0.
   * * The segment contains some interval in the same parameter space.
   * * Clip the segment to the positive part of the space.
   * * Return true (and modify the segment) if any of the segment remains.
   * * Return false (but without modifying the segment) if the active part is entirely out.
   */
  public clipBy01FunctionValuesPositive(f0: number, f1: number): boolean {
    const df01 = f1 - f0;
    const fA = f0 + this.x0 * df01;
    const fB = f0 + this.x1 * df01;
    const dfAB = fB - fA;
    if (fA > 0) {
      if (fB >= 0) return true; // inside at both ends
      /** There is an inside to outside crossing. The division is safe ... (and value between 0 and 1) */
      const u = -fA / dfAB;
      this.x1 = this.x0 + u * (this.x1 - this.x0);
      return true;
    } else if (fA < 0) {
      if (fB < 0) return false;   // outside at both ends.
      /** There is an outside to inside crossing crossing. The division is safe ... (and value between 0 and 1) */
      const u = -fA / dfAB;
      this.x0 = this.x0 + u * (this.x1 - this.x0);
      return true;
    }
    /** fA is on the cut.   fB determines the entire segment. */
    return fB > 0;
  }
  /**
   * * On input, (f0,f1) is a (directed) segment.
   * * On output, it is restricted to (0,1) while maintaining direction
   * * If the clip leaves nothing, leave this segment alone and return false.
   * * If the clip leaves something, update this segment and return true.
   */
  public clampDirectedTo01(): boolean {
    let x0 = this.x0;
    let x1 = this.x1;
    if (x1 > x0) {
      if (x0 < 0) x0 = 0;
      if (x1 > 1) x1 = 1;
      if (x0 >= x1)
        return false;
    } else {
      if (x0 > 1) x0 = 1;
      if (x1 < 0) x1 = 0;
      if (x0 <= x1)
        return false;
    }
    this.set(x0, x1);
    return true;
  }

}
