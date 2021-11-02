/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { Point3d } from "./Point3dVector3d";
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
  public static compressShortEdges(source: Point3d[], maxEdgeLength: number): Point3d[] {
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
  private static isDanglerConfiguration(points: Point3d[], indexA: number, indexB: number,pointQ: Point3d, squaredDistanceTolerance: number): boolean {
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
   */
   public static compressDanglers(source: Point3d[], closed: boolean = false, tolerance: number = Geometry.smallMetricDistance): Point3d[] {
     let n = source.length;
     const squaredDistanceTolerance = tolerance * tolerance;
     if (closed)
      while (n > 1 && source[n - 1].distanceSquared(source[0]) <= squaredDistanceTolerance)
          n--;
     const dest = [];
     dest.push(source[0].clone());
     for (let i = 1; i < n; i++){
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
    if (q0 instanceof Point3d && q1 instanceof Point3d && !q0.isAlmostEqual (q1)) {
      (data as Point3d[]).push(q0.clone());
    }
  }

}
