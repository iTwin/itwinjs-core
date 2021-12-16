/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { AxisOrder, BeJSONFunctions, Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Point4d } from "../geometry4d/Point4d";
import { Angle } from "./Angle";
import { Matrix3d } from "./Matrix3d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { XAndY } from "./XYZProps";

/**
 * A plane defined by
 *
 * * Any point on the plane.
 * * a unit normal.
 * @public
 */
export class Plane3dByOriginAndUnitNormal implements BeJSONFunctions, PlaneAltitudeEvaluator {
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
  /** create a new  Plane3dByOriginAndUnitNormal with given origin and normal.
   * * The inputs are NOT captured.
   * * Returns undefined if the normal vector is all zeros.
   */
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
  /** create a new  Plane3dByOriginAndUnitNormal with direct coordinates of origin and normal.
   * * Returns undefined if the normal vector is all zeros.
   * * If unable to normalize return undefined. (And if result is given it is left unchanged)
   */
  public static createXYZUVW(ax: number, ay: number, az: number, ux: number, uy: number, uz: number, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal | undefined {
    const magU = Geometry.hypotenuseXYZ(ux, uy, uz);
    if (magU < Geometry.smallMetricDistance)
      return undefined;
    if (result) {
      result._origin.set(ax, ay, az);
      result._normal.set(ux / magU, uy / magU, uz / magU);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(Point3d.create(ax, ay, az), Vector3d.create(ux / magU, uy / magU, uz / magU));
  }
  /** create a new  Plane3dByOriginAndUnitNormal with unit normal (a) in the xy plane (b) perpendicular to the line defined by xy parts of origin to target.
   * * origin and normal both have z = 0.
   * * The inputs are NOT captured.
   * * Returns undefined if the normal vector is all zeros.
   */
  public static createOriginAndTargetXY(origin: XAndY, target: XAndY, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal | undefined {
    const ux = target.x - origin.x;
    const uy = target.y - origin.y;
    return  this.createXYZUVW(origin.x, origin.y, 0.0, uy, -ux, 0.0, result);
  }

  /** create a new  Plane3dByOriginAndUnitNormal with xy origin (at z=0) and normal angle in xy plane.
   * * Returns undefined if the normal vector is all zeros.
   */
  public static createXYAngle(x: number, y: number, normalAngleFromX: Angle, result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal {
    if (result) {
      result._origin.set(x, y, 0.0);
      result._normal.set(normalAngleFromX.cos(), normalAngleFromX.sin(), 0.0);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(Point3d.create(x, y, 0), Vector3d.create(normalAngleFromX.cos(), normalAngleFromX.sin()));
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

  /** test for (toleranced) equality with `other` */
  public isAlmostEqual(other: Plane3dByOriginAndUnitNormal): boolean {
    return this._origin.isAlmostEqual(other._origin) && this._normal.isAlmostEqual(other._normal);
  }
  /** Parse a json fragment `{origin: [x,y,z], normal: [ux,uy,uz]}`  */
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
  /**  create a new Plane3dByOriginAndUnitNormal from json fragment.
   * * See `Plane3dByOriginAndUnitNormal.setFromJSON`
   */
  public static fromJSON(json?: any): Plane3dByOriginAndUnitNormal {
    const result = Plane3dByOriginAndUnitNormal.createXYPlane();
    result.setFromJSON(json);
    return result;
  }
  /** Return a reference to the origin. */
  public getOriginRef(): Point3d { return this._origin; }
  /** Return a reference to the unit normal. */
  public getNormalRef(): Vector3d { return this._normal; }

  /** Return coordinate axes (as a transform) with
   * * origin at plane origin
   * * z axis in direction of plane normal.
   * * x,y axes in plane.
   */
  public getLocalToWorld(): Transform {
    const axes = Matrix3d.createRigidHeadsUp(this._normal, AxisOrder.ZXY);
    return Transform.createRefs(this._origin.clone(), axes);
  }
  /** Return a (singular) transform which projects points to this plane.
   */
  public getProjectionToPlane(): Transform {
    const axes = Matrix3d.createIdentity();
    axes.addScaledOuterProductInPlace(this._normal, this._normal, -1.0);
    axes.markSingular();
    return Transform.createFixedPointAndMatrix(this._origin, axes);
  }

  /** Copy coordinates from the given origin and normal. */
  public set(origin: Point3d, normal: Vector3d): void {
    this._origin.setFrom(origin);
    this._normal.setFrom(normal);
  }
  /** return a deep clone (point and normal cloned) */
  public clone(result?: Plane3dByOriginAndUnitNormal): Plane3dByOriginAndUnitNormal {
    if (result) {
      result.set(this._origin, this._normal);
      return result;
    }
    return new Plane3dByOriginAndUnitNormal(this._origin.clone(), this._normal.clone());
  }
  /** Create a clone and return the transform of the clone. */
  public cloneTransformed(transform: Transform, inverse: boolean = false): Plane3dByOriginAndUnitNormal | undefined {
    const result = this.clone();
    if (inverse) {
      transform.multiplyInversePoint3d(result._origin, result._origin);
      if (transform.matrix.multiplyTransposeVector(result._normal, result._normal) !== undefined
        && result._normal.normalizeInPlace())
        return result;
    } else {
      transform.multiplyPoint3d(result._origin, result._origin);
      if (transform.matrix.multiplyInverseTranspose(result._normal, result._normal) !== undefined
        && result._normal.normalizeInPlace())
        return result;
    }
    return undefined;
  }
  /** Copy data from the given plane. */
  public setFrom(source: Plane3dByOriginAndUnitNormal): void {
    this.set(source._origin, source._normal);
  }
  /** Return the altitude of spacePoint above or below the plane.  (Below is negative) */
  public altitude(spacePoint: Point3d): number { return this._normal.dotProductStartEnd(this._origin, spacePoint); }
  /** Return the altitude of point (x,y)  given xy parts using only the xy parts of origin and unit normal */
  public altitudeXY(x: number, y: number): number {
    return (x - this._origin.x) * this._normal.x + (y - this._origin.y) * this._normal.y;
  }
  /**
   * Return the x component of the normal used to evaluate altitude.
   */
   public normalX(): number {return this._normal.x; }
   /**
    * Return the x component of the normal used to evaluate altitude.
    */
    public normalY(): number {return this._normal.y; }
   /**
    * Return the z component of the normal used to evaluate altitude.
    */
    public normalZ(): number {return this._normal.z; }

  /** Return the altitude of weighted spacePoint above or below the plane.  (Below is negative) */
  public weightedAltitude(spacePoint: Point4d): number {
    return this._normal.dotProductStart3dEnd4d(this._origin, spacePoint);
  }

  /** return a point at specified (signed) altitude */
  public altitudeToPoint(altitude: number, result?: Point3d): Point3d {
    return this._origin.plusScaled(this._normal, altitude, result);
  }
  /** Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public velocityXYZ(x: number, y: number, z: number): number { return this._normal.dotProductXYZ(x, y, z); }
  /** Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public velocity(spaceVector: Vector3d): number { return this._normal.dotProduct(spaceVector); }
  /** Return the altitude of a point given as separate x,y,z components. */
  public altitudeXYZ(x: number, y: number, z: number): number {
    return this._normal.dotProductStartEndXYZ(this._origin, x, y, z);
  }
  /** Return the altitude of a point given as separate x,y,z,w components. */
  public altitudeXYZW(x: number, y: number, z: number, w: number): number {
    return this._normal.dotProductStartEndXYZW(this._origin, x, y, z, w);
  }
  /** Return the projection of spacePoint onto the plane. */
  public projectPointToPlane(spacePoint: Point3d, result?: Point3d): Point3d {
    return spacePoint.plusScaled(this._normal, -this._normal.dotProductStartEnd(this._origin, spacePoint), result);
  }
  /** Returns true of spacePoint is within distance tolerance of the plane. */
  public isPointInPlane(spacePoint: Point3d): boolean { return Geometry.isSmallMetricDistance(this.altitude(spacePoint)); }
}
