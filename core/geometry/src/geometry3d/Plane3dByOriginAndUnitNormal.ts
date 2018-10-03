/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { BeJSONFunctions, Geometry } from "../Geometry";
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
  public static createPointPointVectorInPlane(pointA: Point3d, pointB: Point3d, vector: Vector3d): Plane3dByOriginAndUnitNormal | undefined {
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
