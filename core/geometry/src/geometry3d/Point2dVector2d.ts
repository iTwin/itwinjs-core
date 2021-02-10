/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
// cspell:word JSONXY
// cspell:word CWXY

import { BeJSONFunctions, Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { XAndY, XYProps } from "./XYZProps";

/** Minimal object containing x,y and operations that are meaningful without change in both point and vector.
 *  * `XY` is not instantiable.
 *  * The derived (instantiable) classes are
 *    * `Point2d`
 *    * `Vector2d`
 * @public
 */
export class XY implements XAndY {
  /** x component */
  public x: number;
  /** y component */
  public y: number;
  /** Set both x and y. */
  public set(x: number = 0, y: number = 0) { this.x = x; this.y = y; }
  /** Set both x and y to zero */
  public setZero() { this.x = 0; this.y = 0; }
  protected constructor(x: number = 0, y: number = 0) { this.x = x; this.y = y; }
  /** Set both x and y from other. */
  public setFrom(other?: XAndY) {
    if (other) {
      this.x = other.x; this.y = other.y;
    } else {
      this.x = 0; this.y = 0;
    }
  }
  /** Freeze this instance so it is read-only */
  public freeze(): Readonly<this> { return Object.freeze(this); }

  /** Returns true if this and other have equal x,y parts within Geometry.smallMetricDistance. */
  public isAlmostEqual(other: XAndY, tol?: number): boolean { return Geometry.isSameCoordinate(this.x, other.x, tol) && Geometry.isSameCoordinate(this.y, other.y, tol); }

  /** Returns true if this and other have equal x,y parts within Geometry.smallMetricDistance. */
  public isAlmostEqualXY(x: number, y: number, tol?: number): boolean { return Geometry.isSameCoordinate(this.x, x, tol) && Geometry.isSameCoordinate(this.y, y, tol); }

  /** return a json array  `[x,y]`   */
  public toJSON(): XYProps { return [this.x, this.y]; }
  /** return a json object `{x: 1, y:2}`  */
  public toJSONXY(): XYProps { return { x: this.x, y: this.y }; }
  /** Set x and y from a JSON source such as `[1,2]` or `{x:1, y:2}` */
  public setFromJSON(json?: XYProps): void {
    if (Array.isArray(json)) {
      this.set(json[0] || 0, json[1] || 0);
      return;
    }
    if (json) {
      this.set(json.x || 0, json.y || 0);
      return;
    }
    this.set(0, 0);
  }

  /** Return the distance from this point to other */
  public distance(other: XAndY): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    return (Math.sqrt(xDist * xDist + yDist * yDist));
  }

  /** Return squared distance from this point to other */
  public distanceSquared(other: XAndY): number {
    const xDist = other.x - this.x;
    const yDist = other.y - this.y;
    return (xDist * xDist + yDist * yDist);
  }

  /** Return the largest absolute distance between corresponding components */
  public maxDiff(other: XAndY): number {
    return Math.max(Math.abs(this.x - other.x), Math.abs(this.y - other.y));
  }
  /** returns true if the x,y components are both small by metric metric tolerance */
  public get isAlmostZero(): boolean {
    return Geometry.isSmallMetricDistance(this.x) && Geometry.isSmallMetricDistance(this.y);
  }

  /** Return the largest absolute value of any component */
  public maxAbs(): number { return Math.max(Math.abs(this.x), Math.abs(this.y)); }
  /** Return the magnitude of the vector */
  public magnitude(): number { return Math.sqrt(this.x * this.x + this.y * this.y); }
  /** Return the squared magnitude of the vector.  */
  public magnitudeSquared(): number { return this.x * this.x + this.y * this.y; }

  /** returns true if the x,y components are exactly equal. */
  public isExactEqual(other: XAndY): boolean { return this.x === other.x && this.y === other.y; }
  /** returns true if x,y match `other` within metric tolerance */
  public isAlmostEqualMetric(other: XAndY): boolean { return this.maxDiff(other) <= Geometry.smallMetricDistance; }

  /** Return a (full length) vector from this point to other */
  public vectorTo(other: XAndY, result?: Vector2d): Vector2d {
    return Vector2d.create(
      other.x - this.x,
      other.y - this.y,
      result);
  }
  /** Return a unit vector from this point to other */
  public unitVectorTo(target: XAndY, result?: Vector2d): Vector2d | undefined {
    return this.vectorTo(target, result).normalize(result);
  }
  /** cross product of vectors from origin to targets */
  public static crossProductToPoints(origin: XAndY, targetA: XAndY, targetB: XAndY): number {
    return Geometry.crossProductXYXY(
      targetA.x - origin.x, targetA.y - origin.y, targetB.x - origin.x, targetB.y - origin.y);
  }
}
/** 2D point with `x`,`y` as properties
 * @public
 */
