/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Point3d, Vector3d } from "./PointVector";
import { Transform, Matrix3d } from "./Transform";

import { AxisOrder, BeJSONFunctions, Geometry } from "./Geometry";

/**
 * A plane defined by
 *
 * * Any point on the plane.
 * * a unit normal.
 */
export class Plane3dByOriginAndUnitNormal implements BeJSONFunctions {
  private _origin: Point3d;
  private _normal: Vector3d;
  // constructor captures references !!!
  private constructor(origin: Point3d, normal: Vector3d) {
    this._origin = origin;
    this._normal = normal;
  }

  // This is private because it does not check validity of the unit vector.
  private static _create(x: number, y: number, z: number, u: number, v: number, w: number) {
    return new Plane3dByOriginAndUnitNormal(Point3d.create(x, y, z), Vector3d.create(u, v, w));
  }
  /**
   * Create a plane parallel to the XY plane
   * @param origin optional plane origin.  If omitted, the origin is placed at 000
   */
  public static createXYPlane(origin?: Point3d): Plane3dByOriginAndUnitNormal {
    if (origin)
      return Plane3dByOriginAndUnitNormal._create(origin.x, origin.y, origin.z, 0, 0, 1);
    return Plane3dByOriginAndUnitNormal._create(0, 0, 0, 0, 0, 1);
  }
  /**
   * Create a plane parallel to the YZ plane
   * @param origin optional plane origin.  If omitted, the origin is placed at 000
   */
  public static createYZPlane(origin?: Point3d): Plane3dByOriginAndUnitNormal {
    if (origin)
      return Plane3dByOriginAndUnitNormal._create(origin.x, origin.y, origin.z, 1, 0, 0);
    return Plane3dByOriginAndUnitNormal._create(0, 0, 0, 1, 0, 0);
  }
  /**
   * Create a plane parallel to the ZX plane
   * @param origin optional plane origin.  If omitted, the origin is placed at 000
   */
  public static createZXPlane(origin?: Point3d): Plane3dByOriginAndUnitNormal {
    if (origin)
      return Plane3dByOriginAndUnitNormal._create(origin.x, origin.y, origin.z, 0, 1, 0);
    return Plane3dByOriginAndUnitNormal._create(0, 0, 0, 0, 1, 0);
  }

