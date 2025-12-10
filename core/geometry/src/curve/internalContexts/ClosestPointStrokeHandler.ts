/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { assert } from "@itwin/core-bentley";
import { Geometry } from "../../Geometry";
import { IStrokeHandler } from "../../geometry3d/GeometryHandler";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Newton1dUnboundedApproximateDerivative } from "../../numerics/Newton";
import { SmallSystem } from "../../numerics/SmallSystem";
import { Arc3d } from "../Arc3d";
import { CurveExtendMode, CurveExtendOptions, VariantCurveExtendParameter } from "../CurveExtendMode";
import { CurveLocationDetail } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { NewtonRtoRStrokeHandler } from "./NewtonRtoRStrokeHandler";

/**
 * Context for searching for the closest point to a CurvePrimitive.
 * @internal
 */
export class ClosestPointStrokeHandler extends NewtonRtoRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _closestPoint: CurveLocationDetail | undefined;
  private _spacePoint: Point3d;
  private _extend: VariantCurveExtendParameter;
  private _ignoreZ: boolean;
  // fraction and function value on one side of an interval that may bracket a root
  private _fractionA: number = 0;
  private _functionA: number = 0;
  // fraction and function value on the other side of an interval that may bracket a root
  private _fractionB: number = 0;
  private _functionB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars to use within methods
  private _workPoint: Point3d;
  private _workRay: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;
  /** Constructor */
  public constructor(spacePoint: Point3d, extend?: VariantCurveExtendParameter, result?: CurveLocationDetail, ignoreZ?: boolean) {
    super();
    this._spacePoint = spacePoint;
    this._workPoint = Point3d.create();
    this._workRay = Ray3d.createZero();
    this._closestPoint = result;
    if (this._closestPoint)
      this._closestPoint.a = Geometry.largeCoordinateResult
    this._extend = extend ?? false;
    this._ignoreZ = ignoreZ ?? false;
    this.startCurvePrimitive(undefined);
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }
  public claimResult(): CurveLocationDetail | undefined {
    if (this._closestPoint) {
      this._newtonSolver.setX(this._closestPoint.fraction);
      this._curve = this._closestPoint.curve;
      if (this._newtonSolver.runIterations()) {
        let fraction = this._newtonSolver.getX();
        fraction = CurveExtendOptions.correctFraction(this._extend, fraction);
        this.announceSolutionFraction(fraction);
      }
    }
    return this._closestPoint;
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
    this.announceSolutionFraction(0.0); // test start point as closest
    this.announceSolutionFraction(1.0); // test end point as closest
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
    let distance = 0;
    if (this._ignoreZ)
      distance = this._spacePoint.distanceXY(point);
    else
      distance = this._spacePoint.distance(point);
    if (this._closestPoint && distance > this._closestPoint.a)
      return;
    this._closestPoint = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point, this._closestPoint);
    this._closestPoint.a = distance;
    if (this._parentCurvePrimitive !== undefined)
      this._closestPoint.curve = this._parentCurvePrimitive;
  }
  public announceSegmentInterval(
    cp: CurvePrimitive, point0: Point3d, point1: Point3d, _numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    let localFraction = 0;
    if (this._ignoreZ) {
      const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(point0, point1, this._spacePoint);
      if (lineFraction !== undefined)
        localFraction = lineFraction;
    } else
      localFraction = this._spacePoint.fractionOfProjectionToLine(point0, point1, 0.0);
    // only consider extending the segment if the immediate caller says we are at endpoints
    if (this._extend === false || this._extend === CurveExtendMode.None)
      localFraction = Geometry.clampToStartEnd(localFraction, 0.0, 1.0);
    else if (Array.isArray(this._extend)) {
      if (this._extend[0] === CurveExtendMode.None)
        localFraction = Math.max(localFraction, 0.0);
      else if (fraction0 !== 0.0)
        localFraction = Math.max(localFraction, 0.0);
      if (this._extend[1] === CurveExtendMode.None)
        localFraction = Math.min(localFraction, 1.0);
      else if (fraction1 !== 1.0)
        localFraction = Math.min(localFraction, 1.0);
    } else {
      if (fraction0 !== 0.0)
        localFraction = Math.max(localFraction, 0.0);
      if (fraction1 !== 1.0)
        localFraction = Math.min(localFraction, 1.0);
    }
    this._workPoint = point0.interpolate(localFraction, point1);
    const globalFraction = Geometry.interpolate(fraction0, localFraction, fraction1);
    this.announceCandidate(cp, globalFraction, this._workPoint);
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
    if (this._functionA * this._functionB > 0)
      return; // stroke segment has no root; ASSUME the function has no root either
    if (this._functionA === 0)
      this.announceSolutionFraction(this._fractionA);
    if (this._functionB === 0)
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
   * * For finding the closest point to curve X from point Q, this function is `f(t) := Q-X(t) dot X'(t)`.
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
    if (this._ignoreZ)
      return this._workRay.dotProductXYToPoint(this._spacePoint);
    else
      return this._workRay.dotProductToPoint(this._spacePoint);
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
    const value = this.evaluateFunction(data);
    assert(value !== undefined, "expect defined because evaluateFunction never returns undefined for input Ray3d");
    this._functionB = value;
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