export class Point2d extends XY implements BeJSONFunctions {
  /** Constructor for Point2d */
  constructor(x: number = 0, y: number = 0) { super(x, y); }
  /** return a new Point2d with x,y coordinates from this. */
  public clone(result?: Point2d): Point2d { return Point2d.create(this.x, this.y, result); }

  /**
   * Return a point (newly created unless result provided) with given x,y coordinates
   * @param x x coordinate
   * @param y y coordinate
   * @param result optional result
   */
  public static create(x: number = 0, y: number = 0, result?: Point2d): Point2d {
    if (result) {
      result.x = x;
      result.y = y;
      return result;
    }
    return new Point2d(x, y);
  }
  /** Convert JSON `[1,2]` or `{x:1, y:2}` to a Point2d instance */
  public static fromJSON(json?: XYProps): Point2d { const val = new Point2d(); val.setFromJSON(json); return val; }
  /** Create (or optionally reuse) a Point2d from another object with fields x and y */
  public static createFrom(xy: XAndY | undefined, result?: Point2d): Point2d {
    if (xy)
      return Point2d.create(xy.x, xy.y, result);
    return Point2d.create(0, 0, result);
  }
  /** Create a Point2d with both coordinates zero. */
  public static createZero(result?: Point2d): Point2d { return Point2d.create(0, 0, result); }
  /** Starting at this point, move along vector by tangentFraction of the vector length, and to the left by leftFraction of
   * the perpendicular vector length.
   * @param tangentFraction distance to move along the vector, as a fraction of vector
   * @param leftFraction distance to move perpendicular to the vector, as a fraction of the rotated vector
   */
  public addForwardLeft(tangentFraction: number, leftFraction: number, vector: Vector2d): Point2d {
    const dx = vector.x;
    const dy = vector.y;
    return Point2d.create(this.x + tangentFraction * dx - leftFraction * dy,
      this.y + tangentFraction * dy + leftFraction * dx);
  }
  /** Interpolate at tangentFraction between this instance and point.   Move by leftFraction along the xy perpendicular
   * of the vector between the points.
   */
  public forwardLeftInterpolate(tangentFraction: number, leftFraction: number, point: XAndY): Point2d {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    return Point2d.create(
      this.x + tangentFraction * dx - leftFraction * dy,
      this.y + tangentFraction * dy + leftFraction * dx);
  }

  /** Return a point interpolated between this point and the right param. */
  public interpolate(fraction: number, other: XAndY, result?: Point2d): Point2d {
    if (fraction <= 0.5)
      return Point2d.create(
        this.x + fraction * (other.x - this.x),
        this.y + fraction * (other.y - this.y),
        result);
    const t: number = fraction - 1.0;
    return Point2d.create(
      other.x + t * (other.x - this.x),
      other.y + t * (other.y - this.y),
      result);
  }

  /** Return a point with independent x,y fractional interpolation. */
  public interpolateXY(fractionX: number, fractionY: number, other: XAndY, result?: Point2d): Point2d {
    return Point2d.create(
      Geometry.interpolate(this.x, fractionX, other.x),
      Geometry.interpolate(this.y, fractionY, other.y),
      result);
  }

  /** Return this point minus vector */
  public minus(vector: XAndY, result?: Point2d): Point2d {
    return Point2d.create(
      this.x - vector.x,
      this.y - vector.y,
      result);
  }

