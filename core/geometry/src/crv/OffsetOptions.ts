/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { StrokeOptions } from "./StrokeOptions";

/**
 * Control parameters for joint construction, used in offset construction methods such as [[RegionOps.constructPolygonWireXYOffset]] and [[Region.Ops.constructCurveXYOffset]].
 *   * Define a "joint" as the common point between adjacent segments of the input curve.
 *   * Define the "turn angle" at a joint to be the angle in [0,pi] between the first derivatives (tangents) of
 * the segments at the joint.
 *   * When creating offsets, if an offset needs to do an "outside" turn, the first applicable construction is applied:
 *   * If the turn angle is larger than `options.minArcDegrees`, a circular arc is constructed to offset the joint.
 *   * If the turn angle is less than or equal to `options.maxChamferTurnDegrees`, extend curves along tangent to
 * single intersection point (to create a sharp corner).
 *   * If the turn angle is larger than `options.maxChamferDegrees`, the joint is offset with a line string whose edges:
 *      * lie outside the arc that would have been created by the first construction
 *      * have uniform turn angle less than `options.maxChamferDegrees`
 *      * touch the arc at their midpoint (except first and last edge).
 * @public
 */
export class JointOptions {
  /**
   * Smallest arc to construct.
   * * If this control angle is 180 degrees or more, arcs are never created.
   */
  public minArcDegrees = 180.0;
  /** Largest turn angle at which to construct a sharp corner, or largest turn angle in a multi-segment chamfer. */
  public maxChamferTurnDegrees = 90;
  /**
   * Whether to remove the internal turn angle upper bound for sharp corner construction.
   * * By default, a sharp corner is not created at a joint when the turn angle is too large, so as to avoid offsets whose
   *  ranges blow up. Internally, this is implemented by applying an upper bound of 120 degrees to `maxChamferTurnDegrees`.
   * * When `allowSharpestCorners` is true, this internal upper bound is removed, allowing sharp corners for turn angles
   * up to `maxChamferTurnDegrees`.
   * * Thus, if you know your input turn angles are no greater than `maxChamferTurnDegrees`, you can create an offset with
   * sharp corners at each joint by setting `maxChamferTurnDegrees < minArcDegrees` and `allowSharpestCorners` to true.
   */
  public allowSharpestCorners = false;
  /** Offset distance, positive to left of base curve. */
  public leftOffsetDistance: number = 0;
  /** Whether to offset elliptical arcs as elliptical arcs (true) or as B-spline curves (false, default). */
  public preserveEllipticalArcs = false;
  /**
   * Construct JointOptions.
   * * leftOffsetDistance is required
   * * minArcDegrees and maxChamferDegrees are optional.
   */
  constructor(
    leftOffsetDistance: number, minArcDegrees = 180, maxChamferDegrees = 90,
    preserveEllipticalArcs = false, allowSharpestCorners = false,
  ) {
    this.leftOffsetDistance = leftOffsetDistance;
    this.minArcDegrees = minArcDegrees;
    this.maxChamferTurnDegrees = maxChamferDegrees;
    this.preserveEllipticalArcs = preserveEllipticalArcs;
    this.allowSharpestCorners = allowSharpestCorners;
  }
  /** Return a deep clone. */
  public clone(): JointOptions {
    return new JointOptions(
      this.leftOffsetDistance, this.minArcDegrees, this.maxChamferTurnDegrees,
      this.preserveEllipticalArcs, this.allowSharpestCorners,
    );
  }
  /** Copy values of input options */
  public setFrom(other: JointOptions) {
    this.leftOffsetDistance = other.leftOffsetDistance;
    this.minArcDegrees = other.minArcDegrees;
    this.maxChamferTurnDegrees = other.maxChamferTurnDegrees;
    this.preserveEllipticalArcs = other.preserveEllipticalArcs;
    this.allowSharpestCorners = other.allowSharpestCorners;
  }
  /**
   * Parse a number or JointOptions up to JointOptions:
   * * If leftOffsetDistanceOptions is a number, create a JointOptions with other options set to default values.
   * * If leftOffsetDistanceOrOptions is a JointOptions, return it unchanged.
   * @param leftOffsetDistanceOrOptions
   */
  public static create(leftOffsetDistanceOrOptions: number | JointOptions): JointOptions {
    if (leftOffsetDistanceOrOptions instanceof JointOptions)
      return leftOffsetDistanceOrOptions;
    return new JointOptions(leftOffsetDistanceOrOptions);
  }
  /** Return true if the options indicate this amount of turn should be handled with an arc. */
  public needArc(theta: Angle): boolean {
    return Math.abs(theta.degrees) >= this.minArcDegrees;
  }
  /** Return the number of corners needed to chamfer the given turn angle. */
  public numChamferPoints(theta: Angle): number {
    const degrees = Math.abs(theta.degrees);
    const minStepDegreesClamp = 10;
    let maxStepDegreesClamp = 120;
    if (this.allowSharpestCorners) {
      maxStepDegreesClamp = this.maxChamferTurnDegrees;
    }
    const stepDegrees = Geometry.clamp(this.maxChamferTurnDegrees, minStepDegreesClamp, maxStepDegreesClamp);
    if (degrees <= stepDegrees)
      return 1;
    return Math.ceil(degrees / stepDegrees);
  }
}

