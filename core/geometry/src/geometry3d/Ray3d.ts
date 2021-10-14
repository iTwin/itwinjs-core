/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { CurveCurveApproachType, CurveLocationDetail, CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { AxisOrder, BeJSONFunctions, Geometry } from "../Geometry";
import { SmallSystem } from "../numerics/Polynomials";
import { Matrix3d } from "./Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Vector2d } from "./Point2dVector2d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Range1d, Range3d } from "./Range";
import { Transform } from "./Transform";
import { XYAndZ } from "./XYZProps";

/** A Ray3d contains
 * * an origin point.
 * * a direction vector.  The vector is NOT required to be normalized.
 *  * an optional weight (number).
 * @public
 */
export class Ray3d implements BeJSONFunctions {
  /** The ray origin */
  public origin: Point3d;
  /** The ray direction.  This is commonly (but not always) a unit vector. */
  public direction: Vector3d;
  /** Numeric annotation. */
  public a?: number; // optional, e.g. weight.
  // constructor captures references !!!
  private constructor(origin: Point3d, direction: Vector3d) {
    this.origin = origin;
    this.direction = direction;
    this.a = undefined;
  }
  private static _create(x: number, y: number, z: number, u: number, v: number, w: number) {
    return new Ray3d(Point3d.create(x, y, z), Vector3d.create(u, v, w));
  }
  /** Create a ray on the x axis. */
  public static createXAxis(): Ray3d { return Ray3d._create(0, 0, 0, 1, 0, 0); }
  /** Create a ray on the y axis. */
  public static createYAxis(): Ray3d { return Ray3d._create(0, 0, 0, 0, 1, 0); }
  /** Create a ray on the z axis. */
  public static createZAxis(): Ray3d { return Ray3d._create(0, 0, 0, 0, 0, 1); }
  /** Create a ray with all zeros. */
  public static createZero(result?: Ray3d): Ray3d {
    if (result) {
      result.origin.setZero();
      result.direction.setZero();
      return result;
    }
    return new Ray3d(Point3d.createZero(), Vector3d.createZero());
  }
  /** Test for nearly equal rays. */
  public isAlmostEqual(other: Ray3d): boolean {
    return this.origin.isAlmostEqual(other.origin) && this.direction.isAlmostEqual(other.direction);
  }
  /** Create a ray from origin and direction. */
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
  /** Return a reference to the ray's origin. */
  public getOriginRef(): Point3d { return this.origin; }
  /** Return a reference to the ray's direction vector. */
  public getDirectionRef(): Vector3d { return this.direction; }
  /** copy coordinates from origin and direction. */
  public set(origin: Point3d, direction: Vector3d): void {
    this.origin.setFrom(origin);
    this.direction.setFrom(direction);
  }
  /** Clone the ray. */
  public clone(result?: Ray3d): Ray3d {
    if (result) {
      result.set(this.origin.clone(), this.direction.clone());
      return result;
    }
    return new Ray3d(this.origin.clone(), this.direction.clone());
  }
  /** Create a clone and return the transform of the clone. */
  public cloneTransformed(transform: Transform): Ray3d {
    return new Ray3d(transform.multiplyPoint3d(this.origin), transform.multiplyVector(this.direction));
  }

