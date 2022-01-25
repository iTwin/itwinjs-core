/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { TransitionSpiral3d } from "./TransitionSpiral3d";
// import {} from "./";
/** A true transition spiral is a curve defined by its curvature, with the curvature function symmetric about midpoint.
 * * The symmetry condition creates a relationship among the following 4 quantities:
 * ** curvature0 = curvature (i.e. 1/radius) at start
 * ** curvature1 = curvature (i.e. 1/radius) at end
 * ** sweepRadians = signed turning angle from start to end
 * ** arcLength = length of curve
 * * The relationship is the equation
 * ** `sweepRadians = arcLength * average Curvature = arcLength * 0.5 * (curvature0 + curvature1)`
 * * That is, regardless of any curvature properties other than symmetry, specifying any 3 of the quantities fully determines the remaining one.
 * @public
 */
export class TransitionConditionalProperties {
  /** radius (or 0 at start) */
  public radius0: number | undefined;
  /** radius (or 0) at end */
  public radius1: number | undefined;
  /** bearing at start, measured from x towards y */
  public bearing0: Angle | undefined;
  /** bearing at end, measured from x towards y */
  public bearing1: Angle | undefined;
  /** curve length */
  public curveLength: number | undefined;
  /**
   * capture numeric or undefined values
   * @param radius0 start radius or undefined
   * @param radius1 end radius or undefined
   * @param bearing0 start bearing or undefined
   * @param bearing1 end bearing or undefined
   * @param arcLength arc length or undefined
   */
  public constructor(
    radius0: number | undefined,
    radius1: number | undefined,
    bearing0: Angle | undefined,
    bearing1: Angle | undefined,
    arcLength: number | undefined) {
    this.radius0 = radius0;
    this.radius1 = radius1;
    this.bearing0 = bearing0;
    this.bearing1 = bearing1;
    this.curveLength = arcLength;
  }
  /** return the number of defined values among the 5 properties. */
  public numDefinedProperties() {
    return Geometry.defined01(this.radius0)
      + Geometry.defined01(this.radius1)
      + Geometry.defined01(this.bearing0)
      + Geometry.defined01(this.bearing1)
      + Geometry.defined01(this.curveLength);
  }
  /** clone with all properties (i.e. preserve undefined states) */
  public clone(): TransitionConditionalProperties {
    return new TransitionConditionalProperties(
      this.radius0,
      this.radius1,
      this.bearing0 === undefined ? undefined : this.bearing0.clone(),
      this.bearing1 === undefined ? undefined : this.bearing1.clone(),
      this.curveLength);
  }
  /** Return true if all components are defined and agree equationally. */
  public getIsValidCompleteSet() {
    if (this.curveLength !== undefined && this.bearing0 !== undefined && this.bearing1 !== undefined
      && this.radius0 !== undefined && this.radius1 !== undefined) {
      const length1 = TransitionSpiral3d.radiusRadiusSweepRadiansToArcLength(this.radius0, this.radius1,
        this.bearing1.radians - this.bearing0.radians);
      return Geometry.isSameCoordinate(this.curveLength, length1);
    }
    return false;
  }
  /** Examine which properties are defined and compute the (single) undefined.
   * @returns Return true if the input state had precisely one undefined member.
   */
  public tryResolveAnySingleUnknown(): boolean {
    if (this.getIsValidCompleteSet())
      return true;
    if (this.bearing0 && this.bearing1) {
      const sweepRadians = this.bearing1.radians - this.bearing0.radians;
      if (this.curveLength === undefined && this.radius0 !== undefined && this.radius1 !== undefined) {
        this.curveLength = TransitionSpiral3d.radiusRadiusSweepRadiansToArcLength(this.radius0, this.radius1, sweepRadians);
        return true;
      }
      if (this.curveLength !== undefined && this.radius0 === undefined && this.radius1 !== undefined) {
        this.radius0 = TransitionSpiral3d.radius1LengthSweepRadiansToRadius0(this.radius1, this.curveLength, sweepRadians);
        return true;
      }
      if (this.curveLength !== undefined && this.radius0 !== undefined && this.radius1 === undefined) {
        this.radius1 = TransitionSpiral3d.radius0LengthSweepRadiansToRadius1(this.radius0, this.curveLength, sweepRadians);
        return true;
      }
      return false;
    }
    // at least one bearing is undefined ...
    if (this.curveLength === undefined || this.radius0 === undefined || this.radius1 === undefined)
      return false;

    if (this.bearing0) { // bearing 1 is undefined
      this.bearing1 = Angle.createRadians(this.bearing0.radians + TransitionSpiral3d.radiusRadiusLengthToSweepRadians(this.radius0, this.radius1, this.curveLength));
      return true;
    }

    if (this.bearing1) { // bearing 0 is undefined
      this.bearing0 = Angle.createRadians(this.bearing1.radians - TransitionSpiral3d.radiusRadiusLengthToSweepRadians(this.radius0, this.radius1, this.curveLength));
      return true;
    }
    return false;
  }
  private almostEqualCoordinate(a: number | undefined, b: number | undefined): boolean {
    if (a === undefined && b === undefined)
      return true;
    if (a !== undefined && b !== undefined)
      return Geometry.isSameCoordinate(a, b);
    return false;
  }
  private almostEqualBearing(a: Angle | undefined, b: Angle | undefined): boolean {
    if (a === undefined && b === undefined)
      return true;
    if (a !== undefined && b !== undefined)
      return a.isAlmostEqualNoPeriodShift(b);
    return false;
  }

  /**
   * Test if this and other have matching numeric and undefined members.
   */

  public isAlmostEqual(other?: TransitionConditionalProperties) {
    if (!other)
      return false;
    if (!this.almostEqualCoordinate(this.radius0, other.radius0))
      return false;
    if (!this.almostEqualCoordinate(this.radius1, other.radius1))
      return false;
    if (!this.almostEqualBearing(this.bearing0, other.bearing0))
      return false;
    if (!this.almostEqualBearing(this.bearing1, other.bearing1))
      return false;
    if (!this.almostEqualCoordinate(this.curveLength, other.curveLength))
      return false;
    return true;
  }
  /** Apply a NONZERO scale factor to all distances. */
  public applyScaleFactor(a: number) {
    if (this.radius0 !== undefined)
      this.radius0 *= a;
    if (this.radius1 !== undefined)
      this.radius1 *= a;
    if (this.curveLength !== undefined)
      this.curveLength *= a;
  }
  public static areAlmostEqual(a: TransitionConditionalProperties | undefined, b: TransitionConditionalProperties | undefined): boolean {
    if (a === undefined)
      return b === undefined;
    return a.isAlmostEqual(b);
  }
}
