/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { } from "../PointVector";
import { Range3d } from "../Range";
import { Transform, RotMatrix } from "../Transform";
import { CurveCollection } from "../curve/CurveChain";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { Ray3d } from "../AnalyticGeometry";
import { Geometry, Angle, AxisOrder } from "../Geometry";
import { GeometryHandler } from "../GeometryHandler";
import { SweepContour } from "./SweepContour";
import { SolidPrimitive } from "./SolidPrimitive";

export class RotationalSweep extends SolidPrimitive {
  private contour: SweepContour;
  private normalizedAxis: Ray3d;
  private sweepAngle: Angle;
  private constructor(contour: SweepContour, normalizedAxis: Ray3d, sweepAngle: Angle, capped: boolean) {
    super(capped);
    this.contour = contour;
    this.normalizedAxis = normalizedAxis;
    this.capped = capped;
    this.sweepAngle = sweepAngle;
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
    const contourPerpendicular = this.contour.localToWorld.matrix.columnZ();
    const axes = RotMatrix.createRigidFromColumns(contourPerpendicular, this.normalizedAxis.direction, AxisOrder.YZX);
    if (axes) {
      return Transform.createOriginAndMatrix(this.normalizedAxis.origin, axes);
    }
    return undefined;
  }
  public cloneAxisRay(): Ray3d { return this.normalizedAxis.clone(); }
  public getCurves(): CurveCollection { return this.contour.curves; }
  public getSweepContourRef(): SweepContour { return this.contour; }
  public getSweep(): Angle { return this.sweepAngle.clone(); }

  public isSameGeometryClass(other: any): boolean { return other instanceof RotationalSweep; }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof RotationalSweep) {
      return this.contour.isAlmostEqual(other.contour)
        && this.normalizedAxis.isAlmostEqual(other.normalizedAxis)
        && this.capped === other.capped;
    }
    return false;
  }

  public clone(): RotationalSweep {
    return new RotationalSweep(this.contour.clone(), this.normalizedAxis.clone(), this.sweepAngle.clone(), this.capped);
  }
  public tryTransformInPlace(transform: Transform): boolean {
    if (this.contour.tryTransformInPlace(transform)) {
      this.normalizedAxis.transformInPlace(transform);
      return this.normalizedAxis.direction.normalizeInPlace();
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
    const radians = this.sweepAngle.radians * vFraction;
    const rotation = Transform.createOriginAndMatrix(this.normalizedAxis.origin,
      RotMatrix.createRotationAroundVector(this.normalizedAxis.direction, Angle.createRadians(radians),
        result ? result.matrix : undefined) as RotMatrix);
    return rotation;
  }
  /**
   * @returns Return the curves of a constant-v section of the solid.
   * @param vFraction fractional position along the sweep direction
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const section = this.contour.curves.clone();
    if (section) {
      section.tryTransformInPlace(this.getFractionalRotationTransform(vFraction));
    }
    return section;
  }

  public extendRange(range: Range3d) {
    const strokes = this.contour.curves.cloneStroked();
    const numStep = Geometry.stepCount(22.5, this.sweepAngle.degrees, 4, 16);
    for (let i = 0; i <= numStep; i++)
      strokes.extendRange(range, this.getFractionalRotationTransform(i / numStep));
  }
}