  /** Return point plus vector */
  public plus(vector: XAndY, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vector.x,
      this.y + vector.y,
      result);
  }
  /** Return point plus vector */
  public plusXY(dx: number = 0, dy: number = 0, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + dx,
      this.y + dy, result);
  }

  /** Return point + vector * scalar */
  public plusScaled(vector: XAndY, scaleFactor: number, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vector.x * scaleFactor,
      this.y + vector.y * scaleFactor,
      result);
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB */
  public plus2Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vectorA.x * scalarA + vectorB.x * scalarB,
      this.y + vectorA.y * scalarA + vectorB.y * scalarB,
      result);
  }

  /** Return point + vectorA * scalarA + vectorB * scalarB + vectorC * scalarC */
  public plus3Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, vectorC: XAndY, scalarC: number, result?: Point2d): Point2d {
    return Point2d.create(
      this.x + vectorA.x * scalarA + vectorB.x * scalarB + vectorC.x * scalarC,
      this.y + vectorA.y * scalarA + vectorB.y * scalarB + vectorC.y * scalarC,
      result);
  }
  /**
   * Return the dot product of vector from this to targetA and vector from this to targetB
   * @param targetA target of first vector
   * @param targetB target of second vector
   */
  public dotVectorsToTargets(targetA: XAndY, targetB: XAndY): number {
    return (targetA.x - this.x) * (targetB.x - this.x) +
      (targetA.y - this.y) * (targetB.y - this.y);
  }

  /** Returns the (scalar) cross product of two points/vectors, computed from origin to target1 and target2 */
  public crossProductToPoints(target1: XAndY, target2: XAndY): number {
    const x1 = target1.x - this.x;
    const y1 = target1.y - this.y;
    const x2 = target2.x - this.x;
    const y2 = target2.y - this.y;
    return x1 * y2 - y1 * x2;
  }
  /** Return the fractional coordinate of the projection of this instance x,y onto the line from startPoint to endPoint.
   * @param startPoint start point of line
   * @param endPoint end point of line
   * @param defaultFraction fraction to return if startPoint and endPoint are equal.
   */
  public fractionOfProjectionToLine(startPoint: Point2d, endPoint: Point2d, defaultFraction?: number): number {
    const denominator = startPoint.distanceSquared(endPoint);
    if (denominator < Geometry.smallMetricDistanceSquared)
      return defaultFraction ? defaultFraction : 0;
    return startPoint.dotVectorsToTargets(endPoint, this) / denominator;
  }
}
/** 2D vector with `x`,`y` as properties
 * @public
 */
export class Vector2d extends XY implements BeJSONFunctions {
  constructor(x: number = 0, y: number = 0) { super(x, y); }
  /** Return a new Vector2d with the same x,y */
  public clone(result?: Vector2d): Vector2d { return Vector2d.create(this.x, this.y, result); }
  /** Return a new Vector2d with given x and y */
  public static create(x: number = 0, y: number = 0, result?: Vector2d): Vector2d {
    if (result) {
      result.x = x;
      result.y = y;
      return result;
    }
    return new Vector2d(x, y);
  }

  /** Return a (new) Vector2d with components 1,0 */
  public static unitX(scale: number = 1): Vector2d { return new Vector2d(scale, 0); }

  /** Return a (new) Vector2d with components 0,1 */
  public static unitY(scale: number = 1): Vector2d { return new Vector2d(0, scale); }

  /** Return a Vector2d with components 0,0 */
  public static createZero(result?: Vector2d): Vector2d { return Vector2d.create(0, 0, result); }

  /** copy contents from another Point3d, Point2d, Vector2d, or Vector3d, or leading entries of Float64Array */
  public static createFrom(data: XAndY | Float64Array, result?: Vector2d): Vector2d {
    if (data instanceof Float64Array) {
      if (data.length >= 2)
        return Vector2d.create(data[0], data[1]);
      if (data.length >= 1)
        return Vector2d.create(data[0], 0);
      return Vector2d.create(0, 0);
    }
    return Vector2d.create(data.x, data.y, result);
  }
  /** Return a new Vector2d from json structured as `[1,2]` or `{x:1,y:2}` */
  public static fromJSON(json?: XYProps): Vector2d { const val = new Vector2d(); val.setFromJSON(json); return val; }
  /** Return a new Vector2d from polar coordinates for radius and Angle from x axis */
  public static createPolar(r: number, theta: Angle): Vector2d {
    return Vector2d.create(r * theta.cos(), r * theta.sin());
  }
  /** Return a new Vector2d extending from point0 to point1 */
  public static createStartEnd(point0: XAndY, point1: XAndY, result?: Vector2d): Vector2d {
    return Vector2d.create(point1.x - point0.x, point1.y - point0.y, result);
  }
  /**
   * Return a vector that bisects the angle between two normals and extends to the intersection of two offset lines
   * @param unitPerpA unit perpendicular to incoming direction
   * @param unitPerpB  unit perpendicular to outgoing direction
   * @param offset offset distance
   */
  public static createOffsetBisector(unitPerpA: Vector2d, unitPerpB: Vector2d, offset: number): Vector2d | undefined {
    let bisector: Vector2d | undefined = unitPerpA.plus(unitPerpB);
    bisector = bisector.normalize();
    if (bisector) {
      const c = offset * bisector.dotProduct(unitPerpA);
      return bisector.safeDivideOrNull(c);
    }
    return undefined;
  }

