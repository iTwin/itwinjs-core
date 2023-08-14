/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { AxisOrder, BeJSONFunctions, Geometry } from "../Geometry";
import { Plane3d } from "./Plane3d";
import { Point4d } from "../geometry4d/Point4d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Ray3d } from "./Ray3d";
import { Transform } from "./Transform";
import { XYAndZ } from "./XYZProps";
import { Matrix3d } from "./Matrix3d";

/**
 * A Plane3dByOriginAndVectors is an origin and a pair of vectors.
 * This defines a plane with a (possibly skewed) uv coordinate grid
 * * The grid directions (`vectorU` and `vectorV`)
 *   * are NOT required to be unit vectors.
 *   * are NOT required to be perpendicular vectors.
 * * The skewed, non-uniform scaling of the grid directions is the primary focus of this class.
 * * Queries of altitude, velocity, normalX, normalY, and normalZ use the NORMALIZED cross product of vectorU
 * and vectorV as plane normal.
 *   * Hence these are cartesian distances.
 *   * If numerous calls to these are expected, the repeated normalization may be a performance issue.
 *   * Using a [[Plane3dByOriginAndUnitNormal]] or the rigid transform returned by [[toRigidFrame]] would provide
 * better performance.
 * @public
 */
export class Plane3dByOriginAndVectors extends Plane3d implements BeJSONFunctions {
  /** Origin of plane grid */
  public origin: Point3d;
  /** u direction in plane grid */
  public vectorU: Vector3d;
  /** v direction in plane grid */
  public vectorV: Vector3d;
  private constructor(origin: Point3d, vectorU: Vector3d, vectorV: Vector3d) {
    super();
    this.origin = origin;
    this.vectorU = vectorU;
    this.vectorV = vectorV;
  }
  /** Create a new plane from origin and 2 in-plane vectors. */
  public static createOriginAndVectors(
    origin: Point3d, vectorU: Vector3d, vectorV: Vector3d, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    if (result) {
      result.origin.setFrom(origin);
      result.vectorU.setFrom(vectorU);
      result.vectorV.setFrom(vectorV);
      return result;
    }
    return new Plane3dByOriginAndVectors(origin.clone(), vectorU.clone(), vectorV.clone());
  }
  /** Clone to a new plane. */
  public clone(result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    if (result !== undefined)
      result.setOriginAndVectors(this.origin, this.vectorU, this.vectorV);
    return new Plane3dByOriginAndVectors(this.origin.clone(), this.vectorU.clone(), this.vectorV.clone());
  }
  /**
   * Create a new Plane3dByOriginAndVectors from a variety of plane types.
   * * The input is NOT captured.
   */
  public static createFrom(source: Plane3d, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined {
    if (source instanceof Plane3dByOriginAndVectors)
      return source.clone(result);
    const normal = source.getUnitNormal();
    if (normal === undefined)
      return undefined;
    const origin = source.getAnyPointOnPlane();
    const vectorU = Matrix3d.createPerpendicularVectorFavorXYPlane(normal);
    if (vectorU.tryNormalizeInPlace()) {
      const vectorV = normal.unitCrossProduct(vectorU);
      if (vectorV !== undefined)
        return new Plane3dByOriginAndVectors(origin, vectorU, vectorV);
    }
    return undefined;
  }

  /**
   * Return a Plane3dByOriginAndVectors, with
   * * origin is the translation (aka origin) from the Transform
   * * vectorU is the X column of the transform
   * * vectorV is the Y column of the transform.
   * @param transform source transform
   * @param xLength optional length to impose on vectorU.
   * @param yLength optional length to impose on vectorV.
   * @param result optional preexisting result
   */
  public static createFromTransformColumnsXYAndLengths(
    transform: Transform, xLength: number | undefined, yLength: number | undefined, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    if (result) {
      result.origin.setFrom(transform.getOrigin());
      transform.matrix.columnX(result.vectorU);
      transform.matrix.columnY(result.vectorV);
    } else {
      result = new Plane3dByOriginAndVectors(
        transform.getOrigin(),
        transform.matrix.columnX(),
        transform.matrix.columnY());
    }
    if (xLength !== undefined)
      result.vectorU.scaleToLength(xLength, result.vectorU);
    if (yLength !== undefined)
      result.vectorV.scaleToLength(yLength, result.vectorV);
    return result;
  }
  /** Capture origin and directions in a new plane. */
  public static createCapture(
    origin: Point3d, vectorU: Vector3d, vectorV: Vector3d, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    if (!result)
      return new Plane3dByOriginAndVectors(origin, vectorU, vectorV);
    result.origin = origin;
    result.vectorU = vectorU;
    result.vectorV = vectorV;
    return result;
  }

  /** Set all origin and both vectors from direct numeric parameters */
  public setOriginAndVectorsXYZ(
    x0: number, y0: number, z0: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number,
  ): Plane3dByOriginAndVectors {
    this.origin.set(x0, y0, z0);
    this.vectorU.set(ux, uy, uz);
    this.vectorV.set(vx, vy, vz);
    return this;
  }
  /**
   * Set all origin and both vectors from coordinates in given origin and vectors.
   * * Note that coordinates are copied out of the parameters -- the given parameters are NOT retained by reference.
   */
  public setOriginAndVectors(origin: Point3d, vectorU: Vector3d, vectorV: Vector3d): Plane3dByOriginAndVectors {
    this.origin.setFrom(origin);
    this.vectorU.setFrom(vectorU);
    this.vectorV.setFrom(vectorV);
    return this;
  }
  /** Create a new plane from direct numeric parameters */
  public static createOriginAndVectorsXYZ(
    x0: number, y0: number, z0: number,
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
    result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    if (result)
      return result.setOriginAndVectorsXYZ(x0, y0, z0, ux, uy, uz, vx, vy, vz);
    return new Plane3dByOriginAndVectors(
      Point3d.create(x0, y0, z0), Vector3d.create(ux, uy, uz), Vector3d.create(vx, vy, vz),
    );
  }
  /**
   * Define a plane by three points in the plane.
   * @param origin origin for the parameterization.
   * @param targetU target point for the vectorU starting at the origin.
   * @param targetV target point for the vectorV originating at the origin.
   * @param result optional result.
   */
  public static createOriginAndTargets(
    origin: Point3d, targetU: Point3d, targetV: Point3d, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      origin.x, origin.y, origin.z,
      targetU.x - origin.x, targetU.y - origin.y, targetU.z - origin.z,
      targetV.x - origin.x, targetV.y - origin.y, targetV.z - origin.z,
      result,
    );
  }
  /** Create a plane with origin at 000, unit vectorU in x direction, and unit vectorV in the y direction. */
  public static createXYPlane(result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(0, 0, 0, 1, 0, 0, 0, 1, 0, result);
  }
  /**
   * Create a plane from data presented as Float64Arrays.
   * @param origin x,y,z of origin.
   * @param vectorU x,y,z of vectorU
   * @param vectorV x,y,z of vectorV
   */
  public static createOriginAndVectorsArrays(
    origin: Float64Array, vectorU: Float64Array, vectorV: Float64Array, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      origin[0], origin[1], origin[2],
      vectorU[0], vectorU[1], vectorU[2],
      vectorV[0], vectorV[1], vectorV[2],
      result,
    );
  }
  /**
   * Create a plane from data presented as Float64Array with weights
   * @param origin x,y,z,w of origin.
   * @param vectorU x,y,z,w of vectorU
   * @param vectorV x,y,z,w of vectorV
   */
  public static createOriginAndVectorsWeightedArrays(
    originW: Float64Array, vectorUw: Float64Array, vectorVw: Float64Array, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors {
    const w = originW[3];
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
    result.origin.set(originW[0] * dw, originW[1] * dw, originW[2] * dw);
    Vector3d.createAdd2ScaledXYZ(
      vectorUw[0], vectorUw[1], vectorUw[2], dw, originW[0], originW[1], originW[2], -au, result.vectorU,
    );
    Vector3d.createAdd2ScaledXYZ(
      vectorVw[0], vectorVw[1], vectorVw[2], dw, originW[0], originW[1], originW[2], -av, result.vectorV,
    );
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
  /** Return the vector from the plane origin to parametric coordinate (u.v) */
  public fractionToVector(u: number, v: number, result?: Vector3d): Vector3d {
    return Vector3d.createAdd2Scaled(this.vectorU, u, this.vectorV, v, result);
  }
  /** Set coordinates from a json object such as `{origin: [1,2,3], vectorU:[4,5,6], vectorV[3,2,1]}` */
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
  /** Create a new plane.   See `setFromJSON` for layout example. */
  public static fromJSON(json?: any): Plane3dByOriginAndVectors {
    const result = Plane3dByOriginAndVectors.createXYPlane();
    result.setFromJSON(json);
    return result;
  }
  /** Test origin and vectors for isAlmostEqual with `other` */
  public isAlmostEqual(other: Plane3dByOriginAndVectors): boolean {
    return this.origin.isAlmostEqual(other.origin)
      && this.vectorU.isAlmostEqual(other.vectorU)
      && this.vectorV.isAlmostEqual(other.vectorV);
  }
  /**
   * Normalize both `vectorU` and `vectorV` in place. This does NOT make them perpendicular.
   * * Return true if both succeeded.
   */
  public normalizeInPlace(): boolean {
    const okU = this.vectorU.normalizeInPlace();
    const okV = this.vectorV.normalizeInPlace();
    return okU && okV;
  }
  /** Return (if possible) a unit normal to the plane */
  public override getUnitNormal(result?: Vector3d): Vector3d | undefined {
    return this.vectorU.unitCrossProduct(this.vectorV, result);
  }
  /**
   * Return (if possible) a unit normal to the plane.
   * * This method is the same as getUnitNormal, which was created later as part of the abstract base class Plane3d.
   */
  public unitNormal(result?: Vector3d): Vector3d | undefined {
    return this.vectorU.unitCrossProduct(this.vectorV, result);
  }
  /**
   * Return some point on the plane.
   */
  public override getAnyPointOnPlane(result?: Point3d): Point3d {
    // This function returns the plane origin. In general, a point x is on the plane if
    // and only if x = o + a*u + b*v, where a and b are scalars.
    return this.origin.clone(result);
  }
  private static _workVector: Vector3d;
  /** Return (if possible) a ray with origin at plane origin, direction as unit normal to the plane */
  public unitNormalRay(result?: Ray3d): Ray3d | undefined {
    if (!Plane3dByOriginAndVectors._workVector)
      Plane3dByOriginAndVectors._workVector = Vector3d.create();
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV, Plane3dByOriginAndVectors._workVector);
    if (unitNormal === undefined)
      return undefined;
    return Ray3d.create(this.origin, unitNormal, result);
  }
  /**
   * Create a rigid frame (i.e. frenet frame) with
   * * origin at the plane origin
   * * x axis along the (normalized) vectorU
   * * y axis normalized vectorU to vectorV plane, and perpendicular to x axis
   * * z axis perpendicular to both.
   * @param result optional result
   */
  public toRigidFrame(result?: Transform): Transform | undefined {
    return Transform.createRigidFromOriginAndColumns(this.origin, this.vectorU, this.vectorV, AxisOrder.XYZ, result);
  }
  /** Apply the transform to the origin and vectors in place */
  public transformInPlace(transform: Transform) {
    transform.multiplyPoint3d(this.origin, this.origin);
    transform.multiplyVector(this.vectorU, this.vectorU);
    transform.multiplyVector(this.vectorV, this.vectorV);
  }
  /**
   * Return x component of the (normalized!) {vectorU CROSS vectorV}.
   * Return 0 if the cross product is zero.
   */
  public normalX(): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    return unitNormal !== undefined ? unitNormal.x : 0.0;
  }
  /**
   * Return y component of the (normalized!) {vectorU CROSS vectorV}.
   * Return 0 if the cross product is zero.
   */
  public normalY(): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    return unitNormal !== undefined ? unitNormal.y : 0.0;
  }
  /**
   * Return z component of the (normalized!) {vectorU CROSS vectorV}.
   * Return 0 if the cross product is zero.
   */
  public normalZ(): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    return unitNormal !== undefined ? unitNormal.z : 0.0;
  }
  /** Return signed cartesian altitude perpendicular to the plane. This uses the normalized cross product as normal. */
  public altitude(xyz: XYAndZ): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    if (unitNormal === undefined)
      return 0.0;
    return Geometry.dotProductXYZXYZ(
      (xyz.x - this.origin.x), (xyz.y - this.origin.y), (xyz.z - this.origin.z),
      unitNormal.x, unitNormal.y, unitNormal.z);
  }
  /** Return signed cartesian altitude perpendicular to the plane. This uses the normalized cross product as normal. */
  public altitudeXYZ(x: number, y: number, z: number): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    if (unitNormal === undefined)
      return 0.0;
    return Geometry.dotProductXYZXYZ(
      (x - this.origin.x), (y - this.origin.y), (z - this.origin.z),
      unitNormal.x, unitNormal.y, unitNormal.z);
  }
  /** Return signed projection of the input vector to the plane normal. This uses the normalized cross product as normal. */
  public velocity(xyzVector: XYAndZ): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    if (unitNormal === undefined)
      return 0.0;
    return Geometry.dotProductXYZXYZ(
      xyzVector.x, xyzVector.y, xyzVector.z,
      unitNormal.x, unitNormal.y, unitNormal.z);
  }
  /** Return signed projection of the input vector to the plane normal. This uses the normalized cross product as normal. */
  public velocityXYZ(x: number, y: number, z: number): number {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    if (unitNormal === undefined)
      return 0.0;
    return Geometry.dotProductXYZXYZ(
      x, y, z,
      unitNormal.x, unitNormal.y, unitNormal.z);
  }
  /**
   * Return triple product of homogeneous difference {(xyzw - w * origin)} with vectorU and vectorV.
   * * In the usual manner of homogeneous calculations, this is proportional to true cartesian distance from the
   * plane but is not a physical distance.
   */
  public weightedAltitude(xyzw: Point4d) {
    const w = xyzw.w;
    return Geometry.tripleProduct(
      (xyzw.x - this.origin.x * w), (xyzw.y - this.origin.y * w), (xyzw.z - this.origin.z * w),
      this.vectorU.x, this.vectorU.y, this.vectorU.z,
      this.vectorV.x, this.vectorV.y, this.vectorV.z);
  }
  /**
   * Return the projection of spacePoint onto the plane.
   * If the plane is degenerate to a ray, project to the ray.
   * If the plane is degenerate to its origin, return the point
   */
  public projectPointToPlane(spacePoint: Point3d, result?: Point3d): Point3d {
    const unitNormal = this.vectorU.unitCrossProduct(this.vectorV);
    if (unitNormal !== undefined) {
      const w = unitNormal.dotProductStartEnd(this.origin, spacePoint);
      return spacePoint.plusScaled(unitNormal, -w, result);
    }
    // uh oh.   vectorU and vectorV are colinear or zero.
    // project to ray defined by the longer one, or just to origin.
    const dotUU = this.vectorU.magnitudeSquared();
    const dotVV = this.vectorV.magnitudeSquared();
    if (dotUU >= dotVV) {
      const dotUW = this.vectorU.dotProductStartEnd(this.origin, spacePoint);
      const f = Geometry.conditionalDivideCoordinate(dotUW, dotUU, 0.0);
      if (f !== undefined)
        return spacePoint.plusScaled(this.vectorU, f, result);
    } else {
      const dotVW = this.vectorV.dotProductStartEnd(this.origin, spacePoint);
      const f = Geometry.conditionalDivideCoordinate(dotVW, dotVV, 0.0);
      if (f !== undefined)
        return spacePoint.plusScaled(this.vectorV, f, result);
    }
    return this.origin.clone(result);
  }
}