/**
 * Options for offsetting a curve, used in offset construction methods such as [[CurvePrimitive.constructOffsetXY]], [[RegionOps.constructPolygonWireXYOffset]] and [[Region.Ops.constructCurveXYOffset]].
 * @public
 */
export class OffsetOptions {
  /** Options for offsetting and joining CurvePrimitives */
  public jointOptions: JointOptions;
  /** Options for generating a B-spline curve offset */
  public strokeOptions: StrokeOptions;
  /** Options that are provided are captured. */
  constructor(offsetDistanceOrOptions: number | JointOptions, strokeOptions?: StrokeOptions) {
    this.jointOptions = JointOptions.create(offsetDistanceOrOptions);
    this.strokeOptions = (strokeOptions !== undefined) ? strokeOptions : StrokeOptions.createForCurves();
  }
  public get minArcDegrees(): number {
    return this.jointOptions.minArcDegrees;
  }
  public set minArcDegrees(value: number) {
    this.jointOptions.minArcDegrees = value;
  }
  public get maxChamferTurnDegrees(): number {
    return this.jointOptions.maxChamferTurnDegrees;
  }
  public set maxChamferTurnDegrees(value: number) {
    this.jointOptions.maxChamferTurnDegrees = value;
  }
  public get allowSharpestCorners(): boolean {
    return this.jointOptions.allowSharpestCorners;
  }
  public set allowSharpestCorners(value: boolean) {
    this.jointOptions.allowSharpestCorners = value;
  }
  public get leftOffsetDistance(): number {
    return this.jointOptions.leftOffsetDistance;
  }
  public set leftOffsetDistance(value: number) {
    this.jointOptions.leftOffsetDistance = value;
  }
  public get preserveEllipticalArcs(): boolean {
    return this.jointOptions.preserveEllipticalArcs;
  }
  public set preserveEllipticalArcs(value: boolean) {
    this.jointOptions.preserveEllipticalArcs = value;
  }
  /**
   * Convert variant input into OffsetOptions.
   * * If a JointOptions is provided, it is captured.
   * * If an OffsetOptions is provided, a reference to it is returned.
   */
  public static create(offsetDistanceOrOptions: number | JointOptions | OffsetOptions): OffsetOptions {
    if (offsetDistanceOrOptions instanceof OffsetOptions)
      return offsetDistanceOrOptions;
    return new OffsetOptions(offsetDistanceOrOptions);
  }
  /** Convert variant input into offset distance */
  public static getOffsetDistance(offsetDistanceOrOptions: number | JointOptions | OffsetOptions): number {
    if (typeof offsetDistanceOrOptions === "number")
      return offsetDistanceOrOptions;
    return offsetDistanceOrOptions.leftOffsetDistance;
  }
  /** Return a deep clone. */
  public clone(): OffsetOptions {
    return new OffsetOptions(this.jointOptions.clone(), this.strokeOptions.clone());
  }
}
