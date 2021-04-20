/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { CurvePrimitive } from "../CurvePrimitive";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
import { TransitionConditionalProperties } from "./TransitionConditionalProperties";
import { Geometry } from "../../Geometry";
import { LineString3d } from "../LineString3d";
/**
 * This is the set of valid type names for "integrated" spirals
 * * Behavior is expressed by a `NormalizedTransition` snap function.
 * * The snap function varies smoothly from f(0)=0 to f(1)=1
 * * The various snap functions are:
 *   * clothoid: linear
 *   * biquadratic: 2 quadratics pieced together, joining with 1st derivative continuity at f(0.) = 0.5, with zero slope f'(0)=0 and f'(1)= 0
 *   * bloss: A single cubic with zero slope at 0 and 1
 *   * cosine: half of a cosine wave, centered around 0.5
 *   * sine: full period of a sine wave added to the line f(u)=u
 * *
 * @public
 */
export type IntegratedSpiralTypeName = "clothoid" | "bloss" | "biquadratic" | "cosine" | "sine";

/**
 * This is the set of valid type names for "direct" spirals.
 * "Direct" spirals can evaluate fractionToPoint by direct equations, i.e. not requiring the numeric integrations in "Integrated" spiral types.
 * @public
 */
export type DirectSpiralTypeName =
   "JapaneseCubic"  // 1 term from each of the X,Y clothoid series expansions:  y = x^3 / (6RL)
  | "Arema"       // 2 terms from each of the X,Y clothoid series expansions.  Identical to ChineseCubic!
  | "ChineseCubic"  // Identical to Arema!
  | "HalfCosine"  // high continuity cosine variation from quadratic.
  | "AustralianRailCorp" // cubic with high accuracy distance series
  | "WesternAustralian"  // simple cubic -- 2 terms of x series, 1 term of y series.
  | "Czech"  // simple cubic with two term distance approximation
  | "MXCubicAlongArc"  // x obtained from fractional distance via 2-terms from series, y = x^3/ (6RL)
  | "Polish"
  | "Italian"
  ;

/**
 * TransitionSpiral3d is a base class for multiple variants of spirals.
 * * The menagerie of spiral types have 2 broad categories:
 *   * IntegratedSpiral3d -- a spiral whose direct function for curvature versus distance must be integrated to determine x,y
 *     * The IntegratedSpiral3d types are enumerated in `IntegratedSpiralTypes`
 *   * DirectSpiral3d -- a spiral implemented with direct calculation of x,y from fractional position along the spiral.
 *     * The direct spiral types are enumerated in the `DirectSpiralType`
 * * The method set for CurvePrimitive support includes a `handleTransitionSpiral(g: TransitionSpiral3d)` which receives all the spiral types.
 * * The spiral class may impose expectations that its inflection is at the origin, with tangent along the x axis.
 *   * This is generally necessary for direct spirals.
 *   * This is not necessary for integrated spirals.
 * @public
 */
export abstract class TransitionSpiral3d extends CurvePrimitive {
  /** string name of spiral type */
  protected _spiralType: string;
  /** Original defining properties. */
  protected _designProperties: TransitionConditionalProperties | undefined;

  /** Fractional interval for the "active" part of a containing spiral.
   * (The radius, angle, and length conditions define a complete spiral, and some portion of it is "active")
   */
  protected _activeFractionInterval: Segment1d;
  /** Return (reference to) the active portion of the reference spiral. */
  public get activeFractionInterval(): Segment1d { return this._activeFractionInterval; }
  /** strokes in the active portion */
  public abstract get activeStrokes(): LineString3d;
  /** Placement transform */
  protected _localToWorld: Transform;
  /** (reference to) placement transform. */
  public get localToWorld(): Transform { return this._localToWorld; }

  protected constructor(spiralType: string | undefined, localToWorld: Transform, activeFractionInterval: Segment1d | undefined, designProperties: TransitionConditionalProperties | undefined) {
    super();
    this._spiralType = spiralType ? spiralType : "unknownSpiralType";
    this._designProperties = designProperties;
    this._localToWorld = localToWorld;
    this._activeFractionInterval = activeFractionInterval ? activeFractionInterval : Segment1d.create(0, 1);
  }

