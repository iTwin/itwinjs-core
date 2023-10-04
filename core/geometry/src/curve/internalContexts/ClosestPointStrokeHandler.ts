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
import { CurveExtendOptions, VariantCurveExtendParameter } from "../CurveExtendMode";
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
  private _fractionA: number = 0;
  private _functionA: number = 0;
  private _functionB: number = 0;
  private _fractionB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars for use within methods.
  private _workPoint: Point3d;
  private _workRay: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;

  public constructor(spacePoint: Point3d, extend: VariantCurveExtendParameter, result?: CurveLocationDetail) {
    super();
    this._spacePoint = spacePoint;
    this._workPoint = Point3d.create();
    this._workRay = Ray3d.createZero();
    this._closestPoint = result;
    this._extend = extend;
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

  public announceIntervalForUniformStepStrokes(cp: CurvePrimitive, numStrokes: number, fraction0: number, fraction1: number): void {
    this.startCurvePrimitive(cp);
    this.announceSolutionFraction(0.0); // test start point as closest
    this.announceSolutionFraction(1.0); // test end point as closest
    if (numStrokes < 1) numStrokes = 1;
    const df = 1.0 / numStrokes;
    for (let i = 0; i <= numStrokes; i++) {
      const fraction = Geometry.interpolate(fraction0, i * df, fraction1);
      cp.fractionToPointAndDerivative(fraction, this._workRay);
      this.announceRay(fraction, this._workRay);
    }
  }

  private announceCandidate(cp: CurvePrimitive, fraction: number, point: Point3d) {
    const distance = this._spacePoint.distance(point);
    if (this._closestPoint && distance > this._closestPoint.a)
      return;
    this._closestPoint = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point, this._closestPoint);
    this._closestPoint.a = distance;
    if (this._parentCurvePrimitive !== undefined)
      this._closestPoint.curve = this._parentCurvePrimitive;
  }

  public announceSegmentInterval(cp: CurvePrimitive, point0: Point3d, point1: Point3d, _numStrokes: number, fraction0: number, fraction1: number): void {
    let localFraction = this._spacePoint.fractionOfProjectionToLine(point0, point1, 0.0);
    // only consider extending the segment if the immediate caller says we are at endpoints ...
    if (!this._extend)
      localFraction = Geometry.clampToStartEnd(localFraction, 0.0, 1.0);
    else {
      if (fraction0 !== 0.0)
        localFraction = Math.max(localFraction, 0.0);
      if (fraction1 !== 1.0)
        localFraction = Math.min(localFraction, 1.0);
    }
    this._workPoint = point0.interpolate(localFraction, point1);
    const globalFraction = Geometry.interpolate(fraction0, localFraction, fraction1);
    this.announceCandidate(cp, globalFraction, this._workPoint);
  }

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

  private evaluateB(fractionB: number, dataB: Ray3d) {
    this._functionB = dataB.dotProductToPoint(this._spacePoint);
    this._fractionB = fractionB;
  }

  private announceSolutionFraction(fraction: number) {
    if (this._curve)
      this.announceCandidate(this._curve, fraction, this._curve.fractionToPoint(fraction));
  }

  public evaluate(fraction: number): boolean {
    let curve = this._curve;
    if (this._parentCurvePrimitive)
      curve = this._parentCurvePrimitive;
    if (curve) {
      this._workRay = curve.fractionToPointAndDerivative(fraction, this._workRay);
      this.currentF = this._workRay.dotProductToPoint(this._spacePoint);
      return true;
    }
    return false;
  }

  public announceRay(fraction: number, data: Ray3d): void {
    this.evaluateB(fraction, data);
    if (this._numThisCurve++ > 0) this.searchInterval();
    this._functionA = this._functionB;
    this._fractionA = this._fractionB;
  }

  public announcePointTangent(point: Point3d, fraction: number, tangent: Vector3d) {
    this._workRay.set(point, tangent);
    this.announceRay(fraction, this._workRay);
  }
}
