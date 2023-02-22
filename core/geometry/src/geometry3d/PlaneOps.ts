/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { SmallSystem } from "../numerics/Polynomials";
import { Angle } from "./Angle";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Point3dPoint3d } from "./Point3dPoint3d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Ray3d } from "./Ray3d";
/**
 * Class of STATIC methods to operate on planes of varying underlying representations.
 * @public
 */
export class PlaneOps {
  /**
   * Find a point on the plane (via getOriginOnPlaneAltitudeEvaluator) and the project that to planeB.
   * @param planeA
   * @param planeB
   */
  private static createPoint3dPoint3dBetweenPlanes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator): Point3dPoint3d {
    const pointA = PlaneOps.getOriginOnPlaneAltitudeEvaluator(planeA);
    const pointB = PlaneOps.projectPointToPlane(planeB, pointA);
    return Point3dPoint3d.create(pointA, pointB);
  }
  /** Returns the relationship of 2 planes:
   * * Each plane can be any form that returns normal and altitude evaluations via methods in [[PlaneAltitudeEvaluator]]
   * * Return value has variants for
   *   * If intersecting in a line, a Ray3d on the line of intersection
   *   * If identical planes, a Plane3dByOriginAndUnitNormal with the same normal and distance from origin as planeA
   *   * If distinct parallel planes: a Point3dPoint3d with a point on planeA and its projection on planeB
   *   * If extraordinary tolerance issues prevent any of those, undefined is returned.
   *      * This might indicate a 000 normal, which is not expected on a valid plane.
   */
  public static intersect2Planes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator):
    Ray3d | Plane3dByOriginAndUnitNormal | Point3dPoint3d | undefined {
    const normalAx = planeA.normalX(), normalAy = planeA.normalY(), normalAz = planeA.normalZ();
    const normalBx = planeB.normalX(), normalBy = planeB.normalY(), normalBz = planeB.normalZ();
    const distanceA = planeA.altitudeXYZ(0, 0, 0), distanceB = planeB.altitudeXYZ(0, 0, 0);
    // Try the most common case without forming an intermediate matrix . . .
    const normalA = Vector3d.create(normalAx, normalAy, normalAz);
    const normalB = Vector3d.create(normalBx, normalBy, normalBz);
    const crossProduct = normalA.crossProduct(normalB);
    if (!crossProduct.tryNormalizeInPlace()) {
      // Parallel planes.
      // get distanceB with orientation of normalB matching that of normalA
      const distanceB1 = normalA.dotProduct(normalB) > 0.0 ? distanceB : -distanceB;
      const originA = Point3d.createScale(normalA, -distanceA);
      const originB = Point3d.createScale(normalB, -distanceB1);
      if (originA.isAlmostEqualMetric(originB))
        return Plane3dByOriginAndUnitNormal.create(originA, normalA);
      else
        return PlaneOps.createPoint3dPoint3dBetweenPlanes(planeA, planeB);
    } else {
      // the cross product vector is directed along the intersection of these two planes.
      // find a single point on that ray by intersecting the 2 planes with a 3rd plane through the origin
      const vectorToPoint = SmallSystem.linearSystem3d(
        normalA.x, normalA.y, normalA.z,
        normalB.x, normalB.y, normalB.z,
        crossProduct.x, crossProduct.y, crossProduct.z,
        -distanceA, -distanceB, 0.0);
      // remark: Since the cross product had nonzero length, the linear system should always has a solution.
      if (vectorToPoint !== undefined)
        return Ray3d.createXYZUVW(vectorToPoint.x, vectorToPoint.y, vectorToPoint.z, crossProduct.x, crossProduct.y, crossProduct.z);
      // uh oh.  What can this mean? All exact-arithmetic cases are covered.
      return undefined;
    }
  }

  /** Returns the intersection of 3 planes.
   * * Each plane can be any form that returns normal and altitude evaluations via methods in [[PlaneAltitudeEvaluator]]
   * * Return value has variants for
   *   * Point3d: (usual case) single point of intersection
   *   * Plane3dByOriginAndUnitNormal: fully coincident 3 planes
   * * All other configurations return as an array of the 3 pairwise intersection among [planeA ^ planeB, planeB ^ planeC, planeC ^ planeA].
   *   * Each of those 3 pairs can produce coincident planes, a pair of points that project to each other between parallel planes, or a ray of intersection,
   *     as described by [[Plane3dByOriginAndUnitVector.intersect2Planes]]
   * * undefined as a result indicates really bad data like 000 normal vectors.
   */
  public static intersect3Planes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator, planeC: PlaneAltitudeEvaluator):
    Point3d | Plane3dByOriginAndUnitNormal | Array<Ray3d | Plane3dByOriginAndUnitNormal | Point3dPoint3d | undefined> | undefined {
    const normalAx = planeA.normalX(), normalAy = planeA.normalY(), normalAz = planeA.normalZ();
    const normalBx = planeB.normalX(), normalBy = planeB.normalY(), normalBz = planeB.normalZ();
    const normalCx = planeC.normalX(), normalCy = planeC.normalY(), normalCz = planeC.normalZ();
    const distanceA = planeA.altitudeXYZ(0, 0, 0), distanceB = planeB.altitudeXYZ(0, 0, 0), distanceC = planeC.altitudeXYZ(0, 0, 0);
    // Try the most common case without forming an intermediate matrix . . .
    const simpleIntersection = SmallSystem.linearSystem3d(
      normalAx, normalAy, normalAz,
      normalBx, normalBy, normalBz,
      normalCx, normalCy, normalCz,
      -distanceA, -distanceB, -distanceC);
    // UGH -- SmallSystem returned a vector, have to restructure as a point . . .
    if (simpleIntersection !== undefined)
      return Point3d.create(simpleIntersection.x, simpleIntersection.y, simpleIntersection.z);
    let numPlanes = 0;
    let numUndefined = 0;
    const allPlanes = [planeA, planeB, planeC, planeA]; // repeat planeA for easy wraparound indexing
    // The 3 normals are not independent.
    // Find which pairs are parallel, coincident, or intersecting.
    const result: Array<Ray3d | Plane3dByOriginAndUnitNormal | Point3dPoint3d | undefined> = [];
    for (let i0 = 0; i0 < 3; i0++) {
      const r = Plane3dByOriginAndUnitNormal.intersect2Planes(allPlanes[i0], allPlanes[i0 + 1]);
      result.push(r);
      if (r === undefined)
        numUndefined++;
      else if (r instanceof Plane3dByOriginAndUnitNormal)
        numPlanes++;
    }
    // Each of the 3 combinations was pushed.
    // If the were all planes, it's true intersection of just one plane
    if (numPlanes === 3) {
      return result[0] as Plane3dByOriginAndUnitNormal;
    }
    if (numUndefined === 3)
      return undefined;
    return result;
  }
  /**
   * Using the altitude and normal data, determine if planeA and planeB have a parallel or coplanar relationship:
   * * return 0 if the planes are not parallel.
   * * return 1 if the planes are coplanar with normals in the same direction
   * * return 2 if the planes are parallel (but not coplanar) with normals in the same direction but different distance from origin.
   * * return -2 if the planes are coplanar with opposing normals
   * * return 2 if the planes are parallel (but not coplanar) with opposing normals.
   * @param planeA
   * @param planeB
   * @returns
   */
  public static classifyIfParallelPlanes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator): 0 | 1 | -1 | 2 | -2 {
    const altitudeA = planeA.altitudeXYZ(0, 0, 0);
    const altitudeB = planeB.altitudeXYZ(0, 0, 0);
    const normalAx = planeA.normalX(), normalAy = planeA.normalY(), normalAz = planeA.normalZ();
    const normalBx = planeB.normalX(), normalBy = planeB.normalY(), normalBz = planeB.normalZ();
    const radians = Angle.radiansBetweenVectorsXYZ(normalAx, normalAy, normalAz, normalBx, normalBy, normalBz);
    // nb radians is always positive -- no vector available to resolve up and produce negative.
    let sign = 0;
    if (radians < Geometry.smallAngleRadians)
      sign = 1;
    else if (Math.abs(radians - Math.PI) < Geometry.smallAngleRadians)
      sign = -1;
    else
      return 0;
    const ax = -altitudeA * normalAx, ay = -altitudeA * normalAy, az = -altitudeA * normalAz;
    const bx = -altitudeB * normalBx, by = -altitudeB * normalBy, bz = -altitudeB * normalBz;
    if (Geometry.isSmallMetricDistance(Geometry.distanceXYZXYZ(ax, ay, az, bx, by, bz)))
      return sign > 0 ? 1 : -1;   // The value of sign itself is returned, but type checker doesn't get that.
    else
      return sign > 0 ? 2 : -2;
  }
  /**
   * On a plane that provides normal and distance evaluations (but might not store an origin) use the evaluations to get a point on the plane
   * @param plane plane to evaluate
   * @returns Closest point to the origin
   */
  public static getOriginOnPlaneAltitudeEvaluator(plane: PlaneAltitudeEvaluator): Point3d {
    const d = -plane.altitudeXYZ(0, 0, 0);
    return Point3d.create(d * plane.normalX(), d * plane.normalY(), d * plane.normalZ());
  }

  /**
   * Project spacePoint to a plane.
   * @param plane plane for projection.
   * @returns Closest point to the spacePoint
   */
  public static projectPointToPlane(plane: PlaneAltitudeEvaluator, spacePoint: Point3d): Point3d {
    const d = -plane.altitude(spacePoint);
    return spacePoint.plusXYZ(d * plane.normalX(), d * plane.normalY(), d * plane.normalZ());
  }

}
