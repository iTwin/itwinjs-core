/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "../../Geometry";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { UnionOfConvexClipPlaneSets } from "../UnionOfConvexClipPlaneSets";
import { ConvexClipPlaneSet } from "../ConvexClipPlaneSet";
import { ClipPlane } from "../ClipPlane";
import { IndexedXYZCollection } from "../../geometry3d/IndexedXYZCollection";
/**
 * Class for building clip sets for offset regions.
 * @internal
 */
export class LineStringOffsetClipperContext {
  private _positiveOffsetLeft: number;
  private _positiveOffsetRight: number;
  private _turnDegrees: number;
  private constructor(positiveOffsetLeft: number, positiveOffsetRight: number) {
    this._positiveOffsetLeft = positiveOffsetLeft;
    this._positiveOffsetRight = positiveOffsetRight;
    this._turnDegrees = 60.0;
  }
  /**
   * Create a unit vector from point i to point i+1.
   * If closed, do point indexing with
   *   * index less than 0 get final segment
   *   * index at or beyond points.length-1 wraps to first segment
   * @param points
   * @param index0
   * @param closed indicates that first and last points are identical and need wrap logic.
   */
  public static createUnit(points: IndexedXYZCollection, index0: number, closed: boolean, xyOnly: boolean = true): Vector3d | undefined {
    // pick two indices of active points, allowing for wrap if needed:
    // normally use index0 and index0 + 1
    // but apply wrap if appropriate, and shift ahead of needed.
    let k0 = index0;
    let k1 = index0 + 1;
    const last = points.length - 1;
    if (closed) {
      if (index0 < 0) {
        k0 = last - 1; k1 = last;
      } else if (index0 >= last) {
        k0 = 0; k1 = 1;
      }
    } else {
      if (index0 === 0) {
        k0 = 0; k1 = 1;
      } else if (k1 > last) {
        k0 = last - 1;
        k1 = last;
      }
    }
    const result = points.vectorIndexIndex(k0, k1);
    if (result) {
      if (xyOnly)
        result.z = 0.0;
      return result.normalize(result);
    }
    return undefined;
  }
private static createDirectedPlane(basePoint: Point3d, vector: Vector3d, shift: number, normalScale: number, interior: boolean = false) {
    return ClipPlane.createNormalAndPointXYZXYZ(
      vector.x * normalScale, vector.y * normalScale, vector.z * normalScale,
      basePoint.x + shift * vector.x, basePoint.y + shift * vector.y, basePoint.z + shift * vector.z, interior, interior);
  }
  /**
   * Create (if needed) the chamfer cutback plane for a turn.
   * @param clipSet set to receive the plane
   * @param point central point
   * @param unitA incoming vector
   * @param unitB outgoing vector
   */
  private createChamferCut(clipSet: ConvexClipPlaneSet, point: Point3d, unitA: Vector3d, unitB: Vector3d) {
    const degreesA = unitA.angleToXY(unitB).degrees;
    if (Math.abs(degreesA) > this._turnDegrees) {
      const perpAB = unitA.interpolate(0.5, unitB);
      perpAB.rotate90CCWXY(perpAB);
      perpAB.normalizeInPlace();
      if (degreesA > 0)
        clipSet.addPlaneToConvexSet(LineStringOffsetClipperContext.createDirectedPlane(point, perpAB, -this._positiveOffsetRight, 1.0, false));
      else
        clipSet.addPlaneToConvexSet(LineStringOffsetClipperContext.createDirectedPlane(point, perpAB, this._positiveOffsetLeft, -1.0, false));
    }
  }
  private createOffsetFromSegment(pointA: Point3d, pointB: Point3d,
    unitA: Vector3d | undefined,
    unitB: Vector3d | undefined,
    unitC: Vector3d | undefined): ConvexClipPlaneSet | undefined {
    if (unitB === undefined)
      return undefined;
    if (unitA === undefined)
      unitA = unitB;
    if (unitC === undefined)
      unitC = unitB;
    const unitAB = unitA.interpolate(0.5, unitB);
    unitAB.normalizeInPlace();
    const perpB = unitB.rotate90CCWXY();
    const unitBC = unitB.interpolate(0.5, unitC);
    unitBC.normalizeInPlace();
    const clipSet = ConvexClipPlaneSet.createEmpty();
    clipSet.addPlaneToConvexSet(LineStringOffsetClipperContext.createDirectedPlane(pointA, perpB, this._positiveOffsetLeft, -1.0, false));
    clipSet.addPlaneToConvexSet(LineStringOffsetClipperContext.createDirectedPlane(pointA, perpB, -this._positiveOffsetRight, 1.0, false));
    clipSet.addPlaneToConvexSet(LineStringOffsetClipperContext.createDirectedPlane(pointA, unitAB, 0, 1.0, true));
    clipSet.addPlaneToConvexSet(LineStringOffsetClipperContext.createDirectedPlane(pointB, unitBC, 0, -1.0, true));
    this.createChamferCut(clipSet, pointA, unitA, unitB);
    this.createChamferCut(clipSet, pointB, unitB, unitC);
    /*
    const degreesA = unitA.angleToXY(unitB).degrees;
    if (Math.abs(degreesA) > this._turnDegrees) {
      const perpAB = unitA.interpolate(0.5, unitB);
      perpAB.rotate90CCWXY(perpAB);
      perpAB.normalizeInPlace();
      if (degreesA > 0)
        clipSet.addPlaneToConvexSet(BuildingCodeRegionOffsetsOps.createDirectedPlane(pointA, perpAB, -this._positiveOffsetRight, 1.0));
      else
        clipSet.addPlaneToConvexSet(BuildingCodeRegionOffsetsOps.createDirectedPlane(pointA, perpAB, -this._positiveOffsetLeft, -1.0));
    }
    const degreesB = unitB.angleToXY(unitC).degrees;
    if (Math.abs(degreesB) > this._turnDegrees) {
      const perpBC = unitB.interpolate(0.5, unitC);
      perpBC.rotate90CCWXY(perpBC);
      perpBC.normalizeInPlace();
      if (degreesB > 0)
        clipSet.addPlaneToConvexSet(BuildingCodeRegionOffsetsOps.createDirectedPlane(pointB, perpBC, -this._positiveOffsetRight, 1.0));
      else
        clipSet.addPlaneToConvexSet(BuildingCodeRegionOffsetsOps.createDirectedPlane(pointB, perpBC, -this._positiveOffsetLeft, -1.0));
    }
    */
    return clipSet;
  }
  /**
   * @param points
   * @param positiveOffsetLeft offset to left.  0 is clip on the path.
   * @param positiveOffsetRight offset to the right.  0 is clip on the path.
   * @param z0 z for lower clipping plane.  If undefined, unbounded in positive z
   * @param z1 z for upper clipping plane.  If undefined, unbounded in negative z.
   */
  public static createClipBetweenOffsets(points: IndexedXYZCollection, positiveOffsetLeft: number, positiveOffsetRight: number, z0: number | undefined, z1: number | undefined): UnionOfConvexClipPlaneSets {
    const context = new LineStringOffsetClipperContext(positiveOffsetLeft, positiveOffsetRight);
    const result = UnionOfConvexClipPlaneSets.createEmpty();
    if (points.length > 1) {
      const closed = Geometry.isSmallMetricDistance(points.distanceIndexIndex(0, points.length - 1)!);
      for (let i = 0; i + 1 < points.length; i++) {
        const unitVectorA = this.createUnit(points, i - 1, closed);
        const unitVectorB = this.createUnit(points, i, closed);
        const unitVectorC = this.createUnit(points, i + 1, closed);
        const clipSet = context.createOffsetFromSegment(points.getPoint3dAtUncheckedPointIndex(i),
          points.getPoint3dAtUncheckedPointIndex(i + 1), unitVectorA, unitVectorB, unitVectorC);
        clipSet?.addZClipPlanes(false, z0, z1);
        if (clipSet)
          result.addConvexSet(clipSet);
      }
    } else {
      // make a singleton clipper with the z values.
      const clipSet = ConvexClipPlaneSet.createEmpty();
      clipSet?.addZClipPlanes(false, z0, z1);
      if (clipSet.planes.length > 0)
        result.addConvexSet(clipSet);
    }
    return result;
  }
}
