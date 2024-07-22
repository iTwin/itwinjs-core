/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { CurveExtendMode, CurveExtendOptions, VariantCurveExtendParameter } from "../curve/CurveExtendMode";
import { CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedXYZCollection } from "./IndexedXYZCollection";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Point3dArrayCarrier } from "./Point3dArrayCarrier";
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
   * Remove closure points of a polyline or array of polylines
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

  private static _workSegmentA?: LineSegment3d;
  private static _workSegmentB?: LineSegment3d;
  private static _workLocalDetailPair?: CurveLocationDetailPair;
  /**
   * Find smallest distance between polylines.
   * * For polylines with many points, it is more efficient to use [[LineString3dRangeTreeContext.searchForClosestApproach]].
   * @param pointsA first polyline
   * @param extendA how to extend polylineA forward/backward
   * @param pointsB second polyline
   * @param extendB how to extend polylineB forward/backward
   * @param dMax largest approach distance to consider
   * @param result optional pre-allocated object to populate and return
   * @returns pair of details, one for each polyline, with field values:
   * * `a` is the closest approach distance
   * * `point` is the point of closest approach
   * * `fraction` is the global polyline fraction
   * * `childDetail.a` is the segment index
   * * `childDetail.fraction` is the local segment fraction
   */
  public static closestApproach(
    pointsA: Point3d[] | IndexedXYZCollection,
    extendA: VariantCurveExtendParameter,
    pointsB: Point3d[] | IndexedXYZCollection,
    extendB: VariantCurveExtendParameter,
    dMax: number = Number.MAX_VALUE,
    result?: CurveLocationDetailPair,
  ): CurveLocationDetailPair | undefined {
    if (Array.isArray(pointsA))
      pointsA = new Point3dArrayCarrier(pointsA);
    if (Array.isArray(pointsB))
      pointsB = new Point3dArrayCarrier(pointsB);
    let dMin = dMax;
    let foundMin = false;
    const numSegmentA = pointsA.length - 1;
    const numSegmentB = pointsB.length - 1;
    const extendSegA = [CurveExtendMode.None, CurveExtendMode.None];
    const extendSegB = [CurveExtendMode.None, CurveExtendMode.None];
    // lambda to set extension for first and last segment of a polyline
    const convertExtend = (extendOut: CurveExtendMode[], extendIn: VariantCurveExtendParameter, segmentIndex: number, numSegments: number) => {
      extendOut[0] = extendOut[1] = CurveExtendMode.None;
      if (segmentIndex === 0)
        extendOut[0] = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendIn, 0);
      else if (segmentIndex === numSegments - 1)
        extendOut[1] = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendIn, 1);
    };
    // lambda to extract LineSegment3d from polyline
    const fillSegment = (points: IndexedXYZCollection, index: number, segment: LineSegment3d | undefined): LineSegment3d => {
      if (segment === undefined)
        return LineSegment3d.createCapture(points.getPoint3dAtUncheckedPointIndex(index), points.getPoint3dAtUncheckedPointIndex(index + 1));
      points.getPoint3dAtUncheckedPointIndex(index, segment.point0Ref);
      points.getPoint3dAtUncheckedPointIndex(index + 1, segment.point1Ref);
      return segment;
    };
    // just test the segments
    for (let indexA = 0; indexA < numSegmentA; indexA++) {
      this._workSegmentA = fillSegment(pointsA, indexA, this._workSegmentA);
      convertExtend(extendSegA, extendA, indexA, numSegmentA);
      for (let indexB = 0; indexB < numSegmentB; indexB++) {
        this._workSegmentB = fillSegment(pointsB, indexB, this._workSegmentB);
        convertExtend(extendSegB, extendB, indexB, numSegmentB);
        if (undefined !== (this._workLocalDetailPair = LineSegment3d.closestApproach(this._workSegmentA, extendSegA, this._workSegmentB, extendSegB, this._workLocalDetailPair))) {
          const d = this._workLocalDetailPair.detailA.a;
          if (d < dMin) {
            const childDetailA = result?.detailA.childDetail; // save and reuse
            const childDetailB = result?.detailB.childDetail;
            result = this._workLocalDetailPair.clone(result); // overwrite previous result
            LineString3d.convertLocalToGlobalDetail(result.detailA, indexA, numSegmentA, undefined, childDetailA);
            LineString3d.convertLocalToGlobalDetail(result.detailB, indexB, numSegmentB, undefined, childDetailB);
            if (result.detailA.childDetail && result.detailB.childDetail)
              result.detailA.childDetail.curve = result.detailB.childDetail.curve = undefined; // no CurvePrimitives survive in output
            dMin = d;
            foundMin = true;
          }
        }
      }
    }
    return foundMin ? result : undefined;
  }
}
