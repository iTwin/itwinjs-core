/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Arc3d } from "../../curve/Arc3d";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { AnalyticRoots, SmallSystem } from "../../numerics/Polynomials";
import { Vector2d } from "../../geometry3d/Point2dVector2d";
import { Path } from "../../curve/Path";
import { Loop } from "../../curve/Loop";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GrowableFloat64Array } from "../../geometry3d/GrowableFloat64Array";
/**
 * Assorted static methods for constructing fragmentary and complete curves for offsets from linestrings.
 * * Primary method is the static edgeByEdgeOffsetFromPoints
 *   *
 *
 */
export class BuildingCodeOffsetOps {
  /**
   * Return an arc or coordinate for a specialized offset joint between different offsets along line segments.
   * * offsetAB and offsetBC may be different values, but must have the same sign.
   * * positive is to the right of the line segments
   * * returns an arc if the extension of the line with smaller offset intersects with the circular arc continuation of the line of the larger offset.
   * * otherwise returns point of intersection of the offset lines.
   * @param pointA start point of incoming edge
   * @param pointB common point of two edges
   * @param pointC end point of outgoing edge
   * @param offsetAB offset along edge from pointA to pointB.  Positive is to the right (outside of a CCW turn)
   * @param offsetBC offset along edge from pointB to pointC.  Positive is tot he right (outside of a CCW turn)
   */
  public static createJointWithRadiusChange(pointA: Point3d, pointB: Point3d, pointC: Point3d, offsetAB: number, offsetBC: number): CurvePrimitive | Point3d | undefined {
    // enforce same-sign:
    if (offsetAB * offsetBC < 0.0)
      return undefined;
    const vectorAB = Vector3d.createStartEnd(pointA, pointB);
    const vectorBC = Vector3d.createStartEnd(pointB, pointC);
    const perpAB = vectorAB.rotate90CCWXY();
    perpAB.scaleInPlace(-1.0);
    const perpBC = vectorBC.rotate90CCWXY();
    perpBC.scaleInPlace(-1.0);
    const totalTurn = vectorAB.angleToXY(vectorBC);
    let arc: CurvePrimitive | undefined;
    if (totalTurn.radians * offsetAB > 0.0) {
      let arcVector0, arcVector90;
      // for equal axes, the arc would sweep the total turn.
      // for unequal, find intersections of the smaller offset with the larger arc.
      //    * if two positive angle intersects, take the smaller.
      //    * otherwise jump to the simple offset of the smaller.
      //  const alphaSign = offsetBC > 0 ? -1.0 : 1.0;
      const alphaSign = -1.0;
      const betaSign = offsetBC > 0 ? 1.0 : -1.0;
      const phiSign = offsetBC > 0 ? 1.0 : -1.0;
      if (Math.abs(offsetBC) >= Math.abs(offsetAB)) {
        const offsetRatio = offsetAB / offsetBC;
        const cosine = totalTurn.cos();
        const sine = totalTurn.sin();
        const intersectionRadians = this.pickFromUpperPlaneIntersections(alphaSign * offsetRatio, betaSign * cosine, sine, phiSign);
        if (intersectionRadians !== undefined) {
          arcVector0 = perpBC.scaleToLength(offsetBC)!;
          arcVector90 = vectorBC.scaleToLength(offsetBC)!;
          arc = Arc3d.create(pointB, arcVector0, arcVector90, AngleSweep.createStartEndRadians(-phiSign * intersectionRadians, 0.0));
        } else {
          const offsetPointAB = this.offsetPointFromSegment(pointA, pointB, -offsetAB, 1.0);
          const offsetPointBC = this.offsetPointFromSegment(pointB, pointC, -offsetBC, 0.0);
          arc = LineSegment3d.create(offsetPointAB, offsetPointBC);
        }
      } else {
        const offsetRatio = offsetBC / offsetAB;
        const cosine = totalTurn.cos();
        const sine = totalTurn.sin();
        const intersectionRadians = this.pickFromUpperPlaneIntersections(alphaSign * offsetRatio, betaSign * cosine, sine, phiSign);
        if (intersectionRadians !== undefined) {
          arcVector0 = perpAB.scaleToLength(offsetAB)!;
          arcVector90 = vectorAB.scaleToLength(offsetAB)!;
          arc = Arc3d.create(pointB, arcVector0, arcVector90, AngleSweep.createStartEndRadians(0, phiSign * intersectionRadians));
        } else {
          const offsetPointAB = this.offsetPointFromSegment(pointA, pointB, -offsetAB, 1.0);
          const offsetPointBC = this.offsetPointFromSegment(pointB, pointC, -offsetBC, 0.0);
          arc = LineSegment3d.create(offsetPointAB, offsetPointBC);
        }
      }
    }
    if (arc !== undefined)
      return arc;
    // on fallthrough, create intersection of offset lines.
    const intersectionParameters = Vector2d.create();
    if (perpAB.normalizeInPlace() && perpBC.normalizeInPlace()) {
      const xAB = pointB.x + offsetAB * perpAB.x;
      const yAB = pointB.y + offsetAB * perpAB.y;
      const xBC = pointB.x + offsetBC * perpBC.x;
      const yBC = pointB.y + offsetBC * perpBC.y;
      if (SmallSystem.linearSystem2d(vectorAB.x, -vectorBC.x, vectorAB.y, -vectorBC.y, xBC - xAB, yBC - yAB, intersectionParameters)) {
        return Point3d.create(xAB + vectorAB.x * intersectionParameters.x, yAB + vectorAB.y * intersectionParameters.x, pointB.z);
      }
    }
    return undefined;
  }
  public static offsetPointFromSegment(pointA: Point3d, pointB: Point3d, offsetDistance: number, fraction: number): Point3d {
    const dAB = pointA.distance(pointB);
    const perpendicularFraction = Geometry.conditionalDivideFraction(offsetDistance, dAB);
    if (perpendicularFraction === undefined)
      return pointA.interpolate(fraction, pointB);
    return pointA.interpolatePerpendicularXY(fraction, pointB, perpendicularFraction);
  }
  /**
   * Append a line segment and variant joint to a growing chain
   * * The input point0 is the start of the line segment
   * * At conclusion, point0 is updated as the end point of the joint, i.e. start for next offset
   * * If the joint is geometry:
   *   * the line segment goes from input point0 to the start of the geometry
   *   * The output point0 is the end of the geometry
   * @param chain chain to grow
   * @param point0 start point.  see note about input and output status
   * @param joint Curve primitive or point for joint path.
   */
  public static appendSegmentAndJoint(chain: Path | Loop, point0: Point3d, joint: CurvePrimitive | Point3d | undefined) {
    if (joint instanceof CurvePrimitive) {
      chain.children.push(LineSegment3d.create(point0, joint.startPoint()));
      chain.children.push(joint);
      joint.endPoint(point0);
    } else if (joint instanceof Point3d) {
      chain.children.push(LineSegment3d.create(point0, joint));
      point0.setFrom(joint);
    }
  }
  /**
   * Create an offset path using createArc3dForLeftTurnOffsetRadiusChange to create joint geometry.
   * @param points point along the path
   * @param offsetDistances edgeDistances[i] is offset from points[i] to points[i+1]
   * @param close if true, force closure from last to first point.
   */
  public static edgeByEdgeOffsetFromPoints(points: Point3d[], offsetDistances: number[], close: boolean): Path | Loop | undefined {
    let n = points.length;
    if (n < 2)
      return undefined;
    if (close) {
      if (points[0].isAlmostEqual(points[n - 1]))
        n--;
      const loop = Loop.create();
      if (offsetDistances.length < n)
        return undefined;
      let point0;
      const joint0 = this.createJointWithRadiusChange(points[n - 1], points[0], points[1], offsetDistances[n - 1], offsetDistances[0]);
      if (!joint0)
        return undefined;
      if (joint0 instanceof Point3d)
        point0 = joint0.clone();
      else
        point0 = joint0.endPoint();
      for (let i = 0; i < n; i++) {
        const i0 = i;
        const i1 = (i + 1) % n;
        const i2 = (i + 2) % n;
        const joint = this.createJointWithRadiusChange(points[i0], points[i1], points[i2], offsetDistances[i0], offsetDistances[i1]);
        this.appendSegmentAndJoint(loop, point0, joint);
      }
      return loop;
    } else {
      if (offsetDistances.length + 1 < n)
        return undefined;
      const path = Path.create();
      const point0 = this.offsetPointFromSegment(points[0], points[1], -offsetDistances[0], 0.0);
      for (let i = 0; i + 2 < n; i++) {
        const joint = this.createJointWithRadiusChange(points[i], points[i + 1], points[i + 2], offsetDistances[i], offsetDistances[i + 1]);
        this.appendSegmentAndJoint(path, point0, joint);
      }
      const point1 = this.offsetPointFromSegment(points[n - 2], points[n - 1], -offsetDistances[n - 2], 1.0);
      this.appendSegmentAndJoint(path, point0, point1);
      return path;
    }
  }
  /**
   * Intersect `alpha+cosineCoff*c + sineCoff * s` with unit circle `c*c+s*s=1`.
   * * If there are two intersections (possibly double counting tangency) in positive s,
   *    * if phiSign is positive, work with the given angles.
   *    * if phiSign is negative, shift by PI (caller will negate that ... this is trial and error that works for all combinations of offset and turn.)
   *    * if both angles are positive, return the smaller magnitude.
   * * Otherwise return undefined.
   * @param alpha
   * @param cosineCoff
   * @param sineCoff
   * @param phiSign
   */
  public static pickFromUpperPlaneIntersections(alpha: number, cosineCoff: number, sineCoff: number, phiSign: number): number | undefined {
    const intersectionRadians = new GrowableFloat64Array(2);
    AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, cosineCoff, sineCoff, undefined, undefined, intersectionRadians);
    let candidate: number | undefined;
    if (intersectionRadians.length === 1) {
      candidate = phiSign * intersectionRadians.atUncheckedIndex(0);
    } else if (intersectionRadians.length === 2) {
      let a0 = intersectionRadians.atUncheckedIndex(0);
      let a1 = intersectionRadians.atUncheckedIndex(1);
      if (phiSign < 0) {
        a0 += Math.PI;
        a1 += Math.PI;
      }
      if (a0 > 0.0 && a1 > 0.0 && Math.abs(a1 - a0) < Math.PI) {
        candidate = Math.min(a0, a1);
        return candidate;
      }
    }
    return undefined;
  }
}
