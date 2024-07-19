/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { IStrokeHandler } from "../../geometry3d/GeometryHandler";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { GaussMapper } from "../../numerics/Quadrature";
import { CurvePrimitive } from "../CurvePrimitive";

/**
 * Context for computing the length of a CurvePrimitive.
 * @internal
 */
export class CurveLengthContext implements IStrokeHandler {
  private _curve: CurvePrimitive | undefined;
  private _summedLength: number;
  private _ray: Ray3d;
  private _fraction0: number;
  private _fraction1: number;
  private _gaussMapper: GaussMapper;

  private tangentMagnitude(fraction: number): number {
    this._ray = (this._curve as CurvePrimitive).fractionToPointAndDerivative(fraction, this._ray);
    return this._ray.direction.magnitude();
  }

  /** Return the fraction0 installed at construction time. */
  public get getFraction0(): number {
    return this._fraction0;
  }

  /** Return the fraction1 installed at construction time. */
  public get getFraction1(): number {
    return this._fraction1;
  }

  public getSum() {
    return this._summedLength;
  }

  public constructor(fraction0: number = 0.0, fraction1: number = 1.0, numGaussPoints: number = 5) {
    this.startCurvePrimitive(undefined);
    this._summedLength = 0.0;
    this._ray = Ray3d.createZero();
    if (fraction0 < fraction1) {
      this._fraction0 = fraction0;
      this._fraction1 = fraction1;
    } else {
      this._fraction0 = fraction1;
      this._fraction1 = fraction0;
    }
    this._gaussMapper = new GaussMapper(numGaussPoints);
  }

  public startCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._curve = curve;
  }

  public startParentCurvePrimitive(_curve: CurvePrimitive) {
  }

  public endParentCurvePrimitive(_curve: CurvePrimitive) {
  }

  public endCurvePrimitive() {
  }

  public announceIntervalForUniformStepStrokes(cp: CurvePrimitive, numStrokes: number, fraction0: number, fraction1: number): void {
    const range = Range1d.createXX(fraction0, fraction1);
    range.intersectRangeXXInPlace(this._fraction0, this._fraction1);
    if (!range.isNull) {
      this.startCurvePrimitive(cp);
      if (numStrokes < 1)
        numStrokes = 1;
      const df = 1.0 / numStrokes;
      for (let i = 1; i <= numStrokes; i++) {
        const fractionA = range.fractionToPoint((i - 1) * df);
        const fractionB = i === numStrokes ? range.high : range.fractionToPoint(i * df);
        const numGauss = this._gaussMapper.mapXAndW(fractionA, fractionB);
        for (let k = 0; k < numGauss; k++) {
          this._summedLength += this._gaussMapper.gaussW[k] * this.tangentMagnitude(this._gaussMapper.gaussX[k]);
        }
      }
    }
  }

  public announceSegmentInterval(_cp: CurvePrimitive, point0: Point3d, point1: Point3d, _numStrokes: number, fraction0: number, fraction1: number): void {
    const segmentLength = point0.distance(point1);
    if (this._fraction0 <= fraction0 && fraction1 <= this._fraction1)
      this._summedLength += segmentLength;
    else {
      const range = Range1d.createXX(fraction0, fraction1);
      range.intersectRangeXXInPlace(this._fraction0, this._fraction1);
      if (!range.isNull)
        this._summedLength += segmentLength * range.length() / (fraction1 - fraction0);
    }
  }

  public announcePointTangent(_xyz: Point3d, _fraction: number, _tangent: Vector3d): void {
    // uh oh -- need to retain point for next interval
  }
}
