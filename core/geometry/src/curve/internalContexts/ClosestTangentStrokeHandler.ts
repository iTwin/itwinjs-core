/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { IStrokeHandler } from "../../geometry3d/GeometryHandler";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Newton1dUnboundedApproximateDerivative } from "../../numerics/Newton";
import { VariantCurveExtendParameter } from "../CurveExtendMode";
import { CurveLocationDetail } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { NewtonRtoRStrokeHandler } from "./NewtonRtoRStrokeHandler";

/**
 * Context for searching for the closest tangent to a CurvePrimitive.
 * @internal
 */
export class ClosestTangentStrokeHandler extends NewtonRtoRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _closestTangents: CurveLocationDetail[];
  private _spacePoint: Point3d;
  private _normal: Vector3d;
  private _extend: VariantCurveExtendParameter;
  // fraction and function value on one side of an interval that may bracket a root
  private _fractionA: number = 0;
  private _functionA: number = 0;
  // fraction and function value on the other side of an interval that may bracket a root
  private _fractionB: number = 0;
  private _functionB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars to use within methods
  private _workRay: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;
  /** Constructor */
  public constructor(
    spacePoint: Point3d, normal?: Vector3d, extend?: VariantCurveExtendParameter,
  ) {
    super();
    this._spacePoint = spacePoint;
    this._normal = normal ?? Vector3d.unitZ();
    this._closestTangents = [];
    this._workRay = Ray3d.createZero();
    this._extend = extend ?? false;
    this.startCurvePrimitive(undefined);
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }
  public claimResult(): CurveLocationDetail[] {
    return this._closestTangents;
  }
  public findClosestTangentIndex(hintPoint: Point3d): number {
    let minDistance = Number.MAX_VALUE;
    let minIndex = -1;
    for (let i = 0; i < this._closestTangents.length; i++) {
      const distance = this._closestTangents[i].point.distance(hintPoint);
      if (distance < minDistance) {
        minDistance = distance;
        minIndex = i;
      }
    }
    return minIndex;
  }
  public needPrimaryGeometryForStrokes() {
    return true;
  }
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
    this._fractionA = 0.0;
    this._numThisCurve = 0;
    this._functionA = 0.0;
  }
  public endCurvePrimitive() {
  }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive, numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    this.startCurvePrimitive(cp);
    if (numStrokes < 1)
      numStrokes = 1;
    const df = 1.0 / numStrokes;
    for (let i = 0; i <= numStrokes; i++) {
      const fraction = Geometry.interpolate(fraction0, i * df, fraction1);
      cp.fractionToPointAndDerivative(fraction, this._workRay);
      this.announceRay(fraction, this._workRay);
    }
  }
  private announceCandidate(cp: CurvePrimitive, fraction: number, point: Point3d) {
    if (this._closestTangents.length > 0) { // avoid adding duplicate tangents
      const lastFraction = this._closestTangents[this._closestTangents.length - 1].fraction;
      if (fraction === lastFraction)
        return;
    }
    const closestTangent = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point);
    if (this._parentCurvePrimitive !== undefined)
      closestTangent.curve = this._parentCurvePrimitive;
    this._closestTangents?.push(closestTangent);
  }
  public announceSegmentInterval(
    cp: CurvePrimitive, point0: Point3d, point1: Point3d, _numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    let fraction: number;
    let point: Point3d;
    const distance0 = this._spacePoint.distance(point0);
    const distance1 = this._spacePoint.distance(point1);
    if (distance0 < distance1) {
      fraction = fraction0;
      point = point0;
    } else {
      fraction = fraction1;
      point = point1;
    }
    const value = this.evaluateFunction(undefined, (fraction0 + fraction1) / 2, cp);
    if (!value)
      this.announceCandidate(cp, fraction, point);
  }
  /**
   * Given a function `f` and (unordered) fractions `a` and `b`, search for and announce a root of `f` in this
   * fractional interval.
   * * This method searches for a root of `f` if and only if the stroke segment defined by `(a, f(a))` and
   * `(b, f(b))` has a root. This is a HEURISTIC: given continuous `f` between `a` and `b`, a root of the stroke
   * segment implies a root of `f`, but not vice-versa. Therefore, if the strokes are not sufficiently dense,
   * this method can miss a root of `f`.
   */
  private searchInterval() {
    if (Math.abs(this._functionA) < Geometry.smallMetricDistanceSquared)
      this.announceSolutionFraction(this._fractionA);
    if (Math.abs(this._functionB) < Geometry.smallMetricDistanceSquared)
      this.announceSolutionFraction(this._fractionB);
    // by the Intermediate Value Theorem, a root lies between fractionA and fractionB; use Newton to find it.
    if (this._functionA * this._functionB < 0) {
      const fraction = Geometry.inverseInterpolate(this._fractionA, this._functionA, this._fractionB, this._functionB);
      if (fraction) {
        this._newtonSolver.setX(fraction);
        if (this._newtonSolver.runIterations())
          this.announceSolutionFraction(this._newtonSolver.getX());
      }
    }
  }
  private announceSolutionFraction(fraction: number) {
    if (this._curve)
      this.announceCandidate(this._curve, fraction, this._curve.fractionToPoint(fraction));
  }
  /**
   * Evaluate the univariate real-valued function for which we are finding roots.
   * * For finding the tangents to curve X from point Q as seen in a view plane perpendicular to normal, this
   * function is `f(t) := (Q - X(t)) dot (X'(t) cross normal)`.
   * * Either `pointAndDerivative` must be defined, or both `fraction` and `curve`.
   * @param pointAndDerivative pre-evaluated curve
   * @param fraction fraction at which to evaluate `curve`
   * @param curve curve to evaluate at `fraction`
  */
  private evaluateFunction(pointAndDerivative?: Ray3d, fraction?: number, curve?: CurvePrimitive): number | undefined {
    if (pointAndDerivative)
      this._workRay.setFrom(pointAndDerivative);
    else if (fraction !== undefined && curve)
      this._workRay = curve.fractionToPointAndDerivative(fraction, this._workRay);
    else
      return undefined;
    const cross = this._normal.crossProduct(this._workRay.direction);
    return cross.dotProductStartEnd(this._workRay.origin, this._spacePoint);
  }
  public evaluate(fraction: number): boolean {
    let curve = this._curve;
    if (this._parentCurvePrimitive)
      curve = this._parentCurvePrimitive;
    const value = this.evaluateFunction(undefined, fraction, curve);
    if (value === undefined)
      return false;
    this.currentF = value;
    return true;
  }
  private announceRay(fraction: number, data: Ray3d): void {
    this._functionB = this.evaluateFunction(data)!;
    this._fractionB = fraction;
    if (this._numThisCurve++ > 0) // after the first stroke point, a stroke segment is defined, so we have an interval
      this.searchInterval();
    this._functionA = this._functionB;
    this._fractionA = this._fractionB;
  }
  public announcePointTangent(point: Point3d, fraction: number, tangent: Vector3d) {
    this._workRay.set(point, tangent);
    this.announceRay(fraction, this._workRay);
  }
}
