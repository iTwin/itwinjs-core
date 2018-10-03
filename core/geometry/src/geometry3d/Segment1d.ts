/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Geometry } from "../Geometry";
/**
 * * A Segment1d is an interval of an axis named x.
 * * The interval is defined by two values x0 and x1.
 * * The x0 and x1 values can be in either order.
 * * * if `x0 < x1` fractional coordinates within the segment move from left to right.
 * * * if `x0 > x1` fractional coordinatesw within the segment move from right to left.
 * * This differs from a Range1d in that:
 * * For a Range1d the reversed ordering of its limit values means "empty interval".
 * * For a Segment1d the reversed ordering is a real interval but fractional positions mvoe backwards.
 * * The segment is parameterized with a fraction
 * * * Fraction 0 is the start (`x0`)
 * * * Fraction 1 is the end (`x1`)
 * * * The fraction equation is `x = x0 + fraction * (x1-x0)` or (equivalently) `x = (1-fraction) * x0 + fraction * x1`
 */
export class Segment1d {
  public x0: number;
  public x1: number;
  private constructor(x0: number, x1: number) {
    this.x0 = x0;
    this.x1 = x1;
  }
  public set(x0: number, x1: number) { this.x0 = x0, this.x1 = x1; }
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
   * Evalauate the segment at fractional position
   * @returns position within the segment
   * @param fraction fractional position within this segment
   */
  public fractionToPoint(fraction: number): number { return Geometry.interpolate(this.x0, fraction, this.x1); }
  /**
   * * swap the x0 and x1 member values.
   * * This makes the fractionToPoint evaluates reverse direction.
   */
  public reverseInPlace(): void { const x = this.x0; this.x0 = this.x1; this.x1 = x; }
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
}
