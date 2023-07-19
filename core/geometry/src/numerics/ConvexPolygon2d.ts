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

/**
 * Ray with xy origin and direction
 * @internal
 */
export class Ray2d {
  private _origin: Point2d;
  private _direction: Vector2d;

  private constructor(origin: Point2d, direction: Vector2d) {
    this._origin = origin;
    this._direction = direction;
  }
  /** Copy coordinates from origin and direction. */
  public set(origin: Point2d, direction: Vector2d): void {
    this._origin.setFrom(origin);
    this._direction.setFrom(direction);
  }
  /**
   * Create from `origin` and `target` points.
   * @param origin ray origin, cloned
   * @param target end of ray direction vector. The direction vector is `target - origin`.
   * @param result optional pre-allocated object to return
   */
  public static createOriginAndTarget(origin: Point2d, target: Point2d, result?: Ray2d): Ray2d {
    if (result) {
      result._origin.setFrom(origin);
      result._direction.set(target.x - origin.x, target.y - origin.y);
      return result;
    }
    return new Ray2d(origin.clone(), origin.vectorTo(target));
  }
  /**
   * Create by copying coordinates from `origin` and `direction`.
   * @param origin ray origin
   * @param direction ray direction
   * @param result optional pre-allocated object to return
   */
  public static createOriginAndDirection(origin: Point2d, direction: Vector2d, result?: Ray2d): Ray2d {
    if (result) {
      result.set(origin, direction);
      return result;
    }
    return new Ray2d(origin.clone(), direction.clone());
  }
  /** Create from captured `origin` and `direction`. */
  public static createOriginAndDirectionCapture(origin: Point2d, direction: Vector2d, result?: Ray2d): Ray2d {
    if (result) {
      result._origin = origin;
      result._direction = direction;
      return result;
    }
    return new Ray2d(origin, direction);
  }
  /** Get the reference to the ray origin. */
  public get origin() { return this._origin; }
  /** Get the reference to the ray direction. */
  public get direction() { return this._direction; }
  /**
   * Return a parallel ray to the left of this ray.
   * @param leftFraction distance between rays, as a fraction of the magnitude of this ray's direction vector
   */
  public parallelRay(leftFraction: number, result?: Ray2d): Ray2d {
    if (result) {
      this._origin.addForwardLeft(0.0, leftFraction, this._direction, result._origin);
      result._direction.setFrom(this._direction);
      return result;
    }
    return new Ray2d(this._origin.addForwardLeft(0.0, leftFraction, this._direction), this._direction.clone());
  }
  /** Return a ray with cloned origin and with direction rotated 90 degrees counterclockwise */
  public ccwPerpendicularRay(result?: Ray2d): Ray2d {
    if (result) {
      result._origin.setFrom(this._origin);
      this._direction.rotate90CCWXY(result._direction);
      return result;
    }
    return new Ray2d(this._origin.clone(), this._direction.rotate90CCWXY());
  }
  /** Return a ray with cloned origin and with direction rotated 90 degrees clockwise */
  public cwPerpendicularRay(result?: Ray2d): Ray2d {
    if (result) {
      result._origin.setFrom(this._origin);
      this._direction.rotate90CWXY(result._direction);
      return result;
    }
    return new Ray2d(this._origin.clone(), this._direction.rotate90CWXY());
  }
  /**
   * Normalize the direction vector in place.
   * @param defaultX value to set `this.direction.x` if normalization fails. Default value 1.
   * @param defaultY value to set `this.direction.y` if normalization fails. Default value 0.
   * @returns whether normalization succeeded (i.e., direction is nonzero)
   */
  public normalizeDirectionInPlace(defaultX: number = 1, defaultY: number = 0): boolean {
    if (this._direction.normalize(this._direction))
      return true;
    this._direction.x = defaultX;
    this._direction.y = defaultY;
    return false;
  }
  /**
   * Intersect this ray with the unbounded line defined by the given points.
   * @param linePointA start of the line
   * @param linePointB end of the line
   * @returns object with named values:
   * * `hasIntersection`: whether the intersection exists.
   * * `fraction`: ray parameter of intersection, or 0.0 if `!hasIntersection`. If the instance is normalized, this is the signed distance along the ray to the intersection point.
   * * `cross`: the 2D cross product `this.direction x (linePointB - linePointA)`, useful for determining orientation of the line and ray.
   */
  public intersectUnboundedLine(linePointA: Point2d, linePointB: Point2d): { hasIntersection: boolean, fraction: number, cross: number } {
    const lineDirection = linePointA.vectorTo(linePointB);
    const vector0 = linePointA.vectorTo(this._origin);
    const h0 = vector0.crossProduct(lineDirection);
    const dHds = this._direction.crossProduct(lineDirection);
    // h = h0 + s * dh
    const ff = Geometry.conditionalDivideFraction(-h0, dHds);
    const hasIntersection = ff !== undefined;
    return { hasIntersection, fraction: hasIntersection ? ff : 0.0, cross: dHds };
  }
  /** Return the ray fraction where the given point projects onto the ray. */
  public projectionFraction(point: Point2d): number {
    return this._origin.vectorTo(point).fractionOfProjectionToVector(this._direction);
  }
  /** Return the ray fraction where the given point projects onto the perpendicular ray. */
  public perpendicularProjectionFraction(point: Point2d): number {
    const uv = this._direction.crossProduct(this._origin.vectorTo(point));
    const uu = this._direction.magnitudeSquared();
    // Want zero returned if failure case, not undefined
    return Geometry.safeDivideFraction(uv, uu, 0.0);
  }
  /** Compute and return origin plus scaled direction. */
  public fractionToPoint(f: number, result?: Point2d): Point2d {
    return this._origin.plusScaled(this._direction, f, result);
  }
}
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
   * Return 2 distances bounding the intersection of the ray with a convex hull.
   * ASSUME (for tolerance) the ray has normalized direction vector.
   * Both negative and positive distances along the ray are possible.
   * Returns range with extremities if less than 3 points, distanceA > distanceB, or if cross product < 0
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
    xy1.sort(Geometry.lexicalXYLessThan);
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
