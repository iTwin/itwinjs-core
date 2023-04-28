/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.geom;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ASystem } from "../../system/runtime/ASystem";
import { Coordinate } from "./Coordinate";

/**
 * Class Line defines a line between two 3D XYZ points.
 *
 * @version 1.0 March 2010
 */
/** @internal */
export class Line {
  /** The start point */
  public p0: Coordinate;
  /** The end point */
  public p1: Coordinate;

  /**
   * Create a new line.
   * @param p0 the start point.
   * @param p1 the end point.
   */
  public constructor(p0: Coordinate, p1: Coordinate) {
    /* Store the points */
    this.p0 = p0;
    this.p1 = p1;
  }

  /**
   * Create a new line.
   * @return a new line.
   */
  public static create(): Line {
    return new Line(Coordinate.create(), Coordinate.create());
  }

  /**
   * Create a new line.
   * @param p0 the start point.
   * @param p1 the end point.
   */
  public static fromPoints(p0: Coordinate, p1: Coordinate): Line {
    return new Line(p0, p1);
  }

  /**
   * Create a new line.
   * @param x0 the x of the start point.
   * @param y0 the y of the start point.
   * @param z0 the z of the start point.
   * @param x1 the x of the end point.
   * @param y1 the y of the end point.
   * @param z1 the z of the end point.
   */
  public static fromXYZ(
    x0: float64,
    y0: float64,
    z0: float64,
    x1: float64,
    y1: float64,
    z1: float64
  ): Line {
    return new Line(new Coordinate(x0, y0, z0), new Coordinate(x1, y1, z1));
  }

  /**
   * Get the start point.
   * @return the start point.
   */
  public getPoint0(): Coordinate {
    return this.p0;
  }

  /**
   * Get the end point.
   * @return the end point.
   */
  public getPoint1(): Coordinate {
    return this.p1;
  }

  /**
   * Get a point along the line.
   * @param t the position of the point (0.0 at start and 1.0 at end).
   * @return a point.
   */
  public getPoint(t: float64): Coordinate {
    /* Avoid rounding errors */
    if (t == 0.0) return this.p0;
    if (t == 1.0) return this.p1;
    /* Calculate a new point */
    let x: float64 = this.p0.getX() + t * (this.p1.getX() - this.p0.getX());
    let y: float64 = this.p0.getY() + t * (this.p1.getY() - this.p0.getY());
    let z: float64 = this.p0.getZ() + t * (this.p1.getZ() - this.p0.getZ());
    return new Coordinate(x, y, z);
  }

  /**
   * Get a point along the line.
   * @param t the position of the point (0.0 at start and 1.0 at end).
   * @param point the result point (must be mutable).
   */
  public getPointTo(t: float64, point: Coordinate): void {
    /* Start point? */
    if (t == 0.0) {
      /* Copy */
      point.setXYZ(this.p0.getX(), this.p0.getY(), this.p0.getZ());
    } else if (t == 1.0) {
    /* End point? */
      /* Copy */
      point.setXYZ(this.p1.getX(), this.p1.getY(), this.p1.getZ());
    } else {
    /* Intermediate point */
      /* Calculate a new point */
      let x: float64 = this.p0.getX() + t * (this.p1.getX() - this.p0.getX());
      let y: float64 = this.p0.getY() + t * (this.p1.getY() - this.p0.getY());
      let z: float64 = this.p0.getZ() + t * (this.p1.getZ() - this.p0.getZ());
      point.setXYZ(x, y, z);
    }
  }

  /**
   * Get the X coordinate of a point along the line.
   * @param t the position of the point (0.0 at start and 1.0 at end).
   * @return the coordinate.
   */
  public getPointX(t: float64): float64 {
    /* Start point? */
    if (t == 0.0) {
      /* Copy */
      return this.p0.getX();
    } else if (t == 1.0) {
    /* End point? */
      /* Copy */
      return this.p1.getX();
    } else {
    /* Intermediate point */
      /* Calculate a new point */
      return this.p0.getX() + t * (this.p1.getX() - this.p0.getX());
    }
  }

  /**
   * Get the Y coordinate of a point along the line.
   * @param t the position of the point (0.0 at start and 1.0 at end).
   * @return the coordinate.
   */
  public getPointY(t: float64): float64 {
    /* Start point? */
    if (t == 0.0) {
      /* Copy */
      return this.p0.getY();
    } else if (t == 1.0) {
    /* End point? */
      /* Copy */
      return this.p1.getY();
    } else {
    /* Intermediate point */
      /* Calculate a new point */
      return this.p0.getY() + t * (this.p1.getY() - this.p0.getY());
    }
  }

