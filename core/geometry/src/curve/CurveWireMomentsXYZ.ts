/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

import { Geometry } from "../Geometry";
import { IStrokeHandler } from "../geometry3d/GeometryHandler";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { MomentData } from "../geometry4d/MomentData";
import { GaussMapper } from "../numerics/Quadrature";
import { AnyCurve } from "./CurveChain";
import { CurveCollection } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";

/**
 * Class to visit curve primitives and accumulate wire moment integrations.
 * @internal
 */
export class CurveWireMomentsXYZ implements IStrokeHandler {
  private _activeMomentData: MomentData;
  private _gaussMapper: GaussMapper;

  public constructor(numGaussPoints: number = 5) {
    this._activeMomentData = MomentData.create();
    this._activeMomentData.needOrigin = true;
    this._gaussMapper = new GaussMapper(numGaussPoints);
  }
  public get momentData(): MomentData { return this._activeMomentData; }

  public startParentCurvePrimitive(_cp: CurvePrimitive) { }
  public startCurvePrimitive(_cp: CurvePrimitive) { }
  public endCurvePrimitive(_cp: CurvePrimitive) { }
  public endParentCurvePrimitive(_cp: CurvePrimitive) { }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    this.startCurvePrimitive(cp);
    if (numStrokes < 1) numStrokes = 1;
    const df = 1.0 / numStrokes;
    let scaleFactor, fraction;
    for (let i = 1; i <= numStrokes; i++) {
      const fractionA = Geometry.interpolate(fraction0, (i - 1) * df, fraction1);
      const fractionB = i === numStrokes ? fraction1 : Geometry.interpolate(fraction0, (i) * df, fraction1);
      const numGauss = this._gaussMapper.mapXAndW(fractionA, fractionB);
      for (let k = 0; k < numGauss; k++) {
        fraction = this._gaussMapper.gaussX[k];
        const ray = cp.fractionToPointAndDerivative(fraction)!;
        scaleFactor = this._gaussMapper.gaussW[k] * ray.direction.magnitude();
        this._activeMomentData.accumulateScaledOuterProduct(ray.origin, scaleFactor);
      }
    }
  }

  public announceSegmentInterval(
    _cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    _numStrokes: number,
    _fraction0: number,
    _fraction1: number): void {
    this._activeMomentData.accumulateLineMomentsXYZ(point0, point1);
  }
  public announcePointTangent(_xyz: Point3d, _fraction: number, _tangent: Vector3d): void {
    // umm ... this should not happen.  We need to know intervals. The other functions should have prevented this.
  }
  /** Recurse to leaf-level primitives */
  public visitLeaves(root: AnyCurve) {
    if (root instanceof CurvePrimitive)
      root.emitStrokableParts(this);
    else if (root instanceof CurveCollection) {
      if (root.children !== undefined)
        for (const child of root.children) {
          this.visitLeaves(child as AnyCurve);
        }
    }
  }
}
