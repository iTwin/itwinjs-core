/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry, PlaneAltitudeEvaluator } from "../../Geometry";
import { IStrokeHandler } from "../../geometry3d/GeometryHandler";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Order2Bezier } from "../../numerics/BezierPolynomials";
import { Newton1dUnboundedApproximateDerivative } from "../../numerics/Newton";
import { CurveLocationDetail } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { NewtonRtoRStrokeHandler } from "./NewtonRtoRStrokeHandler";

/**
 * Context for computing intersections of a CurvePrimitive with a plane.
 * @internal
 */
export class AppendPlaneIntersectionStrokeHandler extends NewtonRtoRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _plane: PlaneAltitudeEvaluator;
  private _intersections: CurveLocationDetail[];
  private _fractionA: number = 0;
  private _functionA: number = 0;
  // private derivativeA: number;   <---- Not currently used
  private _functionB: number = 0;
  private _fractionB: number = 0;
  private _derivativeB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars for use within methods.
  private _ray: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;

  // Return the first defined curve among: this.parentCurvePrimitive, this.curve;
  public effectiveCurve(): CurvePrimitive | undefined {
    if (this._parentCurvePrimitive)
      return this._parentCurvePrimitive;
    return this._curve;
  }

  public get getDerivativeB() {
    return this._derivativeB;    // <--- _derivativeB is not currently used anywhere. Provided getter to suppress lint error
  }

  public constructor(plane: PlaneAltitudeEvaluator, intersections: CurveLocationDetail[]) {
    super();
    this._plane = plane;
    this._intersections = intersections;
    this.startCurvePrimitive(undefined);
    this._ray = Ray3d.createZero();
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }

  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
    this._fractionA = 0.0;
    this._numThisCurve = 0;
    this._functionA = 0.0;
    // this.derivativeA = 0.0;
  }

  public endCurvePrimitive() {
  }

  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    this.startCurvePrimitive(cp);
    if (numStrokes < 1) numStrokes = 1;
    const df = 1.0 / numStrokes;
    for (let i = 0; i <= numStrokes; i++) {
      const fraction = Geometry.interpolate(fraction0, i * df, fraction1);
      cp.fractionToPointAndDerivative(fraction, this._ray);
      this.announcePointTangent(this._ray.origin, fraction, this._ray.direction);
    }
  }

  public announceSegmentInterval(
    _cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    const h0 = this._plane.altitude(point0);
    const h1 = this._plane.altitude(point1);
    if (h0 * h1 > 0.0)
      return;
    const fraction01 = Order2Bezier.solveCoffs(h0, h1);
    // let numIntersection = 0;
    if (fraction01 !== undefined) {
      // numIntersection++;
      const fraction = Geometry.interpolate(fraction0, fraction01, fraction1);
      this._newtonSolver.setX(fraction);
      if (this._newtonSolver.runIterations()) {
        this.announceSolutionFraction(this._newtonSolver.getX());
      }
      // this.intersections.push(CurveLocationDetail.createCurveFractionPoint(cp, fraction, cp.fractionToPoint(fraction)));
    }
  }

  private announceSolutionFraction(fraction: number) {
    const curve = this.effectiveCurve();
    if (curve) {
      this._ray = curve.fractionToPointAndDerivative(fraction, this._ray);
      this._intersections.push(CurveLocationDetail.createCurveFractionPoint(curve, fraction, this._ray.origin));
    }
  }

  public evaluate(fraction: number): boolean {
    const curve = this.effectiveCurve();
    if (!curve)
      return false;
    this.currentF = this._plane.altitude(curve.fractionToPoint(fraction));
    return true;
  }

  /**
   * * ASSUME both the "A" and "B"  evaluations (fraction, function, and derivative) are known.
   * * If function value changed sign between, interpolate an approximate root and improve it with
   *     the newton solver.
   */
  private searchInterval() {
    if (this._functionA * this._functionB > 0) return;
    if (this._functionA === 0) this.announceSolutionFraction(this._fractionA);
    if (this._functionB === 0) this.announceSolutionFraction(this._fractionB);
    if (this._functionA * this._functionB < 0) {
      const fraction = Geometry.inverseInterpolate(this._fractionA, this._functionA, this._fractionB, this._functionB);
      if (fraction) {
        this._newtonSolver.setX(fraction);
        if (this._newtonSolver.runIterations())
          this.announceSolutionFraction(this._newtonSolver.getX());
      }
    }
  }

  /** Evaluate and save _functionB, _derivativeB, and _fractionB. */
  private evaluateB(xyz: Point3d, fraction: number, tangent: Vector3d) {
    this._functionB = this._plane.altitude(xyz);
    this._derivativeB = this._plane.velocity(tangent);
    this._fractionB = fraction;
  }

  /**
   * Announce point and tangent for evaluations.
   * * The function evaluation is saved as the "B" function point.
   * * The function point count is incremented
   * * If function point count is greater than 1, the current interval is searched.
   * * The just-evaluated point ("B") is saved as the "old" ("A") evaluation point.
   * @param xyz
   * @param fraction
   * @param tangent
   */
  public announcePointTangent(xyz: Point3d, fraction: number, tangent: Vector3d): void {
    this.evaluateB(xyz, fraction, tangent);
    if (this._numThisCurve++ > 0) this.searchInterval();
    this._functionA = this._functionB;
    this._fractionA = this._fractionB;
  }
}