  /** Return a (new or optionally reused) vector which is `this` divided by denominator
   * * return undefined if denominator is zero.
   */
  public safeDivideOrNull(denominator: number, result?: Vector2d): Vector2d | undefined {
    if (denominator !== 0.0) {
      return this.scale(1.0 / denominator, result);
    }
    return undefined;
  }
  /** Return a unit vector in direction of this instance (undefined if this instance has near zero length) */
  public normalize(result?: Vector2d): Vector2d | undefined {
    const mag = Geometry.correctSmallMetricDistance(this.magnitude());
    result = result ? result : new Vector2d();
    return this.safeDivideOrNull(mag, result);
  }

  /** return the fractional projection of spaceVector onto this */
  public fractionOfProjectionToVector(target: Vector2d, defaultFraction?: number): number {
    const numerator = this.dotProduct(target);
    const denominator = target.magnitudeSquared();
    if (denominator < Geometry.smallMetricDistanceSquared)
      return defaultFraction ? defaultFraction : 0;
    return numerator / denominator;
  }

  /** Return a new vector with components negated from this instance. */
  public negate(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = -this.x;
    result.y = -this.y;
    return result;
  }

  /** Return a vector same length as this but rotated 90 degrees counter clockwise */
  public rotate90CCWXY(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    // save x,y to allow aliasing ..
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = -yy;
    result.y = xx;
    return result;
  }

  /** Return a vector same length as this but rotated 90 degrees clockwise */
  public rotate90CWXY(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    // save x,y to allow aliasing ..
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = yy;
    result.y = -xx;
    return result;
  }
  /** Return a unit vector perpendicular to this instance. */
  public unitPerpendicularXY(result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    const xx: number = this.x;
    const yy: number = this.y;
    result.x = -yy;
    result.y = xx;
    const d2: number = xx * xx + yy * yy;
    if (d2 !== 0.0) {
      const a = 1.0 / Math.sqrt(d2);
      result.x *= a;
      result.y *= a;
    }
    return result;
  }
  /** return a new Vector2d rotated CCW by given angle */
  public rotateXY(angle: Angle, result?: Vector2d): Vector2d {
    const s = angle.sin();
    const c = angle.cos();
    const xx: number = this.x;
    const yy: number = this.y;
    result = result ? result : new Vector2d();
    result.x = xx * c - yy * s;
    result.y = xx * s + yy * c;
    return result;
  }

  /** return the interpolation {this + fraction * (right - this)} */
  public interpolate(fraction: number, right: Vector2d, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    /* For best last-bit behavior, if fraction is below 0.5, use this as base point.   If above 0.5, use right as base point.   */
    if (fraction <= 0.5) {
      result.x = this.x + fraction * (right.x - this.x);
      result.y = this.y + fraction * (right.y - this.y);
    } else {
      const t: number = fraction - 1.0;
      result.x = right.x + t * (right.x - this.x);
      result.y = right.y + t * (right.y - this.y);
    }
    return result;
  }

  /** return {this + vector}. */
  public plus(vector: XAndY, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vector.x;
    result.y = this.y + vector.y;
    return result;
  }
  /** return {this - vector}. */
  public minus(vector: XAndY, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x - vector.x;
    result.y = this.y - vector.y;
    return result;
  }

