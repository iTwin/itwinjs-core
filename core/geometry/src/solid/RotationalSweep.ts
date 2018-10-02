/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { } from "../geometry3d/PointVector";
import { Range3d } from "../geometry3d/Range";
import { Transform, Matrix3d } from "../geometry3d/Transform";
import { CurveCollection } from "../curve/CurveCollection";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Ray3d } from "../geometry3d/Ray3d";
import { Geometry, AxisOrder } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { SweepContour } from "./SweepContour";
import { SolidPrimitive } from "./SolidPrimitive";

export class RotationalSweep extends SolidPrimitive {
  private _contour: SweepContour;
  private _normalizedAxis: Ray3d;
  private _sweepAngle: Angle;
  private constructor(contour: SweepContour, normalizedAxis: Ray3d, sweepAngle: Angle, capped: boolean) {
    super(capped);
    this._contour = contour;
    this._normalizedAxis = normalizedAxis;
    this.capped = capped;
    this._sweepAngle = sweepAngle;
  }
  public static create(contour: CurveCollection, axis: Ray3d, sweepAngle: Angle, capped: boolean): RotationalSweep | undefined {
    if (!axis.direction.normalizeInPlace()) return undefined;
    const sweepable = SweepContour.createForRotation(contour, axis);
    if (!sweepable)
      return undefined;
    return new RotationalSweep(sweepable, axis, sweepAngle.clone(), capped);
  }

  /** Return a coordinate frame (right handed unit vectors)
   * * origin at origin of rotation ray
   * * z direction along the rotation ray.
   * * y direction perpendicular to the base contour plane
   */
  public getConstructiveFrame(): Transform | undefined {
    const contourPerpendicular = this._contour.localToWorld.matrix.columnZ();
    const axes = Matrix3d.createRigidFromColumns(contourPerpendicular, this._normalizedAxis.direction, AxisOrder.YZX);
    if (axes) {
      return Transform.createOriginAndMatrix(this._normalizedAxis.origin, axes);
    }
    return undefined;
  }
  public cloneAxisRay(): Ray3d { return this._normalizedAxis.clone(); }
  public getCurves(): CurveCollection { return this._contour.curves; }
  public getSweepContourRef(): SweepContour { return this._contour; }
  public getSweep(): Angle { return this._sweepAngle.clone(); }

  public isSameGeometryClass(other: any): boolean { return other instanceof RotationalSweep; }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof RotationalSweep) {
      return this._contour.isAlmostEqual(other._contour)
        && this._normalizedAxis.isAlmostEqual(other._normalizedAxis)
        && this.capped === other.capped;
    }
    return false;
  }

  public clone(): RotationalSweep {
    return new RotationalSweep(this._contour.clone(), this._normalizedAxis.clone(), this._sweepAngle.clone(), this.capped);
  }
  public tryTransformInPlace(transform: Transform): boolean {
    if (this._contour.tryTransformInPlace(transform)) {
      this._normalizedAxis.transformInPlace(transform);
      return this._normalizedAxis.direction.normalizeInPlace();
    }
    return false;
  }
  public cloneTransformed(transform: Transform): RotationalSweep {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleRotationalSweep(this);
  }

  public getFractionalRotationTransform(vFraction: number, result?: Transform): Transform {
    const radians = this._sweepAngle.radians * vFraction;
    const rotation = Transform.createOriginAndMatrix(this._normalizedAxis.origin,
      Matrix3d.createRotationAroundVector(this._normalizedAxis.direction, Angle.createRadians(radians),
        result ? result.matrix : undefined) as Matrix3d);
    return rotation;
  }
  /**
   * @returns Return the curves of a constant-v section of the solid.
   * @param vFraction fractional position along the sweep direction
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const section = this._contour.curves.clone();
    if (section) {
      section.tryTransformInPlace(this.getFractionalRotationTransform(vFraction));
    }
    return section;
  }

  public extendRange(range: Range3d) {
    const strokes = this._contour.curves.cloneStroked();
    const numStep = Geometry.stepCount(22.5, this._sweepAngle.degrees, 4, 16);
    for (let i = 0; i <= numStep; i++)
      strokes.extendRange(range, this.getFractionalRotationTransform(i / numStep));
  }
}
