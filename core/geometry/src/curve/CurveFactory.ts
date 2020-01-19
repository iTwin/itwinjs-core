/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Arc3d, ArcBlendData } from "./Arc3d";
import { LineString3d } from "./LineString3d";
import { LineSegment3d } from "./LineSegment3d";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { Path } from "./Path";
import { Geometry } from "../Geometry";
import { Ellipsoid, GeodesicPathPoint } from "../geometry3d/Ellipsoid";
import { Loop } from "./Loop";
import { AngleSweep } from "../geometry3d/AngleSweep";
/**
 * The `CurveFactory` class contains methods for specialized curve constructions.
 * @public
 */
export class CurveFactory {
  /** (cautiously) construct and save a line segment between fractional positions. */
  private static addPartialSegment(path: Path, allowBackup: boolean, pointA: Point3d | undefined, pointB: Point3d | undefined, fraction0: number, fraction1: number) {
    if (allowBackup || (fraction1 > fraction0)) {
      if (pointA !== undefined && pointB !== undefined && !Geometry.isAlmostEqualNumber(fraction0, fraction1))
        path.tryAddChild(LineSegment3d.create(pointA.interpolate(fraction0, pointB), pointA.interpolate(fraction1, pointB)));
    }
  }
  /**
   * Construct a sequence of alternating lines and arcs with the arcs creating tangent transition between consecutive edges.
   * @param points point source
   * @param radius fillet radius
   * @param allowBackupAlongEdge true to allow edges to be created going "backwards" along edges if needed to create the blend.
   */
  public static createFilletsInLineString(points: LineString3d | IndexedXYZCollection | Point3d[], radius: number, allowBackupAlongEdge: boolean = true): Path | undefined {
    if (Array.isArray(points))
      return this.createFilletsInLineString(new Point3dArrayCarrier(points), radius, allowBackupAlongEdge);
    if (points instanceof LineString3d)
      return this.createFilletsInLineString(points.packedPoints, radius, allowBackupAlongEdge);
    const n = points.length;
    if (n <= 1)
      return undefined;
    const pointA = points.getPoint3dAtCheckedPointIndex(0)!;
    const pointB = points.getPoint3dAtCheckedPointIndex(1)!;
    // remark: n=2 and n=3 cases should fall out from loop logic
    const blendArray: ArcBlendData[] = [];
    // build one-sided blends at each end . .
    blendArray.push({ fraction10: 0.0, fraction12: 0.0, point: pointA.clone() });

    for (let i = 1; i + 1 < n; i++) {
      const pointC = points.getPoint3dAtCheckedPointIndex(i + 1)!;
      blendArray.push(Arc3d.createFilletArc(pointA, pointB, pointC, radius));
      pointA.setFromPoint3d(pointB);
      pointB.setFromPoint3d(pointC);
    }
    blendArray.push({ fraction10: 0.0, fraction12: 0.0, point: pointB.clone() });
    if (!allowBackupAlongEdge) {
      // suppress arcs that have overlap with both neighbors or flood either neighbor ..
      for (let i = 1; i + 1 < n; i++) {
        const b = blendArray[i];
        if (b.fraction10 > 1.0
          || b.fraction12 > 1.0
          || 1.0 - b.fraction10 < blendArray[i - 1].fraction12
          || b.fraction12 > 1.0 - blendArray[i + 1].fraction10) {
          b.fraction10 = 0.0;
          b.fraction12 = 0.0;
          blendArray[i].arc = undefined;
        }
      }
      /*  The "1-b" logic above prevents this loop from ever doing anything.
      // on edge with conflict, suppress the arc with larger fraction
      for (let i = 1; i < n; i++) {
        const b0 = blendArray[i - 1];
        const b1 = blendArray[i];
        if (b0.fraction12 > 1 - b1.fraction10) {
          const b = b0.fraction12 > b1.fraction12 ? b1 : b0;
          b.fraction10 = 0.0;
          b.fraction12 = 0.0;
          blendArray[i].arc = undefined;
        }
      }*/
    }
    const path = Path.create();
    this.addPartialSegment(path, allowBackupAlongEdge, blendArray[0].point, blendArray[1].point, blendArray[0].fraction12, 1.0 - blendArray[1].fraction10);
    // add each path and successor edge ...
    for (let i = 1; i + 1 < points.length; i++) {
      const b0 = blendArray[i];
      const b1 = blendArray[i + 1];
      path.tryAddChild(b0.arc);
      this.addPartialSegment(path, allowBackupAlongEdge, b0.point, b1.point, b0.fraction12, 1.0 - b1.fraction10);
    }
    return path;
  }
  /** Create a `Loop` with given xy corners and fixed z. */
  public static createRectangleXY(x0: number, y0: number, x1: number, y1: number, z: number = 0, filletRadius?: number): Loop {
    if (filletRadius === undefined)
      return Loop.createPolygon([Point3d.create(x0, y0, z), Point3d.create(x1, y0, z), Point3d.create(x1, y1, z), Point3d.create(x0, y1, z), Point3d.create(x0, y0, z)]);
    else {
      const vectorU = Vector3d.create(filletRadius, 0, 0);
      const vectorV = Vector3d.create(0, filletRadius, 0);
      const x0A = x0 + filletRadius;
      const y0A = y0 + filletRadius;
      const x1A = x1 - filletRadius;
      const y1A = y1 - filletRadius;
      const centers = [Point3d.create(x1A, y1A, z), Point3d.create(x0A, y1A, z), Point3d.create(x0A, y0A, z), Point3d.create(x1A, y0A, z)];
      const loop = Loop.create();
      for (let i = 0; i < 4; i++) {
        const center = centers[i];
        const nextCenter = centers[(i + 1) % 4];
        const edgeVector = Vector3d.createStartEnd(center, nextCenter);
        const arc = Arc3d.create(center, vectorU, vectorV, AngleSweep.createStartEndDegrees(0, 90));
        loop.tryAddChild(arc);
        const arcEnd = arc.endPoint();
        loop.tryAddChild(LineSegment3d.create(arcEnd, arcEnd.plus(edgeVector)));
        vectorU.rotate90CCWXY(vectorU);
        vectorV.rotate90CCWXY(vectorV);
      }
      return loop;
    }
  }
  /**
   * If `arcB` is a continuation of `arcA`, extend `arcA` (in place) to include the range of `arcB`
   * * This only succeeds if the two arcs are part of identical complete arcs and end of `arcA` matches the beginning of `arcB`.
   * * "Reversed"
   * @param arcA
   * @param arcB
   */
  public static appendToArcInPlace(arcA: Arc3d, arcB: Arc3d, allowReverse: boolean = false): boolean {
    if (arcA.center.isAlmostEqual(arcB.center)) {
      const sweepSign = Geometry.split3WaySign(arcA.sweep.sweepRadians * arcB.sweep.sweepRadians, -1, 0, 1);
      // evaluate derivatives wrt radians (not fraction!), but adjust direction for sweep signs
      const endA = arcA.angleToPointAndDerivative(arcA.sweep.fractionToAngle(1.0));
      if (arcA.sweep.sweepRadians < 0)
        endA.direction.scaleInPlace(-1.0);
      const startB = arcB.angleToPointAndDerivative(arcB.sweep.fractionToAngle(0.0));
      if (arcB.sweep.sweepRadians < 0)
        startB.direction.scaleInPlace(-1.0);

      if (endA.isAlmostEqual(startB)) {
        arcA.sweep.setStartEndRadians(arcA.sweep.startRadians, arcA.sweep.startRadians + arcA.sweep.sweepRadians + sweepSign * arcB.sweep.sweepRadians);
        return true;
      }
      // Also ok if negated tangent . ..
      if (allowReverse) {
        startB.direction.scaleInPlace(-1.0);
        if (endA.isAlmostEqual(startB)) {
          arcA.sweep.setStartEndRadians(arcA.sweep.startRadians, arcA.sweep.startRadians + arcA.sweep.sweepRadians - sweepSign * arcB.sweep.sweepRadians);
          return true;
        }
      }

    }
    return false;
  }
  /**
   * Return a `Path` containing arcs are on the surface of an ellipsoid and pass through a sequence of points.
   * * Each arc passes through the two given endpoints and in the plane containing the true surface normal at given `fractionForIntermediateNormal`
   * @param ellipsoid
   * @param pathPoints
   * @param fractionForIntermediateNormal fractional position for surface normal used to create the section plane.
   */
  public static assembleArcChainOnEllipsoid(ellipsoid: Ellipsoid, pathPoints: GeodesicPathPoint[], fractionForIntermediateNormal: number = 0.5): Path {
    const arcPath = Path.create();
    for (let i = 0; i + 1 < pathPoints.length; i++) {
      const arc = ellipsoid.sectionArcWithIntermediateNormal(
        pathPoints[i].toAngles(),
        fractionForIntermediateNormal,
        pathPoints[i + 1].toAngles());
      arcPath.tryAddChild(arc);
    }
    return arcPath;
  }
}
