/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Arc3d } from "../Arc3d";
import { CurvePrimitive } from "../CurvePrimitive";

type TangencyPointCollector = (spacePoint: Point3d, curve: CurvePrimitive, fraction: number) => any;
/**
 * Accumulator context for searching for lines tangent to curved geometry.
 * LIMITED IMPLEMENTATION 3/2015
 * * Only Arc3d implements its handler
 * * Arc3d calculation works with the projection of the space point into the plane of the arc.
 * @internal
 */
export class PointToCurveTangentHandler extends RecurseToCurvesGeometryHandler {
  public spacePoint: Point3d;
  public collector: TangencyPointCollector;
  public extendArcs: boolean;
  // If available, do the tangency as viewed in the xy plane AFTER multiplying vectors by this matrix.
  public worldToView: Matrix3d | undefined;
  public constructor(spacePoint: Point3d, collector: TangencyPointCollector, extendArcs: boolean = false, viewMatrix: Matrix3d | undefined) {
    super();
    this.spacePoint = spacePoint;
    this.collector = collector;
    this.extendArcs = extendArcs;
    this.worldToView = viewMatrix;
  }

  public override handleArc3d(g: Arc3d) {
    const centerToPoint = Vector3d.createStartEnd (g.centerRef, this.spacePoint);
    let localCenterToPoint: Vector3d | undefined;
    if (this.worldToView){
      // Convert the vector spacePoint into the arc's default system in which
      //  U vector is column  0
      //  V vector is column 1
      //  worldToVew row 2 is column 3
      const arcToView = Matrix3d.createColumns (
        g.matrixRef.getColumn(0),g.matrixRef.getColumn(1),this.worldToView.getRow (2));
      localCenterToPoint = arcToView.multiplyInverse (centerToPoint);
    } else {
      // Convert the vector spacePoint into the arc's default system in which
      //  U vector is column  0
      //  V vector is column 1
      //  their cross product (or maybe a scale of it) is column 2.
      localCenterToPoint  = g.matrixRef.multiplyInverse (centerToPoint)!;
    }
    if (localCenterToPoint === undefined)
      return;
    // localCenterToPoint is measured in the (deskewed and descaled!) coordinate system of the
    // arc U and V axes.  That is, the arc is now a unit circle.
    // Angle alpha is from the local x axis to localCenterToPoint.
    // Angle beta is from that to the tangency points.
    // (The inverse transformation preserves parameter angle in the ellipse sweep)
    if (localCenterToPoint !== undefined){
      const distanceSquaredXYToPoint = localCenterToPoint.magnitudeSquaredXY();
      if (distanceSquaredXYToPoint <= 1.0){
        // The point is inside the ellipse
      } else {
        const distanceToTangency = Math.sqrt (distanceSquaredXYToPoint - 1.0)
        const alpha = Math.atan2 (localCenterToPoint.y, localCenterToPoint.x);
        const beta = Math.atan2 (distanceToTangency, 1);
        for (const theta of [alpha + beta, alpha - beta]){
          const fraction = g.sweep.radiansToPositivePeriodicFraction (theta);
          if (this.extendArcs || fraction <= 1.0)
            this.collector (this.spacePoint, g, fraction);
        }
      }
    }
  }
}
