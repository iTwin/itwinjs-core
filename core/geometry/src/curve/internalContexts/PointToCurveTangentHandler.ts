/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
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
  public constructor(spacePoint: Point3d, collector: TangencyPointCollector, extendArcs: boolean = false) {
    super();
    this.spacePoint = spacePoint;
    this.collector = collector;
    this.extendArcs = extendArcs;
  }

  public override handleArc3d(g: Arc3d) {
    const centerToPoint = Vector3d.createStartEnd (g.centerRef, this.spacePoint);
    const localCenterToPoint = g.matrixRef.multiplyInverse (centerToPoint);
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