  public get spiralType(): string { return this._spiralType; }
  /** Return 1/r with convention that if true zero is given as radius it represents infinite radius (0 curvature, straight line) */
  public static radiusToCurvature(radius: number): number { return (radius === 0.0) ? 0.0 : 1.0 / radius; }

  /** Return 1/k with convention that if near-zero is given as curvature, its infinite radius is returned as 0 */
  public static curvatureToRadius(curvature: number): number {
    if (Math.abs(curvature) < Geometry.smallAngleRadians)
      return 0.0;
    return 1.0 / curvature;
  }

  /** Return the average of the start and end curvatures. */
  public static averageCurvature(radiusLimits: Segment1d): number {
    return 0.5 * (TransitionSpiral3d.radiusToCurvature(radiusLimits.x0) + TransitionSpiral3d.radiusToCurvature(radiusLimits.x1));
  }
  /**
   * Given two radii (or zeros for 0 curvature) return the average curvature
   * @param r0 start radius, or 0 for line
   * @param r1 end radius, or 0 for line
   */
  public static averageCurvatureR0R1(r0: number, r1: number): number {
    return 0.5 * (TransitionSpiral3d.radiusToCurvature(r0) + TransitionSpiral3d.radiusToCurvature(r1));
  }
  /**
   * Given two radii (or zeros for 0 curvature) return the average curvature
   * @param r0 start radius, or 0 for line
   * @param r1 end radius, or 0 for line
   */
  public static interpolateCurvatureR0R1(r0: number, fraction: number, r1: number): number {
    return Geometry.interpolate(TransitionSpiral3d.radiusToCurvature(r0), fraction, TransitionSpiral3d.radiusToCurvature(r1));
  }

  /** Return the arc length of a transition spiral with given sweep and radius pair. */
  public static radiusRadiusSweepRadiansToArcLength(radius0: number, radius1: number, sweepRadians: number): number {
    return Math.abs(sweepRadians / TransitionSpiral3d.averageCurvatureR0R1(radius0, radius1));
  }

  /** Return the turn angle for spiral of given length between two radii */
  public static radiusRadiusLengthToSweepRadians(radius0: number, radius1: number, arcLength: number): number {
    return TransitionSpiral3d.averageCurvatureR0R1(radius0, radius1) * arcLength;
  }

  /** Return the end radius for spiral of given start radius, length, and turn angle. */
  public static radius0LengthSweepRadiansToRadius1(radius0: number, arcLength: number, sweepRadians: number) {
    return TransitionSpiral3d.curvatureToRadius((2.0 * sweepRadians / arcLength) - TransitionSpiral3d.radiusToCurvature(radius0));
  }
  /** Return the start radius for spiral of given end radius, length, and turn angle. */
  public static radius1LengthSweepRadiansToRadius0(radius1: number, arcLength: number, sweepRadians: number) {
    return TransitionSpiral3d.curvatureToRadius((2.0 * sweepRadians / arcLength) - TransitionSpiral3d.radiusToCurvature(radius1));
  }
  /** Return the original defining properties (if any) saved by the constructor. */
  public get designProperties(): TransitionConditionalProperties | undefined { return this._designProperties; }
  /**
   * * If transformA is rigid with uniform scale, apply the rigid part of transformA to the localToWorld transform and return the scale and rigid separation.
   * * If not rigid, do nothing and return undefined.
   * * Also apply the scale factor to the designProperties.
   * @param transformA
   */
  protected applyRigidPartOfTransform(transformA: Transform): { rigidAxes: Matrix3d, scale: number } | undefined {
    const rigidData = transformA.matrix.factorRigidWithSignedScale();
    if (rigidData !== undefined) {
      // [sQ a][R b] = [sQ*R sQb+a]
      // but we save it as [Q*R sQb+a] with spiral data scaled by s.
      const transformC0 = transformA.multiplyTransformTransform(this.localToWorld);
      // BUT pull the scale part out of the matrix ...
      const matrixC = rigidData.rigidAxes.multiplyMatrixMatrix(this.localToWorld.matrix);
      this._localToWorld = Transform.createOriginAndMatrix(transformC0.origin, matrixC);
      if (this.designProperties)
        this.designProperties.applyScaleFactor(rigidData.scale);

      return rigidData;
    }
    return undefined;
  }
}
