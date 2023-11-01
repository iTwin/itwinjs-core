/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedXYZCollection } from "./IndexedXYZCollection";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { PolylineCompressionContext } from "./PolylineCompressionByEdgeOffset";
import { Range1d } from "./Range";

// cspell:word Puecker
/**
 * PolylineOps is a collection of static methods operating on polylines.
 * @public
 */
export class PolylineOps {
  /**
   * Return a Range1d with the shortest and longest edge lengths of the polyline.
   * @param points points to examine.
   */
  public static edgeLengthRange(points: Point3d[]): Range1d {
    const range = Range1d.createNull();
    for (let i = 1; i < points.length; i++) {
      range.extendX(points[i - 1].distance(points[i]));
    }
    return range;
  }
  /**
   * Return a simplified subset of given points.
   * * Points are removed by the Douglas-Puecker algorithm, viz https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
   * * This is a global search, with multiple passes over the data.
   * @param source
   * @param chordTolerance
   */
  public static compressByChordError(source: Point3d[], chordTolerance: number): Point3d[] {
    return PolylineCompressionContext.compressPoint3dArrayByChordError(source, chordTolerance);
  }
  /**
   * Return a simplified subset of given points, omitting points if very close to their neighbors.
   * * This is a local search, with a single pass over the data.
   * @param source input points
   * @param maxEdgeLength
   */
  public static compressShortEdges(source: Point3d[] | IndexedXYZCollection, maxEdgeLength: number): Point3d[] {
    const dest = GrowableXYZArray.create(source);
    PolylineCompressionContext.compressInPlaceByShortEdgeLength(dest, maxEdgeLength);
    return dest.getPoint3dArray();
  }
  /**
   * Return a simplified subset of given points, omitting points of the triangle with adjacent points is small.
   * * This is a local search, with a single pass over the data.
   * @param source input points
   * @param maxEdgeLength
   */
  public static compressSmallTriangles(source: Point3d[], maxTriangleArea: number): Point3d[] {
    const dest = GrowableXYZArray.create(source);
    PolylineCompressionContext.compressInPlaceBySmallTriangleArea(dest, maxTriangleArea);
    return dest.getPoint3dArray();
  }