  /**
   * Get the Z coordinate of a point along the line.
   * @param t the position of the point (0.0 at start and 1.0 at end).
   * @return the coordinate.
   */
  public getPointZ(t: float64): float64 {
    /* Start point? */
    if (t == 0.0) {
      /* Copy */
      return this.p0.getZ();
    } else if (t == 1.0) {
    /* End point? */
      /* Copy */
      return this.p1.getZ();
    } else {
    /* Intermediate point */
      /* Calculate a new point */
      return this.p0.getZ() + t * (this.p1.getZ() - this.p0.getZ());
    }
  }

  /**
   * Get a point along the line.
   * @param d the distance of the point (0.0 at start).
   * @return a point.
   */
  public getPointAtDistance(d: float64): Coordinate {
    return this.getPoint(d / this.getLength());
  }

  /**
   * Get a point along the line.
   * @param d the distance of the point (0.0 at start).
   * @param point the result point (must be mutable).
   */
  public getPointAtDistanceTo(d: float64, point: Coordinate): void {
    this.getPointTo(d / this.getLength(), point);
  }

  /**
   * Get the position for a fixed x value.
   * @param x the x value.
   * @return the position on the line.
   */
  public getPointAtX(x: float64): float64 {
    return (x - this.p0.getX()) / (this.p1.getX() - this.p0.getX());
  }

  /**
   * Get a point along the line.
   * @param x the x value.
   * @param point the result point (must be mutable).
   */
  public getPointAtXTo(x: float64, point: Coordinate): void {
    this.getPointTo(this.getPointAtX(x), point);
    point.setX(x);
  }

  /**
   * Get the position for a fixed y value.
   * @param y the y value.
   * @return the position on the line.
   */
  public getPointAtY(y: float64): float64 {
    return (y - this.p0.getY()) / (this.p1.getY() - this.p0.getY());
  }

  /**
   * Get a point along the line.
   * @param y the y value.
   * @param point the result point (must be mutable).
   */
  public getPointAtYTo(y: float64, point: Coordinate): void {
    this.getPointTo(this.getPointAtY(y), point);
    point.setY(y);
  }

  /**
   * Get the position for a fixed z value.
   * @param z the z value.
   * @return the position on the line.
   */
  public getPointAtZ(z: float64): float64 {
    return (z - this.p0.getZ()) / (this.p1.getZ() - this.p0.getZ());
  }

  /**
   * Get a point along the line.
   * @param z the z value.
   * @param point the result point (must be mutable).
   */
  public getPointAtZTo(z: float64, point: Coordinate): void {
    this.getPointTo(this.getPointAtZ(z), point);
    point.setZ(z);
  }

  /**
   * Get the direction vector (P1-P0).
   * @return the direction vector.
   */
  public getDirection(): Coordinate {
    /* Return the direction */
    return this.p1.subtract(this.p0);
  }

  /**
   * Get the direction vector (P1-P0).
   * @param direction the result direction vector.
   */
  public getDirectionTo(direction: Coordinate): void {
    /* Return the direction */
    direction.set(this.p1);
    direction.subtract0(this.p0);
  }

  /**
   * Get the direction vector (P1-P0).
   * @return the direction vector.
   */
  public getDifference(): Coordinate {
    return this.getDirection();
  }

  /**
   * Swap the orientation of the line (create a line from point1 to point0).
   * @return a new line.
   */
  public swapDirection(): Line {
    return new Line(this.p1, this.p0);
  }

