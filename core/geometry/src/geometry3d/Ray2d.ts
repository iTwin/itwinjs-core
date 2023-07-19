/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";

// cspell:word CCWXY, CWXY

/**
 * Ray with xy origin and direction
 * @public
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
