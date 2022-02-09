/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { StrokeOptions } from "./StrokeOptions";

/** @packageDocumentation
 * @module Curve
 */

/**
 * * Control parameters for joint construction.
 * * Decision order is:
 *   * if turn angle is greater than minArcDegrees, make an arc.
 *   * if turn angle is less than or equal maxChamferTurnDegrees, extend curves along tangent to single intersection point.
 *   * if turn angle is greater than maxChamferTurnDegrees,  construct multiple lines that are tangent to the turn circle "from the outside",
 *           with each equal turn less than maxChamferTurnDegrees.
 *   * otherwise make single edge.
 * @public
 */
 export class JointOptions {
  /** smallest arc to construct.
   * * If this control angle is large, arcs are never created.
   */
  public minArcDegrees = 180.0;
  public maxChamferTurnDegrees = 90;
  /** Offset distance, positive to left of base curve. */
  public leftOffsetDistance: number = 0;
  /** Whether to offset elliptical arcs as elliptical arcs (true) or as B-spline curves (false, default). */
  public preserveEllipticalArcs = false;

  /** Construct JointOptions.
   * * leftOffsetDistance is required
   * * minArcDegrees and maxChamferDegrees are optional.
   */
  constructor(leftOffsetDistance: number, minArcDegrees = 180, maxChamferDegrees = 90, preserveEllipticalArcs = false) {
    this.leftOffsetDistance = leftOffsetDistance;
    this.minArcDegrees = minArcDegrees;
    this.maxChamferTurnDegrees = maxChamferDegrees;
    this.preserveEllipticalArcs = preserveEllipticalArcs;
  }

  /** Return a deep clone. */
  public clone(): JointOptions {
    return new JointOptions(this.leftOffsetDistance, this.minArcDegrees, this.maxChamferTurnDegrees, this.preserveEllipticalArcs);
  }

  /** Copy values of input options */
  public setFrom(other: JointOptions) {
    this.leftOffsetDistance = other.leftOffsetDistance;
    this.minArcDegrees = other.minArcDegrees;
    this.maxChamferTurnDegrees = other.maxChamferTurnDegrees;
    this.preserveEllipticalArcs = other.preserveEllipticalArcs;
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
    // if (Number.isFinite(leftOffsetDistanceOrOptions))
    return new JointOptions(leftOffsetDistanceOrOptions);
  }
  /** return true if the options indicate this amount of turn should be handled with an arc. */
  public needArc(theta: Angle): boolean {
    return Math.abs(theta.degrees) >= this.minArcDegrees;
  }
  /** Test if turn by theta should be output as single point. */
  public numChamferPoints(theta: Angle): number {
    const degrees = Math.abs(theta.degrees);
    const stepDegrees = Geometry.clamp(this.maxChamferTurnDegrees, 10, 120);
    if (degrees <= stepDegrees)
      return 1;
    return Math.ceil(degrees / stepDegrees);
  }
}

/**
 * Options for offsetting a curve.
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

  public get minArcDegrees(): number { return this.jointOptions.minArcDegrees; }
  public set minArcDegrees(value: number) { this.jointOptions.minArcDegrees = value; }
  public get maxChamferTurnDegrees(): number { return this.jointOptions.maxChamferTurnDegrees; }
  public set maxChamferTurnDegrees(value: number) { this.jointOptions.maxChamferTurnDegrees = value; }
  public get leftOffsetDistance(): number { return this.jointOptions.leftOffsetDistance; }
  public set leftOffsetDistance(value: number) { this.jointOptions.leftOffsetDistance = value; }
  public get preserveEllipticalArcs(): boolean { return this.jointOptions.preserveEllipticalArcs; }
  public set preserveEllipticalArcs(value: boolean) { this.jointOptions.preserveEllipticalArcs = value; }

  /** Convert variant input into OffsetOptions.
   * * If a JointOptions is provided, it is captured.
   * * If an OffsetOptions is provided, a reference to it is returned. */
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