  public static create(origin: Point3d, normal: Vector3d, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal | undefined {
    const normalized = normal.normalize();
    if (!normalized)
      return undefined;
    if (result) {
      result.set(origin, normalized);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(origin.clone(), normalized);
  }
  /** Create a plane defined by two points and an in-plane vector.
   * @param pointA any point in the plane
   * @param pointB any other point in the plane
   * @param vector any vector in the plane but not parallel to the vector from pointA to pointB
   */
  public static createPointPointVectorInPlane(
    pointA: Point3d,
    pointB: Point3d,
    vector: Vector3d): Plane3dByOriginAndUnitNormal | undefined {
    const cross = vector.crossProductStartEnd(pointA, pointB);
    if (cross.tryNormalizeInPlace())
      return new Plane3dByOriginAndUnitNormal(pointA, cross);
    return undefined;
  }
  public isAlmostEqual(other: Plane3dByOriginAndUnitNormal): boolean {
    return this._origin.isAlmostEqual(other._origin) && this._normal.isAlmostEqual(other._normal);
  }
  public setFromJSON(json?: any) {
    if (!json) {
      this._origin.set(0, 0, 0);
      this._normal.set(0, 0, 1);
    } else {
      this._origin.setFromJSON(json.origin);
      this._normal.setFromJSON(json.normal);
    }
  }
  /**
   * Convert to a JSON object.
   * @return {*} [origin,normal]
   */
  public toJSON(): any { return { origin: this._origin.toJSON(), normal: this._normal.toJSON() }; }
  public static fromJSON(json?: any): Plane3dByOriginAndUnitNormal {
    const result = Plane3dByOriginAndUnitNormal.createXYPlane();
    result.setFromJSON(json);
    return result;
  }
  /** @returns a reference to the origin. */
  public getOriginRef(): Point3d { return this._origin; }
  /** @returns a reference to the unit normal. */
  public getNormalRef(): Vector3d { return this._normal; }
  /** Copy coordinates from the given origin and normal. */
  public set(origin: Point3d, normal: Vector3d): void {
    this._origin.setFrom(origin);
    this._normal.setFrom(normal);
  }

  public clone(result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal {
    if (result) {
      result.set(this._origin, this._normal);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(this._origin.clone(), this._normal.clone());
  }
  /** Create a clone and return the transform of the clone. */
  public cloneTransformed(transform: Transform): Plane3dByOriginAndUnitNormal | undefined {
    const result = this.clone();
    transform.multiplyPoint3d(result._origin, result._origin);
    transform.matrix.multiplyInverseTranspose(result._normal, result._normal);
    if (result._normal.normalizeInPlace())
      return result;
    return undefined;
  }

  /** Copy data from the given plane. */
  public setFrom(source: Plane3dByOriginAndUnitNormal): void {
    this.set(source._origin, source._normal);
  }
  /** @returns Return the altitude of spacePoint above or below the plane.  (Below is negative) */
  public altitude(spacePoint: Point3d): number { return this._normal.dotProductStartEnd(this._origin, spacePoint); }
  /** @returns return a point at specified (signed) altitude */
  public altitudeToPoint(altitude: number, result?: Point3d): Point3d {
    return this._origin.plusScaled(this._normal, altitude, result);
  }
  /** @returns The dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public velocityXYZ(x: number, y: number, z: number): number { return this._normal.dotProductXYZ(x, y, z); }
  /** @returns The dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public velocity(spaceVector: Vector3d): number { return this._normal.dotProduct(spaceVector); }

  /** @returns the altitude of a point given as separate x,y,z components. */
  public altitudeXYZ(x: number, y: number, z: number): number {
    return this._normal.dotProductStartEndXYZ(this._origin, x, y, z);
  }
  /** @returns the altitude of a point given as separate x,y,z,w components. */
  public altitudeXYZW(x: number, y: number, z: number, w: number): number {
    return this._normal.dotProductStartEndXYZW(this._origin, x, y, z, w);
  }

  /** @returns Return the projection of spacePoint onto the plane. */
  public projectPointToPlane(spacePoint: Point3d, result?: Point3d): Point3d {
    return spacePoint.plusScaled(this._normal, -this._normal.dotProductStartEnd(this._origin, spacePoint), result);
  }
  /** @return Returns true of spacePoint is within distance tolerance of the plane. */
  public isPointInPlane(spacePoint: Point3d): boolean { return Geometry.isSmallMetricDistance(this.altitude(spacePoint)); }
}
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
  /** Create from coordinates of the origin and direction. */
  public static createXYZUVW(
    originX: number, originY: number, originZ: number,
    directionX: number, directionY: number, directionZ: number,
    result?: Ray3d): Ray3d {
    if (result) {
      result.getOriginRef().set(originX, originY, originZ);
      result.getDirectionRef().set(directionX, directionY, directionZ);
      return result;
    }
    return new Ray3d(Point3d.create(originX, originY, originZ),
      Vector3d.create(directionX, directionY, directionZ));
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
    return Geometry.safeDivideFraction(this.direction.dotProductStartEnd(this.origin, spacePoint),
      this.direction.magnitudeSquared(), 0);
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
    else return Math.sqrt(this.origin.distanceSquared(spacePoint));
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

/**
 * A Point3dVector3dVector3d is an origin and a pair of vectors.
 * This defines a plane with (possibly skewed) uv coordinates
 */
export class Plane3dByOriginAndVectors implements BeJSONFunctions {
  public origin: Point3d;
  public vectorU: Vector3d;
  public vectorV: Vector3d;
  private constructor(origin: Point3d, vectorU: Vector3d, vectorV: Vector3d) {
    this.origin = origin;
    this.vectorU = vectorU;
    this.vectorV = vectorV;
  }
  public static createOriginAndVectors(origin: Point3d, vectorU: Vector3d, vectorV: Vector3d, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    if (result) {
      result.origin.setFrom(origin);
      result.vectorU.setFrom(vectorU);
      result.vectorV.setFrom(vectorV);
      return result;
    }
    return new Plane3dByOriginAndVectors(origin.clone(), vectorU.clone(), vectorV.clone());
  }

  /** Capture origin and directions in a new planed. */
  public static createCapture(origin: Point3d, vectorU: Vector3d, vectorV: Vector3d, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    if (!result) return new Plane3dByOriginAndVectors(origin, vectorU, vectorV);
    result.origin = origin;
    result.vectorU = vectorU;
    result.vectorV = vectorV;
    return result;
  }

  public setOriginAndVectorsXYZ(x0: number, y0: number, z0: number,
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number): Plane3dByOriginAndVectors {
    this.origin.set(x0, y0, z0);
    this.vectorU.set(ux, uy, uz);
    this.vectorV.set(vx, vy, vz);
    return this;
  }

  public setOriginAndVectors(origin: Point3d, vectorU: Vector3d, vectorV: Vector3d): Plane3dByOriginAndVectors {
    this.origin.setFrom(origin);
    this.vectorU.setFrom(vectorU);
    this.vectorV.setFrom(vectorV);
    return this;
  }

  public static createOriginAndVectorsXYZ(x0: number, y0: number, z0: number,
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
    result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    if (result)
      return result.setOriginAndVectorsXYZ(x0, y0, z0, ux, uy, uz, vx, vy, vz);
    return new Plane3dByOriginAndVectors(
      Point3d.create(x0, y0, z0), Vector3d.create(ux, uy, uz), Vector3d.create(vx, vy, vz));
  }
  /** Define a plane by three points in the plane.
   * @param origin origin for the parameterization.
   * @param targetU target point for the vectorU starting at the origin.
   * @param targetV target point for the vectorV originating at the origin.
   * @param result optional result.
   */
  public static createOriginAndTargets(origin: Point3d, targetU: Point3d, targetV: Point3d,
    result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      origin.x, origin.y, origin.z,
      targetU.x - origin.x, targetU.y - origin.y, targetU.z - origin.z,
      targetV.x - origin.x, targetV.y - origin.y, targetV.z - origin.z,
      result);
  }
  /** Create a plane with origin at 000, unit vectorU in x direction, and unit vectorV in the y direction.
   */
  public static createXYPlane(result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, result);
  }
  /** create a plane from data presented as Float64Arrays.
   * @param origin x,y,z of origin.
   * @param vectorU x,y,z of vectorU
   * @param vectorV x,y,z of vectorV
   */
  public static createOriginAndVectorsArrays(
    origin: Float64Array,
    vectorU: Float64Array,
    vectorV: Float64Array,
    result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(origin[0], origin[1], origin[2],
      vectorU[0], vectorU[1], vectorU[2], vectorV[0], vectorV[1], vectorV[2], result);
  }

  /** create a plane from data presented as Float64Array with weights
   * @param origin x,y,z,w of origin.
   * @param vectorU x,y,z,w of vectorU
   * @param vectorV x,y,z,w of vectorV
   */
  public static createOriginAndVectorsWeightedArrays(
    originw: Float64Array,
    vectorUw: Float64Array,
    vectorVw: Float64Array,
    result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const w = originw[3];
    result = Plane3dByOriginAndVectors.createXYPlane(result);
    if (Geometry.isSmallMetricDistance(w))
      return result;
    const dw = 1.0 / w;
    const au = vectorUw[3] * dw * dw;
    const av = vectorVw[3] * dw * dw;
    // for homogeneous function X, with w its weight:
    // (X/w) is the cartesian point.
    // (X/w)' = (X' w - X w')/(w*w)
    //        = X'/w  - (X/w)(w'/w)
    //        = X'/w  - X w'/w^2)
    // The w parts of the formal xyzw sums are identically 0.
    // Here the X' and its w' are taken from each vectorUw and vectorVw
    result.origin.set(originw[0] * dw, originw[1] * dw, originw[2] * dw);
    Vector3d.createAdd2ScaledXYZ(
      vectorUw[0], vectorUw[1], vectorUw[2], dw,
      originw[0], originw[1], originw[2], -au,
      result.vectorU);
    Vector3d.createAdd2ScaledXYZ(
      vectorVw[0], vectorVw[1], vectorVw[2], dw,
      originw[0], originw[1], originw[2], -av,
      result.vectorV);
    return result;
  }
  /**
   * Evaluate a point a grid coordinates on the plane.
   * * The computed point is `origin + vectorU * u + vectorV * v`
   * @param u coordinate along vectorU
   * @param v coordinate along vectorV
   * @param result optional result destination.
   * @returns Return the computed coordinate.
   */
  public fractionToPoint(u: number, v: number, result?: Point3d): Point3d {
    return this.origin.plus2Scaled(this.vectorU, u, this.vectorV, v, result);
  }
  public fractionToVector(u: number, v: number, result?: Vector3d): Vector3d {
    return Vector3d.createAdd2Scaled(this.vectorU, u, this.vectorV, v, result);
  }
  public setFromJSON(json?: any) {
    if (!json || !json.origin || !json.vectorV) {
      this.origin.set(0, 0, 0);
      this.vectorU.set(1, 0, 0);
      this.vectorV.set(0, 1, 0);
    } else {
      this.origin.setFromJSON(json.origin);
      this.vectorU.setFromJSON(json.vectorU);
      this.vectorV.setFromJSON(json.vectorV);
    }
  }
  /**
   * Convert an Angle to a JSON object.
   * @return {*} [origin,normal]
   */
  public toJSON(): any {
    return {
      origin: this.origin.toJSON(),
      vectorU: this.vectorU.toJSON(),
      vectorV: this.vectorV.toJSON(),
    };
  }
  public static fromJSON(json?: any): Plane3dByOriginAndVectors {
    const result = Plane3dByOriginAndVectors.createXYPlane();
    result.setFromJSON(json);
    return result;
  }

  public isAlmostEqual(other: Plane3dByOriginAndVectors): boolean {
    return this.origin.isAlmostEqual(other.origin)
      && this.vectorU.isAlmostEqual(other.vectorU)
      && this.vectorV.isAlmostEqual(other.vectorV);
  }
}
