/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { Range1d } from "../geometry3d/Range";
import { Ray2d } from "../geometry3d/Ray2d";

/**
 * Convex hull of points in 2d.
 * @internal
 */
export class ConvexPolygon2d {
  // hull points in CCW order, WITHOUT final duplicate...
  // REMARK: In degenerate case with 0,1,or 2 points the array is still there.
  private _hullPoints: Point2d[];

  constructor(points: Point2d[] | undefined) {
    this._hullPoints = [];
    // Deep copy of points array given
    if (points) {
      for (const point of points) {
        this._hullPoints.push(point);
      }
    }
  }

  /** Create the hull */
  public static createHull(points: Point2d[]): ConvexPolygon2d {
    return new ConvexPolygon2d(ConvexPolygon2d.computeConvexHull(points));
  }

  /** Create the hull. First try to use the points as given. */
  public static createHullIsValidCheck(points: Point2d[]) {
    if (ConvexPolygon2d.isValidConvexHull(points))
      return new ConvexPolygon2d(points);
    else
      return new ConvexPolygon2d(ConvexPolygon2d.computeConvexHull(points));
  }

  /** Return a reference of the hull points. */
  public get points(): Point2d[] {
    return this._hullPoints;
  }

  /** Test if hull points are a convex, CCW polygon */
  public static isValidConvexHull(points: Point2d[]) {
    if (points.length < 3)
      return false;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const i2 = (i + 2) % n;
      if (points[i].crossProductToPoints(points[i1], points[i2]) < 0.0)
        return false;
    }
    return true;
  }

  /** Return true if the convex hull (to the left of the edges) contains the test point */
  public containsPoint(point: Point2d): boolean {
    let xy0 = this._hullPoints[this._hullPoints.length - 1];
    // double tol = -1.0e-20;  negative tol!!
    for (const i of this._hullPoints) {
      const xy1 = i;
      const c = xy0.crossProductToPoints(xy1, point);
      if (c < 0.0)
        return false;
      xy0 = i;
    }
    return true;
  }

  /** Return the largest outside. (return 0 if in or on) */
  public distanceOutside(xy: Point2d): number {
    let maxDistance = 0.0;
    const n = this._hullPoints.length;
    let xy0 = this._hullPoints[n - 1];
    // double tol = -1.0e-20;  // negative tol!!
    for (let i = 0; i < n; i++) {
      const xy1 = this._hullPoints[i];
      const c = xy0.crossProductToPoints(xy1, xy);
      if (c < 0.0) {
        const ray = Ray2d.createOriginAndTarget(xy0, xy1);
        const s = ray.projectionFraction(xy);
        let d = 0.0;
        if (s < 0.0)
          d = xy0.distance(xy);
        else if (s > 1.0)
          d = xy1.distance(xy);
        else
          d = xy.distance(ray.fractionToPoint(s));

        if (d > maxDistance)
          maxDistance = d;
      }
      xy0 = this._hullPoints[i];
    }
    return maxDistance;
  }

  /** Offset the entire hull (in place) by distance.
   * Returns false if an undefined occurred from normalizing (could occur after changing some hull points already)
   */
  public offsetInPlace(distance: number): boolean {
    const n = this._hullPoints.length;
    if (n >= 3) {
      const hullPoint0 = this._hullPoints[0];
      let edgeA: Vector2d | undefined = this._hullPoints[n - 1].vectorTo(hullPoint0);
      edgeA = edgeA.normalize();
      if (edgeA === undefined) { return false; }

      let perpA = edgeA.rotate90CWXY();
      let edgeB: Vector2d | undefined;
      let perpB: Vector2d;
      for (let i = 0; i < n; i++) {
        const j = i + 1;
        edgeB = this._hullPoints[i].vectorTo(j < n ? this._hullPoints[j] : hullPoint0);
        edgeB = edgeB.normalize();
        if (edgeB === undefined) { return false; }

        perpB = edgeB.rotate90CWXY();
        const offsetBisector = Vector2d.createOffsetBisector(perpA, perpB, distance);
        if (offsetBisector === undefined) { return false; }

        this._hullPoints[i] = this._hullPoints[i].plus(offsetBisector);
        // PerpA takes up reference to perpB, as perpB will die in new iteration
        perpA = perpB;
      }
    }
    return true;
  }

  /**
   * Return 2 distances bounding the intersection of the ray with this convex hull.
   * @param ray ray to clip to this convex polygon. ASSUME normalized direction vector, so that ray fractions are distances.
   * @returns intersection bounds as min and max distances along the ray (from its origin).
   * * Both negative and positive distances along the ray are possible.
   * * Range has extreme values if less than 3 points, distanceA > distanceB, or if cross product < 0.
   */
  public clipRay(ray: Ray2d): Range1d {
    let distanceA = - Number.MAX_VALUE;
    let distanceB = Number.MAX_VALUE;

    const n = this._hullPoints.length;

    if (n < 3)
      return Range1d.createNull();

    let xy0 = this._hullPoints[n - 1];
    for (const xy1 of this._hullPoints) {
      const { hasIntersection, fraction, cross } = ray.intersectUnboundedLine(xy0, xy1);
      if (hasIntersection) {
        if (cross > 0.0) {
          if (fraction < distanceB)
            distanceB = fraction;
        } else {
          if (fraction > distanceA)
            distanceA = fraction;
        }
        if (distanceA > distanceB)
          return Range1d.createNull();
      } else {
        // ray is parallel to the edge.
        // Any single point out classifies it all . ..
        if (xy0.crossProductToPoints(xy1, ray.origin) < 0.0)
          return Range1d.createNull();
      }

      // xy1 is reassigned with each new loop
      xy0 = xy1;
    }
    const range = Range1d.createNull();
    range.extendX(distanceA);
    range.extendX(distanceB);
    return range;
  }

  /** Return the range of (fractional) ray positions for projections of all points from the arrays. */
  public rangeAlongRay(ray: Ray2d): Range1d {
    const range = Range1d.createNull();
    for (const xy1 of this._hullPoints)
      range.extendX(ray.projectionFraction(xy1));
    return range;
  }

  /** Return the range of (fractional) ray positions for projections of all points from the arrays. */
  public rangePerpendicularToRay(ray: Ray2d): Range1d {
    const range = Range1d.createNull();
    for (const xy1 of this._hullPoints)
      range.extendX(ray.perpendicularProjectionFraction(xy1));
    return range;
  }

  /** Computes the hull of a convex polygon from points given. Returns the hull as a new Point2d array.
   *  Returns an empty hull if less than 3 points are given.
   */
  public static computeConvexHull(points: Point2d[]): Point2d[] | undefined {
    const hull: Point2d[] = [];
    const n = points.length;
    if (n < 3)
      return undefined;
    // Get deep copy
    const xy1: Point2d[] = points.slice(0, n);
    xy1.sort((a, b) => Geometry.lexicalXYLessThan(a, b));
    hull.push(xy1[0]); // This is sure to stay
    hull.push(xy1[1]); // This one can be removed in loop.

    // First sweep creates upper hull
    for (let i = 2; i < n; i++) {
      const candidate = xy1[i];
      let top = hull.length - 1;
      while (top > 0 && hull[top - 1].crossProductToPoints(hull[top], candidate) <= 0.0) {
        top--;
        hull.pop();
      }
      hull.push(candidate);
    }

    // Second sweep creates lower hull right to left
    const i0 = hull.length - 1;
    // xy1.back () is already on stack.
    hull.push(xy1[n - 2]);
    for (let i = n - 2; i-- > 0;) {
      const candidate = xy1[i];
      let top = hull.length - 1;
      while (top > i0 && hull[top - 1].crossProductToPoints(hull[top], candidate) <= 0.0) {
        top--;
        hull.pop();
      }
      if (i > 0) // don't replicate start point!!!
        hull.push(candidate);
    }

    return hull;
  }
}
