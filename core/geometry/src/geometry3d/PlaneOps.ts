/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Geometry, PlaneAltitudeEvaluator, Point3dPoint3d } from "../Geometry";
import { SmallSystem } from "../numerics/Polynomials";
import { Angle } from "./Angle";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Ray3d } from "./Ray3d";
/**
 * Plane3dPlane3dIntersectionCases has one optional member
 * for each possible configuration of 2 planes.
 * The return value of [[PlaneOps.intersect2Planes]] will have at most one of these defined.
 * @public
 */
export interface Plane3dPlane3dIntersectionCases {
  /** The planes have simple intersection in a Ray */
  ray?: Ray3d;
  /** The planes are coincident. */
  plane?: Plane3dByOriginAndUnitNormal;
  /** The planes are parallel.  The separatorSegment has one point on each of the two planes.  */
  separatorSegment?: Point3dPoint3d;
}

/**
 * Plane3dPlane3dPlane3dIntersectionCases has optional member for each possible configuration of 3 planes.
 * * The return value of [[PlaneOps.intersect3Planes]] will have at most one of {point, ray, plane} defined.
 * * In cases other than the single point, the pairwiseDetail member is present and contains the 3 pairwise relations among planes
 * @public
 */
export interface Plane3dPlane3dPlane3dIntersectionCases {
  /** Single point of intersection.
   * * When this is defined, no other members are defined.
   */
  point?: Point3d;
  /** The planes have simple intersection in a Ray */
  ray?: Ray3d;
  /** The planes are coincident. */
  plane?: Plane3dByOriginAndUnitNormal;
  /** The planes are parallel.  The separatorSegment has one point on each of the two planes.  */
  separatorSegment?: Point3dPoint3d;
  /** If the intersection is anything other than either (a) single point or (b) fully coincident planes, the details array will contain the 3 pairwise configurations
   * among planeA, planeB, planeC:
   *   * pairwiseDetail[0] is the intersection of planeA and planeB
   *   * pairwiseDetail[1] is the intersection of planeB and planeC
   *   * pairwiseDetail[2] is the intersection of planeC and planeA
   * * Some specific configurations to note are:
   *   * When the three planes are parallel but not a single plane, each of the three pairwiseDetail members will be a Point3dPoint3d pair.  Note that in
   *         this case there are no points common to all three planes and the point, ray, and plane members are all undefined.
   *   * When two planes are coincident and the third intersects, the entry for the coincident pair is the coincident plane, and the other two are
   *      the intersection ray.
   *   * When all three intersect in a ray but with no pairwise coincident plane, the ray is repeated 3 times.
   *   * When the pairwise intersections are all rays that are parallel, all three rays are present.
   */
  pairwiseDetail?: Plane3dPlane3dIntersectionCases[];
}
/**
 * Plane3dRay3dIntersectionCases is has members to fully describe the relationship of a plane and ray.
 * * The return from [[PlaneOps.intersectRayPlane]] will have one and only one if the three members
 *     {point,ray, separatorSegment} present.
 * @public
 */