  /**
   * Get the squared length of the segment.
   * @return the squared length of the segment.
   */
  public getSquaredLength(): float64 {
    /* Get the direction */
    let dx: float64 = this.p1.getX() - this.p0.getX();
    let dy: float64 = this.p1.getY() - this.p0.getY();
    let dz: float64 = this.p1.getZ() - this.p0.getZ();
    /* Return the length */
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Get the length of the segment.
   * @return the length of the segment.
   */
  public getLength(): float64 {
    return Math.sqrt(this.getSquaredLength());
  }

  /**
   * Project a point on the segment.
   * @param point the point to project.
   * @return the position of the projected point.
   */
  public getProjection(point: Coordinate): float64 {
    /* Get the direction of the point */
    let pdx: float64 = point.getX() - this.p0.getX();
    let pdy: float64 = point.getY() - this.p0.getY();
    let pdz: float64 = point.getZ() - this.p0.getZ();
    /* Get the direction */
    let dx: float64 = this.p1.getX() - this.p0.getX();
    let dy: float64 = this.p1.getY() - this.p0.getY();
    let dz: float64 = this.p1.getZ() - this.p0.getZ();
    /* Return the value */
    return (pdx * dx + pdy * dy + pdz * dz) / this.getSquaredLength();
  }

  /**
   * Project a point on the segment.
   * @param point the point to project.
   * @return the projected point.
   */
  public getProjectionPoint(point: Coordinate): Coordinate {
    return this.getPoint(this.getProjection(point));
  }

  /**
   * Get the distance from a point to the line.
   * @param point the point.
   * @return the distance.
   */
  public getDistance(point: Coordinate): float64 {
    /* Project the point */
    let projected: Coordinate = this.getPoint(this.getProjection(point));
    /* Return the square distance */
    return projected.distance3D(point);
  }

  /**
   * Get the distance from a point to the segment between point 0 and point 1.
   * @param point the point.
   * @return the distance.
   */
  public getSegmentDistance(point: Coordinate): float64 {
    /* Clip the projection */
    let t: float64 = this.getProjection(point);
    if (t < 0.0) t = 0.0;
    else if (t > 1.0) t = 1.0;
    /* Return the distance */
    let closest: Coordinate = this.getPoint(t);
    return closest.distance3D(point);
  }

  /**
   * Check if the denominator of an intersection is zero (parallel lines).
   * @param value the denominator value.
   * @return true if zero (like -7.105427357601002E-15, -3.8944125702045085E-10 or -3.808708481679941E-9 for perfectly parallel lines).
   */
  public static isZero(value: float64): boolean {
    if (value == 0.0) return true;
    return Math.abs(value) < 1.0e-6;
  }

  /**
   * Check if the lines is parallel with another line.
   * @param line the other line.
   * @return true if the lines are parallel.
   */
  public isParallel(line: Line): boolean {
    /* Get the direction vectors */
    let u: Coordinate = this.getDifference();
    let v: Coordinate = line.getDifference();
    /* Get the parameters for the equation */
    let a: float64 = u.dotProduct(u);
    let b: float64 = u.dotProduct(v);
    let c: float64 = v.dotProduct(v);
    /* Solve the equation */
    return Line.isZero(a * c - b * b);
  }

  /**
   * Intersect with another line.
   * The two lines should not be parallel, check with 'isParallel' first !
   * @param line the line the intersect with.
   * @return the position of the intersection point.
   */
  public getIntersection(line: Line): float64 {
    // Algorithm copied from:
    // http://softsurfer.com/Archive/algorithm_0106/algorithm_0106.htm
    //
    /* Get the direction vectors */
    let u: Coordinate = this.getDifference();
    let v: Coordinate = line.getDifference();
    /* Get the translation vector */
    let w0: Coordinate = this.p0.subtract(line.p0);
    /* Get the parameters for the equation */
    let a: float64 = u.dotProduct(u);
    let b: float64 = u.dotProduct(v);
    let c: float64 = v.dotProduct(v);
    let d: float64 = u.dotProduct(w0);
    let e: float64 = v.dotProduct(w0);
    /* Parallel */
    let denominator: float64 = a * c - b * b;
    ASystem.assert0(
      Line.isZero(denominator) == false,
      "Lines " + this + " and " + line + " are parallel when intersecting"
    );
    /* Solve the equation */
    return (b * e - c * d) / denominator;
  }

  /**
   * Intersect with another line.
   * @param line the line the intersect with.
   * @return the intersection point (null if the lines are parallell).
   */
  public getIntersectionPoint(line: Line): Coordinate {
    if (this.isParallel(line)) return null;
    return this.getPoint(this.getIntersection(line));
  }

  /**
   * Interpolate a point.
   * @param point1 the first point on the line.
   * @param point2 the second point on the line.
   * @param t the point parameter.
   * @param point the target point.
   */
  public static interpolate(
    point1: Coordinate,
    point2: Coordinate,
    t: float64,
    point: Coordinate
  ): void {
    let x: float64 = point1.getX() + t * (point2.getX() - point1.getX());
    let y: float64 = point1.getY() + t * (point2.getY() - point1.getY());
    let z: float64 = point1.getZ() + t * (point2.getZ() - point1.getZ());
    point.setXYZ(x, y, z);
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return "[Line:p0=" + this.p0 + ",p1=" + this.p1 + "]";
  }
}