  /** Return {point + vector \* scalar} */
  public plusScaled(vector: XAndY, scaleFactor: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vector.x * scaleFactor;
    result.y = this.y + vector.y * scaleFactor;
    return result;
  }

  /** Return {point + vectorA \* scalarA + vectorB \* scalarB} */
  public plus2Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vectorA.x * scalarA + vectorB.x * scalarB;
    result.y = this.y + vectorA.y * scalarA + vectorB.y * scalarB;
    return result;
  }

  /** Return {this + vectorA \* scalarA + vectorB \* scalarB + vectorC \* scalarC} */
  public plus3Scaled(vectorA: XAndY, scalarA: number, vectorB: XAndY, scalarB: number, vectorC: XAndY, scalarC: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x + vectorA.x * scalarA + vectorB.x * scalarB + vectorC.x * scalarC;
    result.y = this.y + vectorA.y * scalarA + vectorB.y * scalarB + vectorC.y * scalarC;
    return result;
  }
  /** Return {this * scale} */
  public scale(scale: number, result?: Vector2d): Vector2d {
    result = result ? result : new Vector2d();
    result.x = this.x * scale;
    result.y = this.y * scale;
    return result;
  }
  /** return a vector parallel to this but with specified length */
  public scaleToLength(length: number, result?: Vector2d): Vector2d | undefined {
    const mag = Geometry.correctSmallMetricDistance(this.magnitude());
    if (mag === 0)
      return undefined;
    return this.scale(length / mag, result);
  }
  /** return the dot product of this with vectorB */
  public dotProduct(vectorB: XAndY): number { return this.x * vectorB.x + this.y * vectorB.y; }

  /** dot product with vector from pointA to pointB */
  public dotProductStartEnd(pointA: XAndY, pointB: XAndY): number {
    return this.x * (pointB.x - pointA.x)
      + this.y * (pointB.y - pointA.y);
  }

  /** vector cross product {this CROSS vectorB} */
  public crossProduct(vectorB: XAndY): number { return this.x * vectorB.y - this.y * vectorB.x; }
  /** return the (signed) angle from this to vectorB.   This is positive if the shortest turn is counterclockwise, negative if clockwise. */
  public angleTo(vectorB: XAndY): Angle {
    return Angle.createAtan2(this.crossProduct(vectorB), this.dotProduct(vectorB));
  }

  /*  smallerUnorientedAngleTo(vectorB: Vector2d): Angle { }
    signedAngleTo(vectorB: Vector2d, upVector: Vector2d): Angle { }
    planarAngleTo(vectorB: Vector2d, planeNormal: Vector2d): Angle { }
    // sectors
    isInSmallerSector(vectorA: Vector2d, vectorB: Vector2d): boolean { }
    isInCCWSector(vectorA: Vector2d, vectorB: Vector2d, upVector: Vector2d): boolean { }
    */
  /**
   * Test if `this` and `other` area parallel, with angle tolerance `Geometry.smallAngleRadiansSquared`.
   * @param other second vector for comparison.
   * @param oppositeIsParallel if true, treat vectors 180 opposite as parallel.  If false, treat those as non-parallel.
   */
  public isParallelTo(other: Vector2d, oppositeIsParallel: boolean = false): boolean {
    const a2 = this.magnitudeSquared();
    const b2 = other.magnitudeSquared();
    // we know both are 0 or positive -- no need for
    if (a2 < Geometry.smallMetricDistanceSquared || b2 < Geometry.smallMetricDistanceSquared)
      return false;

    const dot = this.dotProduct(other);
    if (dot < 0.0 && !oppositeIsParallel)
      return false;

    const cross = this.crossProduct(other);

    /* a2,b2,cross2 are squared lengths of respective vectors */
    /* cross2 = sin^2(theta) * a2 * b2 */
    /* For small theta, sin^2(theta)~~theta^2 */
    return cross * cross <= Geometry.smallAngleRadiansSquared * a2 * b2;
  }
  /**
   * Returns `true` if `this` vector is perpendicular to `other`.
   * @param other second vector.
   */
  public isPerpendicularTo(other: Vector2d): boolean {
    return Angle.isPerpendicularDotSet(this.magnitudeSquared(), other.magnitudeSquared(), this.dotProduct(other));
  }
}
