/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { Geometry, AxisOrder } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Angle } from "../geometry3d/Angle";
import { Segment1d, Point3d } from "../geometry3d/PointVector";
import { Range3d } from "../geometry3d/Range";
import { Transform, Matrix3d } from "../geometry3d/Transform";
import { Quadrature } from "../numerics/Quadrature";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { StrokeOptions } from "./StrokeOptions";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";

import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { IStrokeHandler } from "../geometry3d/GeometryHandler";
import { LineString3d } from "./LineString3d";
// import {} from "./";

/** A transition spiral is a curve defined by its curvature, with the curvature function symmetric about midpoint.
 * * The symmetry condition creates a relationship among the following 4 quantities:
 * ** curvature0 = curvature (i.e. 1/radius) at start
 * ** curvature1 = curvature (i.e. 1/radius) at end
 * ** sweepRadians = signed turning angle from start to end
 * ** arcLength = length of curve
 * * The relationship is the equation
 * ** `sweepRadians = arcLength * average Curvature = arcLength * 0.5 * (curvature0 + curvature1)`
 * * That is, regardless of any curvature properties other than symmetry, specifying any 3 of the quantities fully determines the remaining one.
 */
export class TransitionConditionalProperties {
  public radius0: number | undefined;
  public radius1: number | undefined;
  public bearing0: Angle | undefined;
  public bearing1: Angle | undefined;
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
    arcLength: number | undefined,
  ) {
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
  /** Examine which properties are defined and compute the (single) undefined.
   * @returns Return true if the input state had precisely one undefined member.
   */
  public tryResolveAnySingleUnknown(): boolean {
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

    if (this.bearing0) {// bearing 1 is undefined
      this.bearing1 = Angle.createRadians(this.bearing0.radians + TransitionSpiral3d.radiusRadiusLengthToSweepRadians(this.radius0, this.radius1, this.curveLength));
      return true;
    }

    if (this.bearing1) {// bearing 0 is undefined
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
  public isAlmostEqual(other: TransitionConditionalProperties) {
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
}

export class TransitionSpiral3d extends CurvePrimitive {
  // return 1/r with convention that if true zero is given as radius it represents infinite radius (0 curvature, straight line)
  public static radiusToCurvature(radius: number): number { return (radius === 0.0) ? 0.0 : 1.0 / radius; }

  // return 1/k with convention that if near-zero is given as curvature, its infinite radius is returned as 0
  public static curvatureToRadius(curvature: number): number {
    if (Math.abs(curvature) < Geometry.smallAngleRadians)
      return 0.0;
    return 1.0 / curvature;
  }

  // return the average curvature for two limit values.
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

  public static radiusRadiusSweepRadiansToArcLength(radius0: number, radius1: number, sweepRadians: number): number {
    return Math.abs(sweepRadians / TransitionSpiral3d.averageCurvatureR0R1(radius0, radius1));
  }

  public static radiusRadiusLengthToSweepRadians(radius0: number, radius1: number, arcLength: number): number {
    return TransitionSpiral3d.averageCurvatureR0R1(radius0, radius1) * arcLength;
  }

  public static radius0LengthSweepRadiansToRadius1(radius0: number, arcLength: number, sweepRadians: number) {
    return TransitionSpiral3d.curvatureToRadius((2.0 * sweepRadians / arcLength) - TransitionSpiral3d.radiusToCurvature(radius0));
  }

  public static radius1LengthSweepRadiansToRadius0(radius1: number, arcLength: number, sweepRadians: number) {
    return TransitionSpiral3d.curvatureToRadius((2.0 * sweepRadians / arcLength) - TransitionSpiral3d.radiusToCurvature(radius1));
  }

  public activeFractionInterval: Segment1d;
  public radius01: Segment1d;
  public bearing01: AngleSweep;
  public localToWorld: Transform;
  private _strokes: LineString3d;
  private _arcLength01: number;
  private _curvature01: Segment1d;
  private _spiralType: string | undefined;
  private _properties: TransitionConditionalProperties | undefined;
  // constructor demands all bearing, radius, and length data -- caller determines usual dependency of "any 4 determine the 5th"
  constructor(spiralType: string | undefined,
    radius01: Segment1d,
    bearing01: AngleSweep,
    activeFractionInterval: Segment1d,
    localToWorld: Transform,
    arcLength: number,
    properties: TransitionConditionalProperties | undefined) {
    super();
    this._spiralType = spiralType;
    this.localToWorld = localToWorld;
    this.radius01 = radius01;
    this.bearing01 = bearing01;
    this.localToWorld = localToWorld;
    this.activeFractionInterval = activeFractionInterval;
    this._arcLength01 = arcLength;
    this._strokes = LineString3d.create();
    // initialize for compiler -- but this will be recomputed in refreshComputeProperties ...
    this._curvature01 = Segment1d.create(0, 1);
    this.refreshComputedProperties();
    this._properties = properties;
  }
  /** Return the origial defining properties (if any) saved by the constructor. */
  public get originalProperties(): TransitionConditionalProperties | undefined { return this._properties; }
  public static readonly defaultSpiralType = "clothoid";
  /** return the spiral type as a string (undefined resolves to default type "clothoid") */
  public getSpiralType(): string { if (this._spiralType === undefined) return TransitionSpiral3d.defaultSpiralType; return this._spiralType; }
  /** Return the bearing at given fraction .... */
  public fractionToBearingRadians(fraction: number): number {
    // BUG? active interval?
    return this.bearing01.startRadians + fraction * (this._curvature01.x0 + 0.5 * fraction * (this._curvature01.x1 - this._curvature01.x0));
  }
  /** Return the curvature at given fraction ... */
  public fractionToCurvature(fraction: number): number {
    // BUG? active interval
    return this._curvature01.fractionToPoint(fraction);
  }

  // These static variables are reused on calls to integrateFromStartFraction
  private static _gaussFraction: Float64Array;
  private static _gaussWeight: Float64Array;
  private static _gaussMapper: (xA: number, xB: number, arrayX: Float64Array, arrayW: Float64Array) => number;
  public static initWorkSpace() {
    TransitionSpiral3d._gaussFraction = new Float64Array(5);
    TransitionSpiral3d._gaussWeight = new Float64Array(5);
    TransitionSpiral3d._gaussMapper = Quadrature.setupGauss5;
  }
  /** Evaluate and sum the gauss quadrature formulas to integrate cos(theta), sin(theta) fractional subset of a reference length.
   * (recall that theta is a nonlinear function of the fraction.)
   * * This is a single interval of gaussian integration.
   * * The fraction is on the full spiral (not in the mapped active interval)
   * @param xyz advancing integrated point.
   * @param fractionA fraction at start of interval
   * @param fractionB fraction at end of interval.
   * @param unitArcLength length of curve for 0 to 1 fractional
   */
  private fullSpiralIncrementalIntegral(xyz: Point3d, fractionA: number, fractionB: number) {
    const gaussFraction = TransitionSpiral3d._gaussFraction;
    const gaussWeight = TransitionSpiral3d._gaussWeight;
    const numEval = TransitionSpiral3d._gaussMapper(fractionA, fractionB, gaussFraction, gaussWeight);
    const deltaL = this._arcLength01;
    let w = 0;
    for (let k = 0; k < numEval; k++) {
      const radians = this.fractionToBearingRadians(gaussFraction[k]);
      w = gaussWeight[k] * deltaL;
      xyz.x += w * Math.cos(radians);
      xyz.y += w * Math.sin(radians);
    }

  }
  public refreshComputedProperties() {
    this._curvature01 = Segment1d.create(
      TransitionSpiral3d.radiusToCurvature(this.radius01.x0),
      TransitionSpiral3d.radiusToCurvature(this.radius01.x1));
    this._strokes.clear();
    const currentPoint = Point3d.create();
    this._strokes.appendStrokePoint(currentPoint);
    const numInterval = 8;

    const fractionStep = 1.0 / numInterval;
    for (let i = 1; i <= numInterval; i++) {
      const fraction0 = (i - 1) * fractionStep;
      const fraction1 = i * fractionStep;
      this.fullSpiralIncrementalIntegral(currentPoint, fraction0, fraction1);
      this._strokes.appendStrokePoint(currentPoint);
    }
    this._strokes.tryTransformInPlace(this.localToWorld);
  }
  /**
   * Create a transition spiral with radius and bearing conditions.
   * @param radius01 radius (inverse curvature) at start and end. (radius of zero means straight line)
   * @param bearing01 bearing angles at start and end.  bearings are measured from the x axis, positive clockwise towards y axis
   * @param activeFractionInterval fractional limits of the active portion of the spiral.
   * @param localToWorld placement frame.  Fractional coordinate 0 is at the origin.
   */
  public static createRadiusRadiusBearingBearing(radius01: Segment1d, bearing01: AngleSweep, activeFractionInterval: Segment1d, localToWorld: Transform) {
    const arcLength = TransitionSpiral3d.radiusRadiusSweepRadiansToArcLength(radius01.x0, radius01.x1, bearing01.sweepRadians);
    return new TransitionSpiral3d("clothoid",
      radius01.clone(),
      bearing01.clone(), activeFractionInterval.clone(), localToWorld.clone(), arcLength,
      new TransitionConditionalProperties(radius01.x0, radius01.x1,
        bearing01.startAngle.clone(), bearing01.endAngle.clone(),
        undefined));
  }
  /**
   * Create a transition spiral.
   * * Inputs must provide exactly 4 of the 5 values `[radius0,radius1,bearing0,bearing1,length`.
   * @param spiralType one of "clothoid", "bloss", "biquadratic", "cosine", "sine".  If undefined, "clothoid" is used.
   * @param radius0 radius (or 0 for tangent to line) at start
   * @param radius1 radius (or 0 for tangent to line) at end
   * @param bearing0 bearing, measured CCW from x axis at start.
   * @param bearing1 bearing, measured CCW from x axis at end.
   * @param fractionInterval optional fractional interval for an "active" portion of the curve.   if omitted, the full [0,1] is used.
   * @param localToWorld placement transform
   */
  public static create(
    spiralType: string | undefined,
    radius0: number | undefined,
    radius1: number | undefined,
    bearing0: Angle | undefined,
    bearing1: Angle | undefined,
    arcLength: number | undefined,
    fractionInterval: undefined | Segment1d,
    localToWorld: Transform): TransitionSpiral3d | undefined {
    const data = new TransitionConditionalProperties(radius0, radius1, bearing0, bearing1, arcLength);
    const data1 = data.clone();
    if (!data.tryResolveAnySingleUnknown())
      return undefined;
    if (fractionInterval === undefined)
      fractionInterval = Segment1d.create(0, 1);
    return new TransitionSpiral3d(
      spiralType,
      Segment1d.create(data.radius0, data.radius1),
      AngleSweep.createStartEnd(data.bearing0!, data.bearing1!),
      fractionInterval ? fractionInterval.clone() : Segment1d.create(0, 1),
      localToWorld, data.curveLength!, data1);
  }

  public setFrom(other: TransitionSpiral3d): TransitionSpiral3d {
    this.localToWorld.setFrom(other.localToWorld);
    this.radius01.setFrom(other.radius01);
    this.radius01.setFrom(other.radius01);
    this.bearing01.setFrom(other.bearing01);
    this.localToWorld.setFrom(other.localToWorld);
    return this;
  }
  public clone(): TransitionSpiral3d {
    return TransitionSpiral3d.createRadiusRadiusBearingBearing(this.radius01, this.bearing01, this.activeFractionInterval, this.localToWorld);
  }

  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this.localToWorld, this.localToWorld);
    return true;
  }
  public cloneTransformed(transform: Transform): TransitionSpiral3d {
    const result = this.clone();
    result.tryTransformInPlace(transform);  // ok, we're confident it will always work.
    return result;
  }

  public startPoint(): Point3d { return this._strokes.startPoint(); }
  public endPoint(): Point3d { return this._strokes.endPoint(); }
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return plane.isPointInPlane(this.localToWorld.origin as Point3d)
      && Geometry.isSameCoordinate(0.0, this.localToWorld.matrix.dotColumnX(plane.getNormalRef()))
      && Geometry.isSameCoordinate(0.0, this.localToWorld.matrix.dotColumnY(plane.getNormalRef()));
  }
  /** Return length of the spiral.  Because TransitionSpiral is parameterized directly in terms of distance along, this is a simple return value. */
  public quickLength() { return this._arcLength01; }
  /** Return length of the spiral.  Because TransitionSpiral is parameterized directly in terms of distance along, this is a simple return value. */
  public curveLength() { return this._arcLength01; }
  public isSameGeometryClass(other: any): boolean { return other instanceof TransitionSpiral3d; }
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void { this._strokes.emitStrokes(dest, options); }
  public emitStrokableParts(dest: IStrokeHandler, options?: StrokeOptions): void {
    dest.startParentCurvePrimitive(this);
    this._strokes.emitStrokableParts(dest, options);
    dest.endParentCurvePrimitive(this);
  }
  // hm.. nothing to do but reverse the interval . . . maybe that's cheesy . . .
  public reverseInPlace(): void {
    this.activeFractionInterval.reverseInPlace();
    this._strokes.reverseInPlace();
  }
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    fraction = Geometry.clampToStartEnd(fraction, 0, 1);
    const numStrokes = this._strokes.points.length - 1;
    const index0 = Math.trunc(fraction * numStrokes); // This indexes the point to the left of the query
    const fraction0 = index0 / numStrokes;
    result = result ? result : new Point3d();
    result.setFrom(this._strokes.points[index0]);
    const globalFraction0 = this.activeFractionInterval.fractionToPoint(fraction0);
    const globalFraction1 = this.activeFractionInterval.fractionToPoint(fraction);
    this.fullSpiralIncrementalIntegral(result, globalFraction0, globalFraction1);
    this.localToWorld.multiplyPoint3d(result, result);
    return result;
  }
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    this.fractionToPoint(fraction, result.origin);
    const radians = this.fractionToBearingRadians(fraction);
    const a = this._arcLength01;
    this.localToWorld.matrix.multiplyXY(a * Math.cos(radians), a * Math.sin(radians), result.direction);
    return result;
  }

  /** Return the frenet frame at fractional position. */
  public fractionToFrenetFrame(fraction: number, result?: Transform): Transform {
    result = result ? result : Transform.createIdentity();
    result.origin.setFrom(this.fractionToPoint(fraction));
    Matrix3d.createRigidFromMatrix3d(this.localToWorld.matrix, AxisOrder.XYZ, result.matrix);

    const radians = this.fractionToBearingRadians(fraction);
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    result.matrix.applyGivensColumnOp(0, 1, c, -s);
    return result;
  }
  /** Return a plane with
   *
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to the fraction.
   * * vectorV is the second derivative, i.e.derivative of vectorU.
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined {
    const origin = this.fractionToPoint(fraction);
    const radians = this.fractionToBearingRadians(fraction);
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const vectorX = this.localToWorld.matrix.multiplyXY(c, s);
    const vectorY = this.localToWorld.matrix.multiplyXY(-s, c);
    vectorY.scaleInPlace(this.fractionToCurvature(fraction));
    return Plane3dByOriginAndVectors.createCapture(origin, vectorX, vectorY, result);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleTransitionSpiral(this);
  }
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this._strokes.extendRange(rangeToExtend, transform);
  }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof TransitionSpiral3d) {
      return this.radius01.isAlmostEqual(other.radius01)
        && this.bearing01.isAlmostEqualAllowPeriodShift(other.bearing01)
        && this.localToWorld.isAlmostEqual(other.localToWorld)
        && Geometry.isSameCoordinate(this._arcLength01, other._arcLength01)
        && this._curvature01.isAlmostEqual(other._curvature01);
    }
    return false;
  }

}
// at load time, initialize gauss quadrature workspace
TransitionSpiral3d.initWorkSpace();