export interface Ray3dPlane3dIntersectionCases {
  /** For the case where the ray cuts cleanly through the plane, single point of intersection */
  point?: Point3d;
  /** For the case where the ray is completely within the plane, a clone of the input ray. */
  ray?: Ray3d;
  /** For the case of the ray parallel and non-intersecting, pair of (distinct) points,
   *   * pointA on the ray
   *   * pointB on the plane
   *   * projection of pointA to the plane is pointB, and projection of pointB to the ray is pointA. */
  separatorSegment?: Point3dPoint3d;
}

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
    const pointA = PlaneOps.closestPointToOrigin(planeA);
    const pointB = PlaneOps.projectPointToPlane(planeB, pointA);
    return { pointA, pointB };
  }

  /** Returns the relationship of 2 planes:
   * * Each plane can be any form that returns normal and altitude evaluations via methods in [[PlaneAltitudeEvaluator]]
   * * Return value has variants for
   *   * If intersecting in a line, a Ray3d on the line of intersection
   *   * If identical planes, a Plane3dByOriginAndUnitNormal with the same normal and distance from origin as planeA
   *   * If distinct parallel planes: a Point3dPoint3d with a point on planeA and its projection on planeB
   *   * If extraordinary tolerance issues prevent any of those, the returned object has all undefined members.
   *      * This might indicate a 000 normal, which is not expected on a valid plane.
   */
  public static intersect2Planes(planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator): Plane3dPlane3dIntersectionCases {
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
        return { plane: Plane3dByOriginAndUnitNormal.create(originA, normalA) };
      else
        return { separatorSegment: PlaneOps.createPoint3dPoint3dBetweenPlanes(planeA, planeB) };
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
        return { ray: Ray3d.createXYZUVW(vectorToPoint.x, vectorToPoint.y, vectorToPoint.z, crossProduct.x, crossProduct.y, crossProduct.z) };
      // uh oh.  What can this mean? All exact-arithmetic cases are covered.
      return {};
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
  public static intersect3Planes(planeA: PlaneAltitudeEvaluator,
    planeB: PlaneAltitudeEvaluator,
    planeC: PlaneAltitudeEvaluator): Plane3dPlane3dPlane3dIntersectionCases {
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
      return { point: Point3d.create(simpleIntersection.x, simpleIntersection.y, simpleIntersection.z) };
    let numPlanes = 0;
    const allPlanes = [planeA, planeB, planeC, planeA]; // repeat planeA for easy wraparound indexing
    // The 3 normals are not independent.
    // Find which pairs are parallel, coincident, or intersecting.
    const pairwiseDetail: Array<Plane3dPlane3dPlane3dIntersectionCases> = [];
    for (let i0 = 0; i0 < 3; i0++) {
      const r = PlaneOps.intersect2Planes(allPlanes[i0], allPlanes[i0 + 1]);
      pairwiseDetail.push(r);
      if (r.plane !== undefined)
        numPlanes++;
    }
    // Each of the 3 pairwiseDetail combinations was pushed.
    // If the were all planes, it's true intersection of just one plane
    if (numPlanes === 3) {
      return { plane: pairwiseDetail[0].plane };
    }

    return {
      ray: this.extractSingleRayFromPlanePlanePlaneDetails(pairwiseDetail), pairwiseDetail,
    };
  }
  // If all three pairwiseDetail entries are the same ray, return (a clone of) it.  Otherwise return undefined.
  private static extractSingleRayFromPlanePlanePlaneDetails(pairwiseDetail: Plane3dPlane3dIntersectionCases[]): Ray3d | undefined {
    let numCoincident = 0;
    let numParallel = 0;
    const allRays = [];
    for (const detail of pairwiseDetail) {
      if (detail.ray) {
        allRays.push(detail.ray);
      }
      if (detail.plane)
        numCoincident++;
      if (detail.separatorSegment)
        numParallel++;
    }

    if (numCoincident === 1 && allRays.length === 2) {
      if (allRays[0].isAlmostEqualPointSet(allRays[1]))
        return allRays[0].clone();
    } else if (numParallel === 1 && allRays.length === 1) {
      return allRays[0];
    } else if (allRays.length === 3) {
      if (allRays[0].isAlmostEqualPointSet(allRays[1]) && allRays[0].isAlmostEqualPointSet(allRays[2])) {
        return allRays[0];
      }
    }
    return undefined;
  }
  /**
   * Using the altitude and normal data, determine if planeA and planeB have a parallel or coplanar relationship:
   * * return 0 if the planes are not parallel.
   * * return 1 if the planes are coplanar with normals in the same direction
   * * return 2 if the planes are parallel (but not coplanar) with normals in the same direction but different distance from origin.
   * * return -2 if the planes are coplanar with opposing normals
   * * return -2 if the planes are parallel but not coplanar, with opposing normals.
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
  public static closestPointToOrigin(plane: PlaneAltitudeEvaluator): Point3d {
    const d = -plane.altitudeXYZ(0, 0, 0);
    return Point3d.create(d * plane.normalX(), d * plane.normalY(), d * plane.normalZ());
  }

  /**
   * On a plane that provides normal component evaluations, assemble the components into a vector
   * @param plane plane to evaluate
   * @returns vector normal to the plane
   */
  public static planeNormal(plane: PlaneAltitudeEvaluator): Vector3d {
    return Vector3d.create(plane.normalX(), plane.normalY(), plane.normalZ());
  }

  /**
   * Project spacePoint to the plane.
   * @param plane plane for projection.
   * @returns Closest point to the spacePoint
   */
  public static projectPointToPlane(plane: PlaneAltitudeEvaluator, spacePoint: Point3d): Point3d {
    const d = -plane.altitude(spacePoint);
    return spacePoint.plusXYZ(d * plane.normalX(), d * plane.normalY(), d * plane.normalZ());
  }
  /**
     * Return the intersection of the unbounded ray with plane.
     * @returns the point of intersection, the cloned input ray if coplanar, or a separator segment if ray is parallel and non-coplanar
     */
  public static intersectRayPlane(ray: Ray3d, plane: PlaneAltitudeEvaluator): Ray3dPlane3dIntersectionCases {
    const altitude = plane.altitude(ray.origin);
    const velocity = plane.velocity(ray.direction);
    const division = Geometry.conditionalDivideFraction(-altitude, velocity);
    if (undefined === division) {
      // The ray is parallel or in the plane.
      if (Geometry.isSmallMetricDistance(altitude))
        return { ray: ray.clone() };
      const pointOnPlane = PlaneOps.projectPointToPlane(plane, ray.origin);
      return { separatorSegment: { pointA: ray.origin.clone(), pointB: pointOnPlane } };
    } else
      return { point: ray.fractionToPoint(division) };
  }
}