  /** Create a clone and return the inverse transform of the clone. */
  public cloneInverseTransformed(transform: Transform): Ray3d | undefined {
    const origin = transform.multiplyInversePoint3d(this.origin);
    const direction = transform.matrix.multiplyInverseXYZAsVector3d(this.direction.x, this.direction.y, this.direction.z);
    if (undefined !== origin && undefined !== direction)
      return new Ray3d(origin, direction);
    return undefined;
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
  public fractionToPoint(fraction: number, result?: Point3d): Point3d { return this.origin.plusScaled(this.direction, fraction, result); }
  /** Return the dot product of the ray's direction vector with a vector from the ray origin to the space point. */
  public dotProductToPoint(spacePoint: Point3d): number { return this.direction.dotProductStartEnd(this.origin, spacePoint); }
  /**
   * Return the fractional coordinate (along the direction vector) of the spacePoint projected to the ray.
   */
  public pointToFraction(spacePoint: Point3d): number {
    return Geometry.safeDivideFraction(this.direction.dotProductStartEnd(this.origin, spacePoint), this.direction.magnitudeSquared(), 0);
  }
  /**
   *
   * Return the spacePoint projected onto the ray.
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
  /**
   * * If parameter `a` is clearly nonzero and the direction vector can be normalized,
   *    * save the parameter `a` as the optional `a` member of the ray.
   *    * normalize the ray's direction vector
   * * If parameter `a` is nearly zero,
   *   * Set the `a` member to zero
   *   * Set the ray's direction vector to zero.
   * @param a area to be saved.
   */
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
  /** Create a new ray from json object.  See `setFromJSON` for json structure; */
  public static fromJSON(json?: any) {
    const result = Ray3d.createXAxis();
    result.setFromJSON(json);
    return result;
  }
  /** return distance from the ray to point in space */
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
   * Returns undefined if the ray and plane are parallel or coplanar.
   */
  public intersectionWithPlane(plane: Plane3dByOriginAndUnitNormal, result?: Point3d): number | undefined {
    const vectorA = Vector3d.createStartEnd(plane.getOriginRef(), this.origin);
    const uDotN = this.direction.dotProduct(plane.getNormalRef());
    const nDotN = this.direction.magnitudeSquared();
    const aDotN = vectorA.dotProduct(plane.getNormalRef());
    const division = Geometry.conditionalDivideFraction(-aDotN, uDotN);
    if (undefined === division)
      return undefined;
    const division1 = Geometry.conditionalDivideFraction(nDotN, uDotN);
    if (undefined === division1)
      return undefined;
    if (result) {
      this.origin.plusScaled(this.direction, division, result);
    }
    return division;
  }

  /**
   * * Find intersection of the ray with a Range3d.
   * * return the range of fractions (on the ray) which are "inside" the range.
   * * Note that a range is always returned;  if there is no intersection it is indicated by the test `result.sNull`
   */
  public intersectionWithRange3d(range: Range3d, result?: Range1d): Range1d {
    if (range.isNull)
      return Range1d.createNull(result);
    const interval = Range1d.createXX(-Geometry.largeCoordinateResult, Geometry.largeCoordinateResult, result);
    if (interval.clipLinearMapToInterval(this.origin.x, this.direction.x, range.low.x, range.high.x)
      && interval.clipLinearMapToInterval(this.origin.y, this.direction.y, range.low.y, range.high.y)
      && interval.clipLinearMapToInterval(this.origin.z, this.direction.z, range.low.z, range.high.z))
      return interval;
    return interval;
  }

  /** Construct a vector from `ray.origin` to target point.
   * * return the part of the vector that is perpendicular to `ray.direction`.
   *  * i.e. return the shortest vector from the ray to the point.
   */
  public perpendicularPartOfVectorToTarget(targetPoint: XYAndZ, result?: Vector3d): Vector3d {
    const vectorV = Vector3d.createStartEnd(this.origin, targetPoint);
    const uu = this.direction.magnitudeSquared();
    const uv = this.direction.dotProductStartEnd(this.origin, targetPoint);
    const fraction = Geometry.safeDivideFraction(uv, uu, 0.0);
    return vectorV.plusScaled(this.direction, -fraction, result);
  }
  /** Determine if two rays intersect, are fully overlapped, parallel but no coincident, or skew
   * * Return a CurveLocationDetailPair which
   * * contains fraction and point on each ray.
   * * has (in the CurveLocationDetailPair structure, as member approachType) annotation indicating one of these relationships
   *   * CurveCurveApproachType.Intersection -- the rays have a simple intersection, at fractions indicated in detailA and detailB
   *   * CurveCurveApproachType.PerpendicularChord -- there is pair of where the rays have closest approach.  The rays are skew in space.
   *   * CurveCurveApproachType.CoincidentGeometry -- the rays are the same unbounded line in space. The fractions and points are a representative single common point.
   *   * CurveCurveApproachType.Parallel -- the rays are parallel (and not coincident).   The two points are at the minimum distance
   */
  public static closestApproachRay3dRay3d(rayA: Ray3d, rayB: Ray3d): CurveLocationDetailPair {
    const intersectionFractions = Vector2d.create();
    let fractionA, fractionB;
    let pointA, pointB;
    let pairType;
    if (SmallSystem.ray3dXYZUVWClosestApproachUnbounded(
      rayA.origin.x, rayA.origin.y, rayA.origin.z, rayA.direction.x, rayA.direction.y, rayA.direction.z,
      rayB.origin.x, rayB.origin.y, rayB.origin.z, rayB.direction.x, rayB.direction.y, rayB.direction.z, intersectionFractions)) {
      fractionA = intersectionFractions.x;
      fractionB = intersectionFractions.y;
      pointA = rayA.fractionToPoint(fractionA);
      pointB = rayB.fractionToPoint(fractionB);
      pairType = pointA.isAlmostEqualMetric(pointB) ? CurveCurveApproachType.Intersection : CurveCurveApproachType.PerpendicularChord;
    } else {
      fractionB = 0.0;
      fractionA = rayA.pointToFraction(rayB.origin);
      pointA = rayA.fractionToPoint(fractionA);
      pointB = rayB.fractionToPoint(fractionB);
      pairType = pointA.isAlmostEqualMetric(pointB) ? CurveCurveApproachType.CoincidentGeometry : CurveCurveApproachType.ParallelGeometry;
    }
    const pair = CurveLocationDetailPair.createCapture(
      CurveLocationDetail.createRayFractionPoint(rayA, fractionA, rayA.fractionToPoint(fractionA)),
      CurveLocationDetail.createRayFractionPoint(rayB, fractionB, rayB.fractionToPoint(fractionB)));
    pair.approachType = pairType;
    return pair;
  }
}
