/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { LineString3d } from "../curve/LineString3d";
import { Geometry } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import {PolygonOps} from "../geometry3d/PolygonOps";
import {PolylineOps} from "../geometry3d/PolylineOps";
type AnnounceLoopAndTrianglesFunction = (loop: Point3d[], triangles: Point3d[][]) => void;

/**
 * Class with static methods to triangulate various forms of possibly non-planar polygons.
 * @public
 */
export class SpacePolygonTriangulation {

  /**
   * * Return a number which is:
   *   * 0 for collapsed (zero area) triangle
   *   * positive for non-zero area
   *   * larger is "better"
   * * Specifically, return (if well defined) the area divided by summed squares of edge lengths.
   * @param point0
   * @param point1
   * @param point2
   */
  public static spaceTriangleAspectRatio(point0: Point3d, point1: Point3d, point2: Point3d): number {
      const crossProduct = point0.crossProductToPoints (point1, point2);
      const area = 0.5 * crossProduct.magnitude ();
      const summedEdgeSquares = point0.distanceSquared (point1) + point1.distanceSquared (point2) + point2.distanceSquared (point0);
      return Geometry.safeDivideFraction (area, summedEdgeSquares, 0.0);
  }
  /**
   * * Treat a space quad as two triangles with interior diagonal from point0 to point2
   * * Return the smaller of the aspect ratios of the two triangles.
   * * The quad edges proceed in the order [point0, point1, point2, point3]
   * @param point0 first point of quad
   * @param point1 second point of quad (diagonally opposite of point3)
   * @param point2 third point (diagonally opposite point0)
   * @param point3 fourth point
   */
  public static spaceQuadDiagonalAspectRatio(point0: Point3d, point1: Point3d, point2: Point3d, point3: Point3d): number{
    const q012 = this.spaceTriangleAspectRatio (point0, point1, point2);
    const q023 = this.spaceTriangleAspectRatio (point0, point2, point3);
    return Math.max (q012, q023);
  }
  /** "Triangulate" by cutting of the ear with best aspect ratio.  Reject if successive normals have negative dot product with PolygonOps.AreaNormal */
  public static triangulateGreedyEarCut(points: Point3d[], announceLoopAndTriangles: AnnounceLoopAndTrianglesFunction): boolean{
    const normalA = PolygonOps.areaNormal (points);
    const triangles: Point3d[][] = [];
    const myPoints = points.slice ();
    PolylineOps.removeClosurePoint (myPoints);
    // first pass deals with entire array.
    // each pass lops off one point.
    for (;myPoints.length > 2;){
      // Find the ear candidate whose cross product vector has largest dot product (large area, best alignment with overall).
      let bestRatio = -1.0;
      let bestRatioIndex0 = 0;
      let i0 = myPoints.length - 2;
      let i1 = myPoints.length - 1;
      let i2;
      for (i2 = 0; i2 < myPoints.length; i0 = i1, i1 = i2, i2++){
        const ratio = this.spaceTriangleAspectRatio (myPoints[i0], myPoints[i1], myPoints[i2]);
        const normalB = myPoints[i0].crossProductToPoints (myPoints[i1], myPoints[i2]);
        if (normalB.dotProduct (normalA) > 0 && ratio > bestRatio){
          bestRatio = ratio;
          bestRatioIndex0 = i0;
        }
      }
      if (bestRatio <= 0.0)
        return false;
      // add the ear to the result
      i0 = bestRatioIndex0;
      i1 = (i0 + 1) % myPoints.length;
      i2 = (i1 + 1) % myPoints.length;
      const t = [];
      t.push (myPoints[i0], myPoints[i1], myPoints[i2]);
      // remove the middle point
      myPoints.splice (i1, 1);
      triangles.push(t);
    }
    announceLoopAndTriangles (points, triangles);
    return true;
  }

  private static triangulateSimplestSpaceLoopGo(points: Point3d[], announceLoopAndTriangles: AnnounceLoopAndTrianglesFunction,
    maxPerimeter: number | undefined): boolean{
    const n = Point3dArray.countNonDuplicates (points);
  if (maxPerimeter !== undefined && Point3dArray.sumEdgeLengths (points, true, n) > maxPerimeter)
      return false;
  if (n < 3)
    return false;
  if (n === 3){
    if (this.spaceTriangleAspectRatio (points[0], points[1], points[2]) === 0)
      return false;
    // already a triangle . . .
    announceLoopAndTriangles (points, [points.slice ()]);
    return true;
  }
  if (n === 4){
    const d02 = this.spaceQuadDiagonalAspectRatio (points[0], points[1], points[2], points[3]);
    const d13 = this.spaceQuadDiagonalAspectRatio (points[1], points[2], points[3], points[0]);
    if (d02 === 0.0 && d13 === 0.0)
      return false;
    // announce the two triangles with better aspect ratios ....
    if (d02 > d13){
      announceLoopAndTriangles (points, [[points[0], points[1], points[2]], [points[2], points[3], points[0]]]);
      return true;
    } else {
      announceLoopAndTriangles (points, [[points[0], points[1], points[3]], [points[3], points[1], points[2]]]);
      return true;
    }
  }
  return this.triangulateGreedyEarCut (points, announceLoopAndTriangles);
  }
  /**
   * * Emit triangles for a (possibly non-planar) loop for various simple cases:
   *    * only 3 points: just emit that triangle.
   *    * only 4 points: split across a diagonal, choosing the one with better aspect ratios of its two triangles.
   * * BUT
   *    * do not complete the triangulation if perimeter is larger than maxPerimeter (i.e. only consider small areas)
   * * Hence it is expected that the caller will use this as the first attempt, possibly followed by calls to other more adventurous methods.
   */
  public static triangulateSimplestSpaceLoop(loop: Point3d [] | LineString3d,
    announceLoopAndTriangles: AnnounceLoopAndTrianglesFunction,
    maxPerimeter?: number): boolean{
    if (loop instanceof LineString3d)
      return this.triangulateSimplestSpaceLoopGo (loop.points, announceLoopAndTriangles, maxPerimeter);
      // (array case by exhaustion)
    return this.triangulateSimplestSpaceLoopGo (loop, announceLoopAndTriangles, maxPerimeter);
  }

}
