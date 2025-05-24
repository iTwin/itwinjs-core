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
import { CurveLocationDetail } from "../CurveLocationDetail";
import { CurvePrimitive, TangentOptions } from "../CurvePrimitive";
import { NewtonRtoRStrokeHandler } from "./NewtonRtoRStrokeHandler";

/**
 * Context for searching for the tangent(s) to a CurvePrimitive.
 * @internal
 */
export class AnnounceTangentStrokeHandler extends NewtonRtoRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _announceTangent: (tangent: CurveLocationDetail) => any;
  private _spacePoint: Point3d;
  private _vectorToEye: Vector3d;
  private _distanceTol: number;
  private _distanceTolSquared: number;
  // fraction and function value on one side of an interval that may bracket a root
  private _fractionA: number = 0;
  private _functionA: number = 0;
  // fraction and function value on the other side of an interval that may bracket a root
  private _fractionB: number = 0;
  private _functionB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars to use within methods
  private _fractionMRU?: number;
  private _curveMRU?: CurvePrimitive;
  private _workRay: Ray3d;
  private _workDetail?: CurveLocationDetail;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;
  /** Constructor */
  public constructor(spacePoint: Point3d, announceTangent: (tangent: CurveLocationDetail) => any, options?: TangentOptions) {
    super();
    this._announceTangent = announceTangent;
    this._spacePoint = spacePoint;
    this._vectorToEye = options?.vectorToEye ?? Vector3d.unitZ();
    this._distanceTol = options?.distanceTol ?? Geometry.smallMetricDistance;
    this._distanceTolSquared = this._distanceTol * this._distanceTol;
    this._workRay = Ray3d.createZero();
    this.startCurvePrimitive(undefined);
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }
  /** Specified by IStrokeHandler. */
  public needPrimaryGeometryForStrokes() {
    return true;
  }
  /** Specified by IStrokeHandler. */
  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
    this._fractionA = 0.0;
    this._numThisCurve = 0;
    this._functionA = 0.0;
  }
  /** Specified by IStrokeHandler. */
  public endCurvePrimitive() {
  }
  /** Specified by IStrokeHandler. */
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
  private announceCandidate(cp: CurvePrimitive, fraction: number, point: Point3d): void {
    if (this._parentCurvePrimitive)
      cp = this._parentCurvePrimitive;
    if (this._curveMRU === cp && Geometry.isAlmostEqualOptional(this._fractionMRU, fraction, Geometry.smallFloatingPoint))
      return; // avoid announcing duplicate tangents in succession (e.g., at interior stroke point)
    this._workDetail = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point, this._workDetail);
    this._announceTangent(this._workDetail);
    this._fractionMRU = fraction;
    this._curveMRU = cp;
  }
  /** Specified by IStrokeHandler. */
  public announceSegmentInterval(
    cp: CurvePrimitive, point0: Point3d, point1: Point3d, _numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    let fraction: number;
    let point: Point3d;
    const distance0 = this._spacePoint.distanceSquared(point0);
    const distance1 = this._spacePoint.distanceSquared(point1);
    if (distance0 < distance1) {
      fraction = fraction0;
      point = point0;
    } else {
      fraction = fraction1;
      point = point1;
    }
    // evaluate at midpoint; the endpoints may be at corners, which have ambiguous tangent
    const value = this.evaluateFunction(undefined, (fraction0 + fraction1) / 2, cp);
    if (value !== undefined && Geometry.isDistanceWithinTol(value, this._distanceTol))
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
    // directly announce at endpoint if we are extra certain it's a root; Newton can miss it if it has multiplicity > 1
    if (Geometry.isDistanceWithinTol(this._functionA, this._distanceTolSquared))
      this.announceSolutionFraction(this._fractionA);
    if (Geometry.isDistanceWithinTol(this._functionB, this._distanceTolSquared))
      this.announceSolutionFraction(this._fractionB);
    if (this._functionA * this._functionB < 0) {
      // by the Intermediate Value Theorem, a root lies between fractionA and fractionB; use Newton to find it.
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
   * * For finding the tangents to curve `X` from point `Q` as seen in a view plane with normal `N`, this
   * function is `f(t) := (Q - X(t)) dot (X'(t) cross N)`. The second vector in the dot product defines a
   * _tangent plane_ at `X(t)`.
   * * Either `pointAndDerivative` must be defined, or both `fraction` and `curve`.
   * @param pointAndDerivative pre-evaluated curve
   * @param fraction fraction at which to evaluate `curve`
   * @param curve curve to evaluate at `fraction`
   * @returns distance of `Q` from the tangent plane at `X(t)`.
  */
  private evaluateFunction(pointAndDerivative?: Ray3d, fraction?: number, curve?: CurvePrimitive): number | undefined {
    if (pointAndDerivative)
      this._workRay.setFrom(pointAndDerivative);
    else if (fraction !== undefined && curve)
      this._workRay = curve.fractionToPointAndDerivative(fraction, this._workRay);
    else
      return undefined;
    const cross = this._vectorToEye.unitCrossProduct(this._workRay.direction); // normalized so we return true distance
    return cross ? cross.dotProductStartEnd(this._workRay.origin, this._spacePoint) : undefined;
  }
  /** Specified by NewtonRtoRStrokeHandler. */
  public evaluate(fraction: number): boolean {
    const curve = this._parentCurvePrimitive ?? this._curve;
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
  /** Specified by IStrokeHandler. */
  public announcePointTangent(_point: Point3d, _fraction: number, _tangent: Vector3d) {
    assert(false, "No callers expected. IStrokeHandler probably didn't need to specify this method.");
  }
}