  /**
   * Return a simplified subset of given points, omitting points if close to the edge between neighboring points before and after
   * * This is a local search, with a single pass over the data for each pass.
   * @param source input points
   * @param maxDistance omit points if this close to edge between points before and after
   * @param numPass max number of times to run the filter.  numPass=2 is observed to behave well.
   *
   */
  public static compressByPerpendicularDistance(source: Point3d[], maxDistance: number, numPass: number = 2): Point3d[] {
    const dest = GrowableXYZArray.create(source);
    let num0 = dest.length;
    for (let pass = 0; pass < numPass; pass++) {
      PolylineCompressionContext.compressInPlaceByPerpendicularDistance(dest, maxDistance);
      const num1 = dest.length;
      if (num1 === num0)
        break;
      num0 = num1;
    }
    return dest.getPoint3dArray();
  }
  private static squaredDistanceToInterpolatedPoint(pointQ: Point3d, point0: Point3d, fraction: number, point1: Point3d): number {
    const g = 1.0 - fraction;
    const dx = pointQ.x - (g * point0.x + fraction * point1.x);
    const dy = pointQ.y - (g * point0.y + fraction * point1.y);
    const dz = pointQ.z - (g * point0.z + fraction * point1.z);
    return dx * dx + dy * dy + dz * dz;
  }
  /**
   * test if either
   *   * points[indexA] matches pointQ
   *   * line from points[indexA] to points[indexB] overlaps points[indexA] to pointQ
   * @param points
   * @param pointQ
   * @param tolerance
   */
  private static isDanglerConfiguration(points: Point3d[], indexA: number, indexB: number, pointQ: Point3d, squaredDistanceTolerance: number): boolean {
    if (indexA < 0 || indexA >= points.length)
      return false;
    const pointA = points[indexA];
    // simple point match ...
    const d2Q = pointA.distanceSquared(pointQ);
    if (d2Q <= squaredDistanceTolerance)
      return true;
    if (indexB < 0 || indexB >= points.length)
      return false;
    const pointB = points[indexB];
    // The expensive test .. does newPoint double back to an interior or extrapolation of the final dest segment?
    //
    // or pointQ
    const dot = pointA.dotVectorsToTargets(pointB, pointQ);
    // simple case -- pointB..pointA..pointQ continues forward
    if (dot <= 0.0)
      return false;
    const d2B = pointA.distanceSquared(pointB);
    let distanceSquared;
    if (d2Q >= d2B) {
      //                        pointB----------------------------------->>>>>>> pointA
      //          pointQ<<<<---------------------------------------------------------
      const fraction = dot / d2Q; // safe to divide because of earlier d2Q test.
      distanceSquared = this.squaredDistanceToInterpolatedPoint(pointB, pointA, fraction, pointQ);
    } else {
      //           pointB----------------------------------->>>>>>> pointA
      //                         pointQ<<<<----------------------
      const fraction = dot / d2B;
      distanceSquared = this.squaredDistanceToInterpolatedPoint(pointQ, pointA, fraction, pointB);
    }
    return distanceSquared < squaredDistanceTolerance;
  }
  /**
     * Return a simplified subset of given points, omitting points on "danglers" that depart and return on a single path.
     * @param source input points
     * @param closed if true, an edge returning to point 0 is implied even if final point does not match.
     * @param tolerance tolerance for near-zero distance.
     */
  public static compressDanglers(source: Point3d[], closed: boolean = false, tolerance: number = Geometry.smallMetricDistance): Point3d[] {
    let n = source.length;
    const squaredDistanceTolerance = tolerance * tolerance;
    if (closed)
      while (n > 1 && source[n - 1].distanceSquared(source[0]) <= squaredDistanceTolerance)
        n--;
    const dest = [];
    dest.push(source[0].clone());
    for (let i = 1; i < n; i++) {
      const newPoint = source[i];
      while (this.isDanglerConfiguration(dest, dest.length - 1, dest.length - 2, newPoint, squaredDistanceTolerance))
        dest.pop();
      dest.push(newPoint.clone());
    }
    if (closed) {
      // No purge moving backwards.   Last point
      let leftIndex = 0;
      let rightIndex = dest.length - 1;
      while (rightIndex > leftIndex + 2) {
        if (this.isDanglerConfiguration(dest, leftIndex, leftIndex + 1, dest[rightIndex], squaredDistanceTolerance)) {
          leftIndex++;
        } else if (this.isDanglerConfiguration(dest, rightIndex, rightIndex - 1, dest[leftIndex], squaredDistanceTolerance)) {
          rightIndex--;
        } else {
          break;
        }
      }
      if (rightIndex + 1 < dest.length)
        dest.length = rightIndex + 1;
      if (leftIndex > 0) {
        dest.splice(0, leftIndex);
      }
    }
    return dest;
  }
  /**
   * Add closure points to a polyline or array of polylines
   * @param data points.
   */
  public static addClosurePoint(data: Point3d[] | Point3d[][]) {
    if (data.length === 0)
      return;
    const q0 = data[0];
    if (Array.isArray(q0)) {
      for (const child of data) {
        if (Array.isArray(child))
          this.addClosurePoint(child);
      }
      return;
    }
    const q1 = data[data.length - 1];
    if (q0 instanceof Point3d && q1 instanceof Point3d && !q0.isAlmostEqual(q1)) {
      (data as Point3d[]).push(q0.clone());
    }
  }
  /**
   * Remove closure points a polyline or array of polylines
   * @param data points.
   */
  public static removeClosurePoint(data: Point3d[] | Point3d[][]) {
    if (data.length === 0)
      return;
    const q0 = data[0];
    if (Array.isArray(q0)) {
      for (const child of data) {
        if (Array.isArray(child))
          this.removeClosurePoint(child);
      }
      return;
    }
    const q1 = data[data.length - 1];
    if (q0 instanceof Point3d && q1 instanceof Point3d && q0.isAlmostEqual(q1)) {
      (data as Point3d[]).pop();
    }
  }
  /** Create an array of planes.
   * * First plane has origin at first centerline point, with unit normal directed at the next point.
   * * Intermediate planes have origin at intermediate points, with unit normals computed from the average of unit vectors along the incoming and outgoing segments.
   * * Last plane has origin at last centerline point, with unit normal directed from previous point.
   * * All sets of adjacent coincident points are reduced to a single point.
   *    * Hence the output array may have fewer points than the centerline.
   * * If there are one or fewer distinct input points, the return is undefined
   * @param centerline points to reside in output planes
   * @param wrapIfPhysicallyClosed if true and the first and last centerline points are the same, then the first and last output planes are averaged and equated (cloned).
   */
  public static createBisectorPlanesForDistinctPoints(centerline: IndexedXYZCollection | Point3d[], wrapIfPhysicallyClosed: boolean = false): Plane3dByOriginAndUnitNormal[] | undefined {
    const packedPoints = PolylineOps.compressShortEdges(centerline, 2.0 * Geometry.smallMetricDistance);  // double the tolerance to ensure normalized vectors exist.
    if (packedPoints.length < 2)
      return undefined;
    const bisectorPlanes: Plane3dByOriginAndUnitNormal[] = [];
    const point0 = packedPoints[0];
    const point1 = packedPoints[1];
    const unit01 = Vector3d.createNormalizedStartEnd(point0, point1)!;
    const perpendicular0 = Plane3dByOriginAndUnitNormal.create(point0, unit01)!;
    const perpendicular1 = Plane3dByOriginAndUnitNormal.createXYPlane();
    // FIRST point gets simple perpendicular
    bisectorPlanes.push(perpendicular0.clone());
    // Each intermediate point gets average of adjacent perpendiculars
    for (let i = 1; i + 1 < packedPoints.length; i++) {
      Vector3d.createNormalizedStartEnd(packedPoints[i], packedPoints[i + 1], unit01);
      // remark: the prior pack should ensure the normalization is ok.  But if it fails, we ignore this point...
      if (undefined !== Plane3dByOriginAndUnitNormal.create(packedPoints[i], unit01, perpendicular1)) {
        const newBisectorNormal = perpendicular0.getNormalRef().interpolate(0.5, perpendicular1.getNormalRef());
        const newBisectorPlane = Plane3dByOriginAndUnitNormal.create(packedPoints[i], newBisectorNormal);
        if (undefined !== newBisectorPlane)
          bisectorPlanes.push(newBisectorPlane);
        perpendicular0.setFrom(perpendicular1);
      }
    }
    // LAST point gets simple perpendicular inherited from last pass
    bisectorPlanes.push(Plane3dByOriginAndUnitNormal.create(packedPoints[packedPoints.length - 1], perpendicular0.getNormalRef())!);
    // reset end planes to their average plane, but leave them alone if the closure point is a cusp
    const lastIndex = bisectorPlanes.length - 1;
    if (lastIndex > 0 && wrapIfPhysicallyClosed) {
      const firstPlane = bisectorPlanes[0];
      const lastPlane = bisectorPlanes[lastIndex];
      if (Geometry.isSamePoint3d(firstPlane.getOriginRef(), lastPlane.getOriginRef())) {
        const newBisectorNormal = firstPlane.getNormalRef().plus(lastPlane.getNormalRef()); // could be zero vector at a cusp
        const newBisectorPlane = Plane3dByOriginAndUnitNormal.create(firstPlane.getOriginRef(), newBisectorNormal);
        if (undefined !== newBisectorPlane) {
          bisectorPlanes[0] = newBisectorPlane;
          bisectorPlanes[lastIndex] = Plane3dByOriginAndUnitNormal.create(lastPlane.getOriginRef(), newBisectorNormal)!;
        }
      }
    }
    return bisectorPlanes.length > 1 ? bisectorPlanes : undefined;
  }
  /**
   * * Treat the segment from points[segmentIndex] to points[segmentIndex+1] as an line segment.
   * * compute the fraction where spacePoint projects to that segment.
   * * restrict the fraction to 0..1, but optionally extend first and last segments.
   * @param points polyline points
   * @param spacePoint any point in space
   * @param segmentIndex index of the first point of the segment.
   * @param extendIfInitial true to allow the initial segment to extend backward (to negative fractions)
   * @param extendIfFinal true to allow the final segment to extend backward (to fractions above 1)
   * @returns CurveLocationDetail containing the the point and fraction.  The `a` value in the CurveLocationDetail is the segmentIndex.
   */
  public static projectPointToUncheckedIndexedSegment(
    spacePoint: Point3d,
    points: Point3d[],
    segmentIndex: number,
    extendIfInitial: boolean = false,
    extendIfFinal: boolean = false,
    result?: CurveLocationDetail): CurveLocationDetail {
    let fraction = spacePoint.fractionOfProjectionToLine(points[segmentIndex], points[segmentIndex + 1]);
    if (fraction < 0.0) {
      if (segmentIndex > 0 || !extendIfInitial)
        fraction = 0.0;
    } else if (fraction > 1.0) {
      if (!(segmentIndex + 2 === points.length && extendIfFinal))
        fraction = 1.0;
    }
    const point = points[segmentIndex].interpolate(fraction, points[segmentIndex + 1]);
    const cld = CurveLocationDetail.createCurveFractionPoint(undefined, fraction, point, result);
    cld.a = segmentIndex;
    return cld;
  }
}
