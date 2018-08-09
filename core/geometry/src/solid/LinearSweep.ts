/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Vector3d, XAndY } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";

import { CurveCollection, Loop, Path } from "../curve/CurveChain";
import { LineString3d } from "../curve/LineString3d";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { PolygonOps } from "../PointHelpers";
import { GeometryHandler } from "../GeometryHandler";
import { SweepContour } from "./SweepContour";
import { SolidPrimitive } from "./SolidPrimitive";
/**
 * A LinearSweep is
 *
 * * A planar contour (any Loop, Path, or parityRegion)
 * * A sweep vector
 */
export class LinearSweep extends SolidPrimitive {
  private contour: SweepContour;
  private direction: Vector3d;

  private constructor(contour: SweepContour, direction: Vector3d, capped: boolean) {
    super(capped);
    this.contour = contour;
    this.direction = direction;
  }
  public static create(contour: CurveCollection, direction: Vector3d, capped: boolean): LinearSweep | undefined {
    const sweepable = SweepContour.createForLinearSweep(contour, direction);
    if (!sweepable)
      return undefined;
    return new LinearSweep(sweepable, direction, capped);
  }
  /** Create a z-direction sweep of the polyline or polygon given as xy linestring values.
   * * If not capped, the xyPoints array is always used unchanged.
   * * If capped but the xyPoints array does not close, exact closure will be enforced by one of these:
   * * * If the final point is almost equal to the first, it is replaced by the exact first point.
   * * * if the final point is not close to the first an extra point is added.
   * * If capped, the point order will be reversed if necessary to produce positive volume.
   * @param xyPoints array of xy coordinates
   * @param z z value to be used for all coordinates
   * @param zSweep the sweep distance in the z direction.
   * @param capped true if caps are to be added.
   */
  public static createZSweep(xyPoints: XAndY[], z: number, zSweep: number, capped: boolean): LinearSweep | undefined {
    const xyz = LineString3d.createXY(xyPoints, z, capped);
    if (capped) {
      const area = PolygonOps.areaXY(xyz.points);
      if (area * zSweep < 0.0)
        xyz.points.reverse ();
    }
    const contour: CurveCollection = capped ? Loop.create(xyz) : Path.create(xyz);
    return LinearSweep.create(contour, Vector3d.create(0, 0, zSweep), capped);
  }

  public getCurvesRef(): CurveCollection { return this.contour.curves; }
  public getSweepContourRef(): SweepContour { return this.contour; }
  public cloneSweepVector(): Vector3d { return this.direction.clone(); }

  public isSameGeometryClass(other: any): boolean { return other instanceof LinearSweep; }
  public clone(): LinearSweep {
    return new LinearSweep(this.contour.clone(), this.direction.clone(), this.capped);
  }
  public tryTransformInPlace(transform: Transform): boolean {
    if (this.contour.tryTransformInPlace(transform)) {
      transform.multiplyVector(this.direction, this.direction);
    }
    return false;
  }

  /** Return a coordinate frame (right handed unit vectors)
   * * origin on base contour
   * * x, y directions from base contour.
   * * z direction perpenedicular
   */
  public getConstructiveFrame(): Transform | undefined {
    return this.contour.localToWorld.cloneRigid();
  }
  public cloneTransformed(transform: Transform): LinearSweep {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof LinearSweep) {
      return this.contour.isAlmostEqual(other.contour)
        && this.direction.isAlmostEqual(other.direction)
        && this.capped === other.capped;
    }
    return false;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLinearSweep(this);
  }
  /**
   * @returns Return the curves of a constant-v section of the solid.
   * @param vFraction fractional position along the sweep direction
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const section = this.contour.curves.clone();
    if (section && vFraction !== 0.0)
      section.tryTransformInPlace(Transform.createTranslation(this.direction.scale(vFraction)));
    return section;
  }

  public extendRange(range: Range3d, transform?: Transform) {
    const contourRange = this.contour.curves.range(transform);
    range.extendRange(contourRange);
    if (transform) {
      const transformedDirection = transform.multiplyVector(this.direction);
      contourRange.low.addInPlace(transformedDirection);
      contourRange.high.addInPlace(transformedDirection);
    } else {
      contourRange.low.addInPlace(this.direction);
      contourRange.high.addInPlace(this.direction);
    }
    range.extendRange(contourRange);
  }
}
