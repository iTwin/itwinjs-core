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
 * Context for searching for the closest tangent to a CurvePrimitive.
 * @internal
 */
export class ClosestTangentStrokeHandler extends NewtonRtoRStrokeHandler implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _closestTangents: CurveLocationDetail[];
  private _spacePoint: Point3d;
  private _normal: Vector3d;
  private _extend: VariantCurveExtendParameter;
  // fractions near the closest tangent
  private _fractionA: number = 0;
  private _functionA: number = 0;
  // dot product of fractions near the closest tangent
  private _functionB: number = 0;
  private _fractionB: number = 0;
  private _numThisCurve: number = 0;
  // scratch vars to use within methods
  private _workPoint: Point3d;
  private _workRay: Ray3d;
  private _newtonSolver: Newton1dUnboundedApproximateDerivative;
  /** Constructor */
  public constructor(
    spacePoint: Point3d, normal: Vector3d = Vector3d.unitZ(), extend: VariantCurveExtendParameter = false,
  ) {
    super();
    this._spacePoint = spacePoint;
    this._normal = normal;
    this._closestTangents = [];
    this._workPoint = Point3d.create();
    this._workRay = Ray3d.createZero();
    this._extend = extend;
    this.startCurvePrimitive(undefined);
    this._newtonSolver = new Newton1dUnboundedApproximateDerivative(this);
  }
  public claimResult(): CurveLocationDetail[] {
    // second run of Newton here seems unnecessary and you can just "return this._closestTangents" in this method.
    // for Arc3d and B-spline, if I remove second Newton run, the tests still pass.
    // for line segments and line strings, the second run mostly fail and cannot find all tangents.
    if (this._closestTangents.length > 0) {
      const closestTangents = this._closestTangents;
      this._closestTangents = [];
      for (const closestTangent of closestTangents) {
        if (closestTangent) {
          this._newtonSolver.setX(closestTangent.fraction);
          this._curve = closestTangent.curve;
          if (this._newtonSolver.runIterations()) {
            let fraction = this._newtonSolver.getX();
            fraction = CurveExtendOptions.correctFraction(this._extend, fraction);
            this.announceSolutionFraction(fraction);
          }
        }
      }
    }
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
      if (Math.abs(fraction - lastFraction) < Geometry.smallFraction)
        return;
    }
    const closestTangent = CurveLocationDetail.createCurveFractionPoint(cp, fraction, point);
    if (this._parentCurvePrimitive !== undefined)
      closestTangent.curve = this._parentCurvePrimitive;
    this._closestTangents?.push(closestTangent);
  }
  // needs update; current code returns closest point rather than closest tangent for line segment and line string
  public announceSegmentInterval(
    cp: CurvePrimitive, point0: Point3d, point1: Point3d, _numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    let localFraction = this._spacePoint.fractionOfProjectionToLine(point0, point1, 0.0);
    // only consider extending the segment if the immediate caller says we are at endpoints
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
    if (this._functionA * this._functionB > 0) // no solution between fractionA and fractionB
      return;
    if (this._functionA === 0) // solution at fractionA
      this.announceSolutionFraction(this._fractionA);
    if (this._functionB === 0) // solution at fractionB
      this.announceSolutionFraction(this._fractionB);
    // solution between fractionA and fractionB; use Newton to find fraction where function (dot product) is zero
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
  public evaluate(fraction: number): boolean {
    let curve = this._curve;
    if (this._parentCurvePrimitive)
      curve = this._parentCurvePrimitive;
    if (curve) {
      this._workRay = curve.fractionToPointAndDerivative(fraction, this._workRay);
      const cross = this._normal.crossProduct(this._workRay.direction);
      this.currentF = cross.dotProductStartEnd(this._workRay.origin, this._spacePoint);
      return true;
    }
    return false;
  }
  private announceRay(fraction: number, data: Ray3d): void {
    const cross = this._normal.crossProduct(data.direction);
    this._functionB = cross.dotProductStartEnd(data.origin, this._spacePoint);
    this._fractionB = fraction;
    if (this._numThisCurve++ > 0)
      this.searchInterval();
    this._functionA = this._functionB;
    this._fractionA = this._fractionB;
  }
  public announcePointTangent(point: Point3d, fraction: number, tangent: Vector3d) {
    this._workRay.set(point, tangent);
    this.announceRay(fraction, this._workRay);
  }
}
