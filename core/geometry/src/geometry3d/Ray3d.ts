/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { Matrix3d } from "./Matrix3d";
import { AxisOrder, BeJSONFunctions, Geometry } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
/** A Ray3d contains
 * * an origin point.
 * * a direction vector.  The vector is NOT required to be normalized.
 *  * an optional weight (number).
 *
 */
export class Ray3d implements BeJSONFunctions {
  public origin: Point3d;
  public direction: Vector3d;
  public a?: number; // optional, e.g. weight.
  // constructor captures references !!!
  private constructor(origin: Point3d, direction: Vector3d) {
    this.origin = origin;
    this.direction = direction;
  }
  private static _create(x: number, y: number, z: number, u: number, v: number, w: number) {
    return new Ray3d(Point3d.create(x, y, z), Vector3d.create(u, v, w));
  }
  public static createXAxis(): Ray3d { return Ray3d._create(0, 0, 0, 1, 0, 0); }
  public static createYAxis(): Ray3d { return Ray3d._create(0, 0, 0, 0, 1, 0); }
  public static createZAxis(): Ray3d { return Ray3d._create(0, 0, 0, 0, 0, 1); }
  public static createZero(result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setZero();
      result.direction.setZero();
      return result;
    }
    return new Ray3d(Point3d.createZero(), Vector3d.createZero());
  }
  public isAlmostEqual(other: Ray3d): boolean {
    return this.origin.isAlmostEqual(other.origin) && this.direction.isAlmostEqual(other.direction);
  }
  public static create(origin: Point3d, direction: Vector3d, result?: Ray3d): Ray3d {
    if (result) {
      result.set(origin, direction);
      return result;
    }
    return new Ray3d(origin.clone(), direction.clone());
  }
  /**
   * Given a homogeneous point and its derivative components, construct a Ray3d with cartesian coordinates and derivatives.
   * @param weightedPoint `[x,y,z,w]` parts of weighted point.
   * @param weightedDerivative `[x,y,z,w]` derivatives
   * @param result
   */
  public static createWeightedDerivative(weightedPoint: Float64Array, weightedDerivative: Float64Array, result?: Ray3d): Ray3d | undefined {
    const w = weightedPoint[3];
    const dw = weightedDerivative[3];
    const x = weightedPoint[0];
    const y = weightedPoint[1];
    const z = weightedPoint[2];
    const dx = weightedDerivative[0] * w - weightedPoint[0] * dw;
    const dy = weightedDerivative[1] * w - weightedPoint[1] * dw;
    const dz = weightedDerivative[2] * w - weightedPoint[2] * dw;
    if (Geometry.isSmallMetricDistance(w))
      return undefined;
    const divW = 1.0 / w;
    const divWW = divW * divW;
    return Ray3d.createXYZUVW(x * divW, y * divW, z * divW, dx * divWW, dy * divWW, dz * divWW, result);
  }
  /** Create from coordinates of the origin and direction. */
  public static createXYZUVW(originX: number, originY: number, originZ: number, directionX: number, directionY: number, directionZ: number, result?: Ray3d): Ray3d {
    if (result) {
      result.getOriginRef().set(originX, originY, originZ);
      result.getDirectionRef().set(directionX, directionY, directionZ);
      return result;
    }
    return new Ray3d(Point3d.create(originX, originY, originZ), Vector3d.create(directionX, directionY, directionZ));
  }
  /** Capture origin and direction in a new Ray3d. */
  public static createCapture(origin: Point3d, direction: Vector3d): Ray3d {
    return new Ray3d(origin, direction);
  }
  /** Create from (clones of) origin, direction, and numeric weight. */
  public static createPointVectorNumber(origin: Point3d, direction: Vector3d, a: number, result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setFrom(origin);
      result.direction.setFrom(direction);
      result.a = a;
      return result;
    }
    result = new Ray3d(origin.clone(), direction.clone());
    result.a = a;
    return result;
  }
  /** Create from origin and target.  The direction vector is the full length (non-unit) vector from origin to target. */
  public static createStartEnd(origin: Point3d, target: Point3d, result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setFrom(origin);
      result.direction.setStartEnd(origin, target);
      return result;
    }
    return new Ray3d(origin, Vector3d.createStartEnd(origin, target));
  }
  /** @returns Return a reference to the ray's origin. */
  public getOriginRef(): Point3d { return this.origin; }
  /** @returns Return a reference to the ray's direction vector. */
  public getDirectionRef(): Vector3d { return this.direction; }
  /** copy coordinates from origin and direction. */
  public set(origin: Point3d, direction: Vector3d): void {
    this.origin.setFrom(origin);
    this.direction.setFrom(direction);
  }
  /** Clone the ray. */
  public clone(result?: Ray3d): Ray3d {
    if (result) {
      result.set(this.origin, this.direction);
      return result;
    }
    return new Ray3d(this.origin.clone(), this.direction.clone());
  }
  /** Create a clone and return the transform of the clone. */
  public cloneTransformed(transform: Transform): Ray3d {
    return new Ray3d(transform.multiplyPoint3d(this.origin), transform.multiplyVector(this.direction));
  }
  /** Apply a transform in place. */
  public transformInPlace(transform: Transform) {
    transform.multiplyPoint3d(this.origin, this.origin);
    transform.multiplyVector(this.direction, this.direction);
  }
  /** Copy data from another ray. */
  public setFrom(source: Ray3d): void { this.set(source.origin, source.direction); }
  /** * fraction 0 is the ray origin.
   * * fraction 1 is at the end of the direction vector when placed at the origin.
   * @returns Return a point at fractional position along the ray.
   */
  public fractionToPoint(fraction: number): Point3d { return this.origin.plusScaled(this.direction, fraction); }
  /** @returns Return the dot product of the ray's direction vector with a vector from the ray origin to the space point. */
  public dotProductToPoint(spacePoint: Point3d): number { return this.direction.dotProductStartEnd(this.origin, spacePoint); }
  /**
   * @returns Return the fractional coordinate (along the direction vector) of the spacePoint projected to the ray.
   */
  public pointToFraction(spacePoint: Point3d): number {
    return Geometry.safeDivideFraction(this.direction.dotProductStartEnd(this.origin, spacePoint), this.direction.magnitudeSquared(), 0);
  }
  /**
   *
   * @returns Return the spacePoint projected onto the ray.
   */
  public projectPointToRay(spacePoint: Point3d): Point3d {
    return this.origin.plusScaled(this.direction, this.pointToFraction(spacePoint));
  }
  /** Return a transform for rigid axes
   * at ray origin with z in ray direction.  If the direction vector is zero, axes default to identity (from createHeadsUpTriad)
   */
  public toRigidZFrame(): Transform | undefined {
    const axes = Matrix3d.createRigidHeadsUp(this.direction, AxisOrder.ZXY);
    return Transform.createOriginAndMatrix(this.origin, axes);
  }
  /**
   * Convert {origin:[x,y,z], direction:[u,v,w]} to a Ray3d.
   */
  public setFromJSON(json?: any) {
    if (!json) {
      this.origin.set(0, 0, 0);
      this.direction.set(0, 0, 1);
      return;
    }
    this.origin.setFromJSON(json.origin);
    this.direction.setFromJSON(json.direction);
  }
  /**
   * try to scale the direction vector to a given magnitude.
   * @returns Returns false if ray direction is a zero vector.
   */
  public trySetDirectionMagnitudeInPlace(magnitude: number = 1.0): boolean {
    if (this.direction.tryNormalizeInPlace()) {
      this.direction.scaleInPlace(magnitude);
      return true;
    }
    this.direction.setZero();
    this.a = 0.0;
    return false;
  }
  // input a ray and "a" understood as an area.
  // if a is clearly nonzero metric squared and the vector can be normalized, install those and return true.
  // otherwise set ray.z to zero and zero the vector of the ray and return false.
  public tryNormalizeInPlaceWithAreaWeight(a: number): boolean {
    const tolerance = Geometry.smallMetricDistanceSquared;
    this.a = a;
    if (Math.abs(a) > tolerance && this.direction.tryNormalizeInPlace(tolerance))
      return true;
    this.direction.setZero();
    this.a = 0.0;
    return false;
  }
  /**
   * Convert an Angle to a JSON object.
   * @return {*} [origin,normal]
   */
  public toJSON(): any { return { origin: this.origin.toJSON(), direction: this.direction.toJSON() }; }
  public static fromJSON(json?: any) {
    const result = Ray3d.createXAxis();
    result.setFromJSON(json);
    return result;
  }
  /** return distance to point in space */
  public distance(spacePoint: Point3d): number {
    const uu = this.direction.magnitudeSquared();
    const uv = this.dotProductToPoint(spacePoint);
    const aa = Geometry.inverseMetricDistanceSquared(uu);
    if (aa)
      return Math.sqrt(this.origin.distanceSquared(spacePoint) - uv * uv * aa);
    else
      return Math.sqrt(this.origin.distanceSquared(spacePoint));
  }
  /**
   * Return the intersection of the unbounded ray with a plane.
   * Stores the point of intersection in the result point given as a parameter,
   * and returns the parameter along the ray where the intersection occurs.
   * Returns undefined if the ray and plane are parallel.
   */
  public intersectionWithPlane(plane: Plane3dByOriginAndUnitNormal, result?: Point3d): number | undefined {
    const vectorA = Vector3d.createStartEnd(plane.getOriginRef(), this.origin);
    const uDotN = this.direction.dotProduct(plane.getNormalRef());
    const aDotN = vectorA.dotProduct(plane.getNormalRef());
    const division = Geometry.conditionalDivideFraction(-aDotN, uDotN);
    if (undefined === division)
      return undefined;
    if (result) {
      this.origin.plusScaled(this.direction, division, result);
    }
    return division;
  }
}
