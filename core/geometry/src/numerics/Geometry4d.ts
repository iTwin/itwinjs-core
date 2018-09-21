/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Numerics */

import { Geometry, BeJSONFunctions } from "../Geometry";
import { Point3d, Vector3d, XYZ, XYAndZ } from "../PointVector";
import { Matrix3d, Transform } from "../Transform";
import { Ray3d, Plane3dByOriginAndVectors } from "../AnalyticGeometry";

export type Point4dProps = number[];
export type Matrix4dProps = Point4dProps[];

/**
 *
 * @param ddg numerator second derivative
 * @param dh denominator derivative
 * @param ddh denominator second derivative
 * @param f primary function (g/h)
 * @param df derivative of (g/h)
 * @param divh = (1/h)
 * @param dgdivh previously computed first derivative of (g/h)
 */
function quotientDerivative2(ddg: number, dh: number, ddh: number,
  f: number, df: number, divh: number): number {
  return divh * (ddg - 2.0 * df * dh - f * ddh);
}

/** 4 Dimensional point (x,y,z,w) used in perspective calculations.
 * * the coordinates are stored in a Float64Array of length 4.
 * * properties `x`, `y`, `z`, `w` access array members.
 * *
 */
export class Point4d implements BeJSONFunctions {
  public xyzw: Float64Array;
  /** Set x,y,z,w of this point.  */
  public set(x: number = 0, y: number = 0, z: number = 0, w: number = 0): Point4d {
    this.xyzw[0] = x;
    this.xyzw[1] = y;
    this.xyzw[2] = z;
    this.xyzw[3] = w;
    return this;
  }
  /** @returns Return the x component of this point. */
  public get x() { return this.xyzw[0]; }
  public set x(val: number) { this.xyzw[0] = val; }
  /** @returns Return the y component of this point. */
  public get y() { return this.xyzw[1]; }
  public set y(val: number) { this.xyzw[1] = val; }
  /** @returns Return the z component of this point. */
  public get z() { return this.xyzw[2]; }
  public set z(val: number) { this.xyzw[2] = val; }
  /** @returns Return the w component of this point. */
  public get w() { return this.xyzw[3]; }
  public set w(val: number) { this.xyzw[3] = val; }

  protected constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 0) {
    this.xyzw = new Float64Array(4);
    this.xyzw[0] = x;
    this.xyzw[1] = y;
    this.xyzw[2] = z;
    this.xyzw[3] = w;
  }
  /** @returns Return a Point4d with specified x,y,z,w */
  public static create(x: number = 0, y: number = 0, z: number = 0, w: number = 0, result?: Point4d): Point4d {
    return result ? result.set(x, y, z, w) : new Point4d(x, y, z, w);
  }

  public setFrom(other: Point4d): Point4d {
    this.xyzw[0] = other.xyzw[0];
    this.xyzw[1] = other.xyzw[1];
    this.xyzw[2] = other.xyzw[2];
    this.xyzw[3] = other.xyzw[3];
    return this;
  }
  public clone(result?: Point4d): Point4d {
    return result ? result.setFrom(this) : new Point4d(this.xyzw[0], this.xyzw[1], this.xyzw[2], this.xyzw[3]);
  }
  public setFromJSON(json?: Point4dProps) {
    if (Geometry.isNumberArray(json, 4))
      this.set(json![0], json![1], json![2], json![3]);
    else
      this.set(0, 0, 0, 0);
  }
  public static fromJSON(json?: Point4dProps): Point4d {
    const result = new Point4d();
    result.setFromJSON(json);
    return result;
  }
  public isAlmostEqual(other: Point4d): boolean {
    return Geometry.isSameCoordinate(this.x, other.x)
      && Geometry.isSameCoordinate(this.y, other.y)
      && Geometry.isSameCoordinate(this.z, other.z)
      && Geometry.isSameCoordinate(this.w, other.w);
  }
  /**
   * Convert an Angle to a JSON object.
   * @return {*} [[x,y,z,w]
   */
  public toJSON(): Point4dProps {
    return [this.xyzw[0], this.xyzw[1], this.xyzw[2], this.xyzw[3]];
  }
  /** Return the 4d distance from this point to other, with all 4 components squared into the hypotenuse.
   * * x,y,z,w all participate without normalization.
   */
  public distanceXYZW(other: Point4d): number {
    return Geometry.hypotenuseXYZW(
      other.xyzw[0] - this.xyzw[0],
      other.xyzw[1] - this.xyzw[1],
      other.xyzw[2] - this.xyzw[2],
      other.xyzw[3] - this.xyzw[3]);
  }

  /** Return the squared 4d distance from this point to other, with all 4 components squared into the hypotenuse.
   * * x,y,z,w all participate without normalization.
   */
  public distanceSquaredXYZW(other: Point4d): number {
    return Geometry.hypotenuseSquaredXYZW(
      other.xyzw[0] - this.xyzw[0],
      other.xyzw[1] - this.xyzw[1],
      other.xyzw[2] - this.xyzw[2],
      other.xyzw[3] - this.xyzw[3]);
  }

  /** Return the distance between the instance and other after normalizing by weights
   */
  public realDistanceXY(other: Point4d): number | undefined {
    const wA = this.w;
    const wB = other.w;
    if (Geometry.isSmallMetricDistance(wA) || Geometry.isSmallMetricDistance(wB))
      return undefined;
    return Geometry.hypotenuseXY(
      other.xyzw[0] / wB - this.xyzw[0] / wA,
      other.xyzw[1] / wB - this.xyzw[1] / wA);
  }

  /** Return the largest absolute distance between corresponding components
   * * x,y,z,w all participate without normalization.
   */
  public maxDiff(other: Point4d): number {
    return Math.max(
      Math.abs(other.xyzw[0] - this.xyzw[0]),
      Math.abs(other.xyzw[1] - this.xyzw[1]),
      Math.abs(other.xyzw[2] - this.xyzw[2]),
      Math.abs(other.xyzw[3] - this.xyzw[3]));
  }

  /** @returns Return the largest absolute entry of all 4 components x,y,z,w */
  public maxAbs(): number {

    return Math.max(
      Math.abs(this.xyzw[0]),
      Math.abs(this.xyzw[1]),
      Math.abs(this.xyzw[2]),
      Math.abs(this.xyzw[3]));
  }
  /**  @returns Returns the magnitude including all 4 components x,y,z,w */
  public magnitudeXYZW(): number {
    return Geometry.hypotenuseXYZW(this.xyzw[0], this.xyzw[1], this.xyzw[2], this.xyzw[3]);
  }
  /** @returns Return the difference (this-other) using all 4 components x,y,z,w */
  public minus(other: Point4d, result?: Point4d): Point4d {
    return Point4d.create(
      this.xyzw[0] - other.xyzw[0],
      this.xyzw[1] - other.xyzw[1],
      this.xyzw[2] - other.xyzw[2],
      this.xyzw[3] - other.xyzw[3],
      result);
  }

  /** @returns Return ((other.w \* this) -  (this.w \* other)) */
  public crossWeightedMinus(other: Point4d, result?: Vector3d): Vector3d {
    const wa = this.xyzw[3];
    const wb = other.xyzw[3];
    return Vector3d.create(
      wb * this.xyzw[0] - wa * other.xyzw[0],
      wb * this.xyzw[1] - wa * other.xyzw[1],
      wb * this.xyzw[2] - wa * other.xyzw[2],
      result);
  }

  /** @returns Return the sum of this and other, using all 4 components x,y,z,w */
  public plus(other: Point4d, result?: Point4d): Point4d {
    return Point4d.create(
      this.xyzw[0] + other.xyzw[0],
      this.xyzw[1] + other.xyzw[1],
      this.xyzw[2] + other.xyzw[2],
      this.xyzw[3] + other.xyzw[3],
      result);
  }

  public get isAlmostZero(): boolean {
    return Geometry.isSmallMetricDistance(this.maxAbs());
  }
  public static createZero(): Point4d { return new Point4d(0, 0, 0, 0); }
  /**
   * Create plane coefficients for the plane containing pointA, pointB, and 0010.
   * @param pointA first point
   * @param pointB second point
   */
  public static createPlanePointPointZ(pointA: Point4d, pointB: Point4d) {
    return Point4d.create(
      pointA.y * pointB.w - pointA.w * pointB.y,
      pointA.w * pointB.x - pointA.x * pointB.w,
      0.0,
      pointA.x * pointB.y - pointA.y * pointB.x);
  }
  /**
   * extract 4 consecutive numbers from a Float64Array into a Point4d.
   * @param data buffer of numbers
   * @param xIndex first index for x,y,z,w sequence
   */
  public static createFromPackedXYZW(data: Float64Array, xIndex: number = 0, result?: Point4d): Point4d {
    return Point4d.create(data[xIndex], data[xIndex + 1], data[xIndex + 2], data[xIndex + 3], result);
  }

  public static createFromPointAndWeight(xyz: XYAndZ, w: number): Point4d {
    return new Point4d(xyz.x, xyz.y, xyz.z, w);
  }

  /** Return point + vector \* scalar */
  public plusScaled(vector: Point4d, scaleFactor: number, result?: Point4d): Point4d {
    return Point4d.create(
      this.xyzw[0] + vector.xyzw[0] * scaleFactor,
      this.xyzw[1] + vector.xyzw[1] * scaleFactor,
      this.xyzw[2] + vector.xyzw[2] * scaleFactor,
      this.xyzw[3] + vector.xyzw[3] * scaleFactor,
      result);
  }

  /** Return interpolation between instance and pointB at fraction
   */
  public interpolate(fraction: number, pointB: Point4d, result?: Point4d): Point4d {
    const v = 1.0 - fraction;
    return Point4d.create(
      this.xyzw[0] * v + pointB.xyzw[0] * fraction,
      this.xyzw[1] * v + pointB.xyzw[1] * fraction,
      this.xyzw[2] * v + pointB.xyzw[2] * fraction,
      this.xyzw[3] * v + pointB.xyzw[3] * fraction,
      result);
  }

  /** Return point + vectorA \* scalarA + vectorB \* scalarB */
  public plus2Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, result?: Point4d): Point4d {
    return Point4d.create(
      this.xyzw[0] + vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB,
      this.xyzw[1] + vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB,
      this.xyzw[2] + vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB,
      this.xyzw[3] + vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB,
      result);
  }

  /** Return point + vectorA \* scalarA + vectorB \* scalarB + vectorC \* scalarC */
  public plus3Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, vectorC: Point4d, scalarC: number, result?: Point4d): Point4d {
    return Point4d.create(
      this.xyzw[0] + vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB + vectorC.xyzw[0] * scalarC,
      this.xyzw[1] + vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB + vectorC.xyzw[1] * scalarC,
      this.xyzw[2] + vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB + vectorC.xyzw[2] * scalarC,
      this.xyzw[3] + vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB + vectorC.xyzw[3] * scalarC,
      result);
  }

  /** Return point + vectorA \* scalarA + vectorB \* scalarB */
  public static createAdd2Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, result?: Point4d): Point4d {
    return Point4d.create(
      vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB,
      vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB,
      vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB,
      vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB,
      result);
  }

  /** Return point + vectorA \* scalarA + vectorB \* scalarB + vectorC \* scalarC */
  public static createAdd3Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, vectorC: Point4d, scalarC: number, result?: Point4d): Point4d {
    return Point4d.create(
      vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB + vectorC.xyzw[0] * scalarC,
      vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB + vectorC.xyzw[1] * scalarC,
      vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB + vectorC.xyzw[2] * scalarC,
      vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB + vectorC.xyzw[3] * scalarC,
      result);
  }

  public dotVectorsToTargets(targetA: Point4d, targetB: Point4d): number {
    return (targetA.xyzw[0] - this.xyzw[0]) * (targetB.xyzw[0] - this.xyzw[0]) +
      (targetA.xyzw[1] - this.xyzw[1]) * (targetB.xyzw[1] - this.xyzw[1]) +
      (targetA.xyzw[2] - this.xyzw[2]) * (targetB.xyzw[2] - this.xyzw[2]) +
      (targetA.xyzw[3] - this.xyzw[3]) * (targetB.xyzw[3] - this.xyzw[3]);
  }
  public dotProduct(other: Point4d): number {
    return this.xyzw[0] * other.xyzw[0] + this.xyzw[1] * other.xyzw[1] + this.xyzw[2] * other.xyzw[2] + this.xyzw[3] * other.xyzw[3];
  }
  public dotProductXYZW(x: number, y: number, z: number, w: number): number {
    return this.xyzw[0] * x + this.xyzw[1] * y + this.xyzw[2] * z + this.xyzw[3] * w;
  }
  /** dotProduct with (point.x, point.y, point.z, 1) Used in PlaneAltitudeEvaluator interface */
  public altitude(point: Point3d): number {
    return this.xyzw[0] * point.x + this.xyzw[1] * point.y + this.xyzw[2] * point.z + this.xyzw[3];
  }

  /** dotProduct with (vector.x, vector.y, vector.z, 0).  Used in PlaneAltitudeEvaluator interface */
  public velocity(vector: Vector3d): number {
    return this.xyzw[0] * vector.x + this.xyzw[1] * vector.y + this.xyzw[2] * vector.z;
  }

  /** dotProduct with (x,y,z, 0).  Used in PlaneAltitudeEvaluator interface */
  public velocityXYZ(x: number, y: number, z: number): number {
    return this.xyzw[0] * x + this.xyzw[1] * y + this.xyzw[2] * z;
  }

  /** unit X vector */
  public static unitX(): Point4d { return new Point4d(1, 0, 0, 0); }

  /** unit Y vector */
  public static unitY(): Point4d { return new Point4d(0, 1, 0, 0); }

  /** unit Z vector */
  public static unitZ(): Point4d { return new Point4d(0, 0, 1, 0); }

  /** unit W vector */
  public static unitW(): Point4d { return new Point4d(0, 0, 0, 1); }
  // Divide by denominator, but return undefined if denominator is zero.
  public safeDivideOrNull(denominator: number, result?: Point4d): Point4d | undefined {
    if (denominator !== 0.0) {
      return this.scale(1.0 / denominator, result);
    }
    return undefined;
  }
  /** scale all components (including w!!) */
  public scale(scale: number, result?: Point4d): Point4d {
    result = result ? result : new Point4d();
    result.xyzw[0] = this.xyzw[0] * scale;
    result.xyzw[1] = this.xyzw[1] * scale;
    result.xyzw[2] = this.xyzw[2] * scale;
    result.xyzw[3] = this.xyzw[3] * scale;
    return result;
  }

  /** Negate components (including w!!) */
  public negate(result?: Point4d): Point4d {
    result = result ? result : new Point4d();
    result.xyzw[0] = -this.xyzw[0];
    result.xyzw[1] = -this.xyzw[1];
    result.xyzw[2] = -this.xyzw[2];
    result.xyzw[3] = -this.xyzw[3];
    return result;
  }

  /**
   * If `this.w` is nonzero, return a 4d point `(x/w,y/w,z/w, 1)`
   * If `this.w` is zero, return undefined.
   * @param result optional result
   */
  public normalizeWeight(result?: Point4d): Point4d | undefined {
    const mag = Geometry.correctSmallMetricDistance(this.xyzw[3]);
    result = result ? result : new Point4d();
    return this.safeDivideOrNull(mag, result);
  }
  /**
   * If `this.w` is nonzero, return a 3d point `(x/w,y/w,z/w)`
   * If `this.w` is zero, return undefined.
   * @param result optional result
   */
  public realPoint(result?: Point3d): Point3d | undefined {
    const mag = Geometry.correctSmallMetricDistance(this.xyzw[3]);
    if (mag === 0.0)
      return undefined;
    const a = 1.0 / mag;    // in zero case everything multiplies right back to true zero.
    return Point3d.create(this.xyzw[0] * a, this.xyzw[1] * a, this.xyzw[2] * a, result);
  }
  /**
   * * If w is nonzero, return Point3d with x/w,y/w,z/w.
   * * If w is zero, return 000
   * @param x x coordinate
   * @param y y coordinate
   * @param z z coordinate
   * @param w w coordinate
   * @param result optional result
   */
  public static createRealPoint3dDefault000(x: number, y: number, z: number, w: number, result?: Point3d): Point3d {
    const mag = Geometry.correctSmallMetricDistance(w);
    const a = mag === 0 ? 0.0 : (1.0 / mag);    // in zero case everything multiplies right back to true zero.
    return Point3d.create(x * a, y * a, z * a, result);
  }

  /**
   * * If w is nonzero, return Vector3d which is the derivative of the projecte xyz with given w and 4d derivatives.
   * * If w is zero, return 000
   * @param x x coordinate
   * @param y y coordinate
   * @param z z coordinate
   * @param w w coordinate
   * @param dx x coordinate of derivative
   * @param dy y coordinate of derivative
   * @param dz z coordinate of derivative
   * @param dw w coordinate of derivative
   * @param result optional result
   */
  public static createRealDerivativeRay3dDefault000(x: number, y: number, z: number, w: number, dx: number, dy: number, dz: number, dw: number, result?: Ray3d): Ray3d {
    const mag = Geometry.correctSmallMetricDistance(w);
    // real point is X/w.
    // real derivative is (X' * w - X *w) / ww, and weight is always 0 by cross products.
    const a = mag === 0 ? 0.0 : (1.0 / mag);    // in zero case everything multiplies right back to true zero.
    const aa = a * a;
    return Ray3d.createXYZUVW(x * a, y * a, z * a,
      (dx * w - dw * x) * aa,
      (dy * w - dw * y) * aa,
      (dz * w - dw * z) * aa,
      result);
  }
  /**
   * * If w is nonzero, return Vector3d which is the derivative of the projecte xyz with given w and 4d derivatives.
   * * If w is zero, return 000
   * @param x x coordinate
   * @param y y coordinate
   * @param z z coordinate
   * @param w w coordinate
   * @param dx x coordinate of derivative
   * @param dy y coordinate of derivative
   * @param dz z coordinate of derivative
   * @param dw w coordinate of derivative
   * @param result optional result
   */
  public static createRealDerivativePlane3dByOriginAndVectorsDefault000(x: number, y: number, z: number, w: number,
    dx: number, dy: number, dz: number, dw: number,
    ddx: number, ddy: number, ddz: number, ddw: number,
    result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const mag = Geometry.correctSmallMetricDistance(w);
    // real point is X/w.
    // real derivative is (X' * w - X *w) / ww, and weight is always 0 by cross products.
    const a = mag === 0 ? 0.0 : (1.0 / mag);    // in zero case everything multiplies right back to true zero.
    const aa = a * a;
    const fx = x * a;
    const fy = y * a;
    const fz = z * a;
    const dfx = (dx * w - dw * x) * aa;
    const dfy = (dy * w - dw * y) * aa;
    const dfz = (dz * w - dw * z) * aa;
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      fx, fy, fz,
      dfx, dfy, dfz,
      quotientDerivative2(ddx, dw, ddw, fx, dfx, a),
      quotientDerivative2(ddy, dw, ddw, fy, dfy, a),
      quotientDerivative2(ddz, dw, ddw, fz, dfz, a),
      result);
  }

  /**
   * * If this.w is nonzero, return Point3d with x/w,y/w,z/w.
   * * If this.w is zero, return 000
   */
  public realPointDefault000(result?: Point3d): Point3d {
    const mag = Geometry.correctSmallMetricDistance(this.xyzw[3]);
    if (mag === 0.0)
      return Point3d.create(0, 0, 0, result);
    result = result ? result : new Point3d();
    const a = 1.0 / mag;
    return Point3d.create(this.xyzw[0] * a, this.xyzw[1] * a, this.xyzw[2] * a, result);
  }

  /** divide all components (x,y,z,w) by the 4d magnitude.
   *
   * * This is appropriate for normalizing a quaternion
   * * Use normalizeWeight to divide by the w component.
   */
  public normalizeXYZW(result?: Point4d): Point4d | undefined {
    const mag = Geometry.correctSmallMetricDistance(this.magnitudeXYZW());
    result = result ? result : new Point4d();
    return this.safeDivideOrNull(mag, result);
  }
} // DPoint4d

export class Matrix4d implements BeJSONFunctions {
  private _coffs: Float64Array;
  private constructor() { this._coffs = new Float64Array(16); }
  public setFrom(other: Matrix4d): void {
    for (let i = 0; i < 16; i++)
      this._coffs[i] = other._coffs[i];
  }
  public clone(): Matrix4d {
    const result = new Matrix4d();
    for (let i = 0; i < 16; i++)
      result._coffs[i] = this._coffs[i];
    return result;
  }
  /** zero this matrix4d in place. */
  public setZero(): void {
    for (let i = 0; i < 16; i++)
      this._coffs[i] = 0;
  }
  /** set to identity. */
  public setIdentity(): void {
    for (let i = 0; i < 16; i++)
      this._coffs[i] = 0;
    this._coffs[0] = this._coffs[5] = this._coffs[10] = this._coffs[15] = 1.0;
  }
  private static is1000(a: number, b: number, c: number, d: number, tol: number): boolean {
    return Math.abs(a - 1.0) <= tol
      && Math.abs(b) <= tol
      && Math.abs(c) <= tol
      && Math.abs(d) <= tol;
  }
  /** set to identity. */
  public isIdentity(tol: number = 1.0e-10): boolean {
    return Matrix4d.is1000(this._coffs[0], this._coffs[1], this._coffs[2], this._coffs[3], tol)
      && Matrix4d.is1000(this._coffs[5], this._coffs[6], this._coffs[7], this._coffs[4], tol)
      && Matrix4d.is1000(this._coffs[10], this._coffs[11], this._coffs[8], this._coffs[9], tol)
      && Matrix4d.is1000(this._coffs[15], this._coffs[12], this._coffs[13], this._coffs[14], tol);
  }

  /** create a Matrix4d filled with zeros. */
  public static createZero(result?: Matrix4d): Matrix4d {
    if (result) {
      result.setZero();
      return result;
    }
    return new Matrix4d(); // this is zero.
  }
  /** create a Matrix4d with values supplied "across the rows" */
  public static createRowValues(
    cxx: number, cxy: number, cxz: number, cxw: number,
    cyx: number, cyy: number, cyz: number, cyw: number,
    czx: number, czy: number, czz: number, czw: number,
    cwx: number, cwy: number, cwz: number, cww: number,
    result?: Matrix4d): Matrix4d {
    result = result ? result : new Matrix4d();
    result._coffs[0] = cxx; result._coffs[1] = cxy; result._coffs[2] = cxz; result._coffs[3] = cxw;
    result._coffs[4] = cyx; result._coffs[5] = cyy; result._coffs[6] = cyz; result._coffs[7] = cyw;
    result._coffs[8] = czx; result._coffs[9] = czy; result._coffs[10] = czz; result._coffs[11] = czw;
    result._coffs[12] = cwx; result._coffs[13] = cwy; result._coffs[14] = cwz; result._coffs[15] = cww;
    return result;
  }

  /** directly set columns from typical 3d data:
   *
   * * vectorX, vectorY, vectorZ as columns 0,1,2, with weight0.
   * * origin as column3, with weight 1
   */
  public setOriginAndVectors(origin: XYZ, vectorX: Vector3d, vectorY: Vector3d, vectorZ: Vector3d) {
    this._coffs[0] = vectorX.x; this._coffs[1] = vectorY.x; this._coffs[2] = vectorZ.x; this._coffs[3] = origin.x;
    this._coffs[4] = vectorX.y; this._coffs[5] = vectorY.y; this._coffs[6] = vectorZ.y; this._coffs[7] = origin.y;
    this._coffs[8] = vectorX.z; this._coffs[9] = vectorY.z; this._coffs[10] = vectorZ.z; this._coffs[11] = origin.z;
    this._coffs[12] = 0.0; this._coffs[13] = 0.0; this._coffs[14] = 0.0; this._coffs[15] = 1.0;
  }

  /** promote a transform to full Matrix4d (with 0001 in final row) */
  public static createTransform(source: Transform, result?: Matrix4d): Matrix4d {
    const matrix = source.matrix;
    const point = source.origin;
    return Matrix4d.createRowValues(
      matrix.coffs[0], matrix.coffs[1], matrix.coffs[2], point.x,
      matrix.coffs[3], matrix.coffs[4], matrix.coffs[5], point.y,
      matrix.coffs[6], matrix.coffs[7], matrix.coffs[8], point.z,
      0, 0, 0, 1, result);
  }

  /** return an identity matrix. */
  public static createIdentity(result?: Matrix4d): Matrix4d {
    result = Matrix4d.createZero(result);
    result._coffs[0] = 1.0;
    result._coffs[5] = 1.0;
    result._coffs[10] = 1.0;
    result._coffs[15] = 1.0;
    return result;
  }
  /** return matrix with translation directly inserted (along with 1 on diagonal) */
  public static createTranslationXYZ(x: number, y: number, z: number, result?: Matrix4d): Matrix4d {
    result = Matrix4d.createZero(result);
    result._coffs[0] = 1.0;
    result._coffs[5] = 1.0;
    result._coffs[10] = 1.0;
    result._coffs[15] = 1.0;
    result._coffs[3] = x;
    result._coffs[7] = y;
    result._coffs[11] = z;
    return result;
  }
  /**
   * Create a Matrix4d with translation and scaling values directly inserted (along with 1 as final diagonal entry)
   * @param tx x entry for translation column
   * @param ty y entry for translation column
   * @param tz z entry for translation column
   * @param scaleX x diagonal entry
   * @param scaleY y diagonal entry
   * @param scaleZ z diagonal entry
   * @param result optional result.
   */
  public static createTranslationAndScaleXYZ(tx: number, ty: number, tz: number, scaleX: number, scaleY: number, scaleZ: number,
    result?: Matrix4d): Matrix4d {
    return Matrix4d.createRowValues(
      scaleX, 0, 0, tx,
      0, scaleY, 0, ty,
      0, 0, scaleZ, tz,
      0, 0, 0, 1, result);
  }
  /**
   * Create a mapping the scales and translates (no rotation) from box A to boxB
   * @param lowA low point of box A
   * @param highA high point of box A
   * @param lowB low point of box B
   * @param highB high point of box B
   */
  public static createBoxToBox(lowA: Point3d, highA: Point3d, lowB: Point3d, highB: Point3d, result?: Matrix4d): Matrix4d | undefined {
    const ax = highA.x - lowA.x;
    const ay = highA.y - lowA.y;
    const az = highA.z - lowA.z;

    const bx = highB.x - lowB.x;
    const by = highB.y - lowB.y;
    const bz = highB.z - lowB.z;

    const abx = Geometry.conditionalDivideFraction(bx, ax);
    const aby = Geometry.conditionalDivideFraction(by, ay);
    const abz = Geometry.conditionalDivideFraction(bz, az);

    if (abx !== undefined && aby !== undefined && abz !== undefined) {
      return Matrix4d.createTranslationAndScaleXYZ(
        lowB.x - abx * lowA.x,
        lowB.y - aby * lowA.y,
        lowB.z - abz * lowA.z,
        abx, aby, abz, result);
    }
    return undefined;
  }
  public setFromJSON(json?: Matrix4dProps) {
    if (Geometry.isArrayOfNumberArray(json, 4, 4))
      for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j)
          this._coffs[i * 4 + j] = json![i][j];
      }
    else
      this.setZero();
  }
  /**
   * Return the largest (absolute) difference between this and other Matrix4d.
   * @param other matrix to compare to
   */
  public maxDiff(other: Matrix4d): number {
    let a = 0.0;
    for (let i = 0; i < 16; i++)
      a = Math.max(a, Math.abs(this._coffs[i] - other._coffs[i]));
    return a;
  }
  /**
   * Return the largest absolute value in the Matrix4d
   */
  public maxAbs(): number {
    let a = 0.0;
    for (let i = 0; i < 16; i++)
      a = Math.max(a, Math.abs(this._coffs[i]));
    return a;
  }

  public isAlmostEqual(other: Matrix4d): boolean {
    return Geometry.isSmallMetricDistance(this.maxDiff(other));
  }
  /**
   * Convert an Matrix4d to a Matrix4dProps.
   */
  public toJSON(): Matrix4dProps {
    const value = [];
    for (let i = 0; i < 4; ++i) {
      const row = i * 4;
      value.push([this._coffs[row], this._coffs[row + 1], this._coffs[row + 2], this._coffs[row + 3]]);
    }
    return value;
  }
  public static fromJSON(json?: Matrix4dProps) {
    const result = new Matrix4d();
    result.setFromJSON(json);
    return result;
  }
  public getSteppedPoint(i0: number, step: number, result?: Point4d): Point4d {
    return Point4d.create(
      this._coffs[i0], this._coffs[i0 + step], this._coffs[i0 + 2 * step], this._coffs[i0 + 3 * step],
      result);
  }

  /** @returns Return column 0 as Point4d. */
  public columnX(): Point4d { return this.getSteppedPoint(0, 4); }
  /** @returns Return column 1 as Point4d. */
  public columnY(): Point4d { return this.getSteppedPoint(1, 4); }
  /** @returns Return column 2 as Point4d. */
  public columnZ(): Point4d { return this.getSteppedPoint(2, 4); }
  /** @returns Return column 3 as Point4d. */
  public columnW(): Point4d { return this.getSteppedPoint(3, 4); }

  /** @returns Return row 0 as Point4d. */
  public rowX(): Point4d { return this.getSteppedPoint(0, 1); }
  /** @returns Return row 1 as Point4d. */
  public rowY(): Point4d { return this.getSteppedPoint(4, 1); }
  /** @returns Return row 2 as Point4d. */
  public rowZ(): Point4d { return this.getSteppedPoint(8, 1); }
  /** @returns Return row 3 as Point4d. */
  public rowW(): Point4d { return this.getSteppedPoint(12, 1); }

  public get hasPerspective(): boolean {
    return this._coffs[12] !== 0.0
      || this._coffs[13] !== 0.0
      || this._coffs[14] !== 0.0
      || this._coffs[15] !== 1.0;
  }
  public diagonal(): Point4d { return this.getSteppedPoint(0, 5); }
  public weight(): number { return this._coffs[15]; }
  public matrixPart(): Matrix3d {
    return Matrix3d.createRowValues(
      this._coffs[0], this._coffs[1], this._coffs[2],
      this._coffs[4], this._coffs[5], this._coffs[6],
      this._coffs[8], this._coffs[9], this._coffs[10]);
  }
  public get asTransform(): Transform | undefined {
    if (this.hasPerspective)
      return undefined;
    return Transform.createRowValues(
      this._coffs[0], this._coffs[1], this._coffs[2], this._coffs[3],
      this._coffs[4], this._coffs[5], this._coffs[6], this._coffs[7],
      this._coffs[8], this._coffs[9], this._coffs[10], this._coffs[11]);
  }
  /** multiply this * other. */
  public multiplyMatrixMatrix(other: Matrix4d, result?: Matrix4d): Matrix4d {
    result = (result && result !== this && result !== other) ? result : new Matrix4d();
    for (let i0 = 0; i0 < 16; i0 += 4) {
      for (let k = 0; k < 4; k++)
        result._coffs[i0 + k] =
          this._coffs[i0] * other._coffs[k] +
          this._coffs[i0 + 1] * other._coffs[k + 4] +
          this._coffs[i0 + 2] * other._coffs[k + 8] +
          this._coffs[i0 + 3] * other._coffs[k + 12];
    }
    return result;
  }

  /** multiply this * transpose(other). */
  public multiplyMatrixMatrixTranspose(other: Matrix4d, result?: Matrix4d): Matrix4d {
    result = (result && result !== this && result !== other) ? result : new Matrix4d();
    let j = 0;
    for (let i0 = 0; i0 < 16; i0 += 4) {
      for (let k = 0; k < 16; k += 4)
        result._coffs[j++] =
          this._coffs[i0] * other._coffs[k] +
          this._coffs[i0 + 1] * other._coffs[k + 1] +
          this._coffs[i0 + 2] * other._coffs[k + 2] +
          this._coffs[i0 + 3] * other._coffs[k + 3];
    }
    return result;
  }
  /** multiply transpose (this) * other. */
  public multiplyMatrixTransposeMatrix(other: Matrix4d, result?: Matrix4d): Matrix4d {
    result = (result && result !== this && result !== other) ? result : new Matrix4d();
    let j = 0;
    for (let i0 = 0; i0 < 4; i0 += 1) {
      for (let k0 = 0; k0 < 4; k0 += 1)
        result._coffs[j++] =
          this._coffs[i0] * other._coffs[k0] +
          this._coffs[i0 + 4] * other._coffs[k0 + 4] +
          this._coffs[i0 + 8] * other._coffs[k0 + 8] +
          this._coffs[i0 + 12] * other._coffs[k0 + 12];
    }
    return result;
  }
  /** Return a transposed matrix. */
  public cloneTransposed(result?: Matrix4d): Matrix4d {
    return Matrix4d.createRowValues(
      this._coffs[0], this._coffs[4], this._coffs[8], this._coffs[12],
      this._coffs[1], this._coffs[5], this._coffs[9], this._coffs[13],
      this._coffs[2], this._coffs[6], this._coffs[10], this._coffs[14],
      this._coffs[3], this._coffs[7], this._coffs[11], this._coffs[15], result);
  }
  /** multiply matrix times column [x,y,z,w].  return as Point4d.   (And the returned value is NOT normalized down to unit w) */
  public multiplyXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    result = result ? result : Point4d.createZero();
    return result.set(
      this._coffs[0] * x + this._coffs[1] * y + this._coffs[2] * z + this._coffs[3] * w,
      this._coffs[4] * x + this._coffs[5] * y + this._coffs[6] * z + this._coffs[7] * w,
      this._coffs[8] * x + this._coffs[9] * y + this._coffs[10] * z + this._coffs[11] * w,
      this._coffs[12] * x + this._coffs[13] * y + this._coffs[14] * z + this._coffs[15] * w);
  }
  /** multiply matrix times column vectors [x,y,z,w] where [x,y,z,w] appear in blocks in an array.
   * replace the xyzw in the block
   */
  public multiplyBlockedFloat64ArrayInPlace(data: Float64Array) {
    const n = data.length;
    let x, y, z, w;
    for (let i = 0; i + 3 < n; i += 4) {
      x = data[i];
      y = data[i + 1];
      z = data[i + 2];
      w = data[i + 3];
      data[i] = this._coffs[0] * x + this._coffs[1] * y + this._coffs[2] * z + this._coffs[3] * w;
      data[i + 1] = this._coffs[4] * x + this._coffs[5] * y + this._coffs[6] * z + this._coffs[7] * w;
      data[i + 2] = this._coffs[8] * x + this._coffs[9] * y + this._coffs[10] * z + this._coffs[11] * w;
      data[i + 3] = this._coffs[12] * x + this._coffs[13] * y + this._coffs[14] * z + this._coffs[15] * w;
    }
  }

  /** multiply matrix times XYAndZ  and w. return as Point4d  (And the returned value is NOT normalized down to unit w) */
  public multiplyPoint3d(pt: XYAndZ, w: number, result?: Point4d): Point4d {
    return this.multiplyXYZW(pt.x, pt.y, pt.z, w, result);
  }
  /** multiply matrix times and array  of XYAndZ. return as array of Point4d  (And the returned value is NOT normalized down to unit w) */
  public multiplyPoint3dArray(pts: XYAndZ[], results: Point4d[], w: number = 1.0): void {
    pts.forEach((pt, i) => { results[i] = this.multiplyXYZW(pt.x, pt.y, pt.z, w, results[i]); });
  }
  /** multiply [x,y,z,w] times matrix.  return as Point4d.   (And the returned value is NOT normalized down to unit w) */
  public multiplyTransposeXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d {
    result = result ? result : Point4d.createZero();
    return result.set(
      this._coffs[0] * x + this._coffs[4] * y + this._coffs[8] * z + this._coffs[12] * w,
      this._coffs[1] * x + this._coffs[5] * y + this._coffs[9] * z + this._coffs[13] * w,
      this._coffs[2] * x + this._coffs[6] * y + this._coffs[10] * z + this._coffs[14] * w,
      this._coffs[3] * x + this._coffs[7] * y + this._coffs[11] * z + this._coffs[15] * w);
  }

  /** @returns dot product of row rowIndex of this with column columnIndex of other.
   */
  public rowDotColumn(rowIndex: number, other: Matrix4d, columnIndex: number): number {
    const i = rowIndex * 4;
    const j = columnIndex;
    return this._coffs[i] * other._coffs[j]
      + this._coffs[i + 1] * other._coffs[j + 4]
      + this._coffs[i + 2] * other._coffs[j + 8]
      + this._coffs[i + 3] * other._coffs[j + 12];
  }

  /** @returns dot product of row rowIndexThis of this with row rowIndexOther of other.
   */
  public rowDotRow(rowIndexThis: number, other: Matrix4d, rowIndexOther: number): number {
    const i = rowIndexThis * 4;
    const j = rowIndexOther * 4;
    return this._coffs[i] * other._coffs[j]
      + this._coffs[i + 1] * other._coffs[j + 1]
      + this._coffs[i + 2] * other._coffs[j + 2]
      + this._coffs[i + 3] * other._coffs[j + 3];
  }

  /** @returns dot product of row rowIndexThis of this with row rowIndexOther of other.
   */
  public columnDotColumn(columnIndexThis: number, other: Matrix4d, columnIndexOther: number): number {
    const i = columnIndexThis;
    const j = columnIndexOther;
    return this._coffs[i] * other._coffs[j]
      + this._coffs[i + 4] * other._coffs[j + 4]
      + this._coffs[i + 8] * other._coffs[j + 8]
      + this._coffs[i + 12] * other._coffs[j + 12];
  }

  /** @returns dot product of column columnIndexThis of this with row rowIndexOther other.
   */
  public columnDotRow(columnIndexThis: number, other: Matrix4d, rowIndexOther: number): number {
    const i = columnIndexThis;
    const j = 4 * rowIndexOther;
    return this._coffs[i] * other._coffs[j]
      + this._coffs[i + 4] * other._coffs[j + 1]
      + this._coffs[i + 8] * other._coffs[j + 2]
      + this._coffs[i + 12] * other._coffs[j + 3];
  }

  /** @returns return a matrix entry by row and column index.
   */
  public atIJ(rowIndex: number, columnIndex: number): number {
    return this._coffs[rowIndex * 4 + columnIndex];
  }

  /** multiply matrix * [x,y,z,w]. immediately renormalize to return in a Point3d.
   * If zero weight appears in the result (i.e. input is on eyeplane) leave the mapped xyz untouched.
   */
  public multiplyXYZWQuietRenormalize(x: number, y: number, z: number, w: number, result?: Point3d): Point3d {
    result = result ? result : Point3d.createZero();
    result.set(
      this._coffs[0] * x + this._coffs[1] * y + this._coffs[2] * z + this._coffs[3] * w,
      this._coffs[4] * x + this._coffs[5] * y + this._coffs[6] * z + this._coffs[7] * w,
      this._coffs[8] * x + this._coffs[9] * y + this._coffs[10] * z + this._coffs[11] * w);
    const w1 = this._coffs[12] * x + this._coffs[13] * y + this._coffs[14] * z + this._coffs[15] * w;
    if (!Geometry.isSmallMetricDistance(w1)) {
      const a = 1.0 / w1;
      result.x *= a;
      result.y *= a;
      result.z *= a;
    }
    return result;

  }
  /** multiply matrix * an array of Point4d. immediately renormalize to return in an array of Point3d. */
  public multiplyPoint4dArrayQuietRenormalize(pts: Point4d[], results: Point3d[]): void {
    pts.forEach((pt, i) => { results[i] = this.multiplyXYZWQuietRenormalize(pt.x, pt.y, pt.z, pt.w, results[i]); });
  }

  /** multiply a Point4d, return with the optional result convention. */
  public multiplyPoint4d(point: Point4d, result?: Point4d): Point4d {
    return this.multiplyXYZW(point.xyzw[0], point.xyzw[1], point.xyzw[2], point.xyzw[3], result);
  }
  /** multiply a Point4d, return with the optional result convention. */
  public multiplyTransposePoint4d(point: Point4d, result?: Point4d): Point4d {
    return this.multiplyTransposeXYZW(point.xyzw[0], point.xyzw[1], point.xyzw[2], point.xyzw[3], result);
  }

  /** multiply matrix * point. This produces a weighted xyzw.
   * Immediately renormalize back to xyz and return (with optional result convention).
   * If zero weight appears in the result (i.e. input is on eyeplane)leave the mapped xyz untouched.
   */
  public multiplyPoint3dQuietNormalize(point: XYAndZ, result?: Point3d): Point3d {
    return this.multiplyXYZWQuietRenormalize(point.x, point.y, point.z, 1.0, result);
  }

  /** multiply each matrix * points[i].   This produces a weighted xyzw.
   * Immediately renormalize back to xyz and replace the original point.
   * If zero weight appears in the result (i.e. input is on eyeplane)leave the mapped xyz untouched.
   */
  public multiplyPoint3dArrayQuietNormalize(points: Point3d[]) {
    points.forEach((point) => this.multiplyXYZWQuietRenormalize(point.x, point.y, point.z, 1.0, point));
  }

  public addMomentsInPlace(x: number, y: number, z: number, w: number) {
    this._coffs[0] += x * x; this._coffs[1] += x * y; this._coffs[2] += x * z; this._coffs[3] += x * w;
    this._coffs[4] += y * x; this._coffs[5] += y * y; this._coffs[6] += y * z; this._coffs[7] += y * w;
    this._coffs[8] += z * x; this._coffs[9] += z * y; this._coffs[10] += z * z; this._coffs[11] += z * w;
    this._coffs[12] += w * x; this._coffs[13] += w * y; this._coffs[14] += w * z; this._coffs[15] += w * w;
  }
  /** accumulate all coefficients of other to this. */
  public addScaledInPlace(other: Matrix4d, scale: number = 1.0) {
    for (let i = 0; i < 16; i++)
      this._coffs[i] += scale * other._coffs[i];
  }

  /**
   * Add scale times rowA to rowB.
   * @param rowIndexA row that is not modified
   * @param rowIndexB row that is modified.
   * @param firstColumnIndex first column modified.  All from there to the right are updated
   * @param scale scale
   */
  public rowOperation(rowIndexA: number, rowIndexB: number, firstColumnIndex: number, scale: number) {
    if (scale === 0.0) return;
    let iA = rowIndexA * 4 + firstColumnIndex;
    let iB = rowIndexB * 4 + firstColumnIndex;
    for (let i = firstColumnIndex; i < 4; i++ , iA++ , iB++)
      this._coffs[iB] += scale * this._coffs[iA];
  }
  /** Compute an inverse matrix.
   * * This uses simple Bauss-Jordan elimination -- no pivot.
   * @returns undefined if 1/pivot becomes too large. (i.e. apparent 0 pivot)
   */
  public createInverse(): Matrix4d | undefined {
    const work = this.clone();
    const inverse = Matrix4d.createIdentity();
    // console.log(work.rowArrays());
    // console.log(inverse.rowArrays());
    let pivotIndex;
    let pivotRow;
    let pivotValue;
    let divPivot;
    // Downward gaussian elimination, no pivoting:
    for (pivotRow = 0; pivotRow < 3; pivotRow++) {
      pivotIndex = pivotRow * 5;
      pivotValue = work._coffs[pivotIndex];
      // console.log("** pivot row " + pivotRow + " pivotvalue " + pivotValue);
      divPivot = Geometry.conditionalDivideFraction(1.0, pivotValue);
      if (divPivot === undefined)
        return undefined;
      let indexB = pivotIndex + 4;
      for (let rowB = pivotRow + 1; rowB < 4; rowB++ , indexB += 4) {
        const scale = -work._coffs[indexB] * divPivot;
        work.rowOperation(pivotRow, rowB, pivotRow, scale);
        inverse.rowOperation(pivotRow, rowB, 0, scale);
        // console.log(work.rowArrays());
        // console.log(inverse.rowArrays());
      }
    }
    // console.log("\n**********************Backsub\n");
    // upward gaussian elimination ...
    for (pivotRow = 1; pivotRow < 4; pivotRow++) {
      pivotIndex = pivotRow * 5;
      pivotValue = work._coffs[pivotIndex];
      // console.log("** pivot row " + pivotRow + " pivotvalue " + pivotValue);
      divPivot = Geometry.conditionalDivideFraction(1.0, pivotValue);
      if (divPivot === undefined)
        return undefined;
      let indexB = pivotRow;
      for (let rowB = 0; rowB < pivotRow; rowB++ , indexB += 4) {
        const scale = -work._coffs[indexB] * divPivot;
        work.rowOperation(pivotRow, rowB, pivotRow, scale);
        inverse.rowOperation(pivotRow, rowB, 0, scale);
        // console.log("Eliminate Row " + rowB + " from pivot " + pivotRow);
        // console.log(work.rowArrays());
        // console.log(inverse.rowArrays());
      }
    }
    // divide through by pivots (all have  beeen confirmed nonzero)
    inverse.scaleRowsInPlace(1.0 / work._coffs[0], 1.0 / work._coffs[5], 1.0 / work._coffs[10], 1.0 / work._coffs[15]);
    // console.log("descaled", inverse.rowArrays());
    return inverse;
  }
  /** @returns Restructure the matrix rows as separate arrays. (Useful for printing)
   * @param f optional function to provide alternate values for each entry (e.g. force fuzz to zero.)
   */
  public rowArrays(f?: (value: number) => any): any {
    if (f)
      return [
        [f(this._coffs[0]), f(this._coffs[1]), f(this._coffs[2]), f(this._coffs[3])],
        [f(this._coffs[4]), f(this._coffs[5]), f(this._coffs[6]), f(this._coffs[7])],
        [f(this._coffs[8]), f(this._coffs[9]), f(this._coffs[10]), f(this._coffs[11])],
        [f(this._coffs[12]), f(this._coffs[13]), f(this._coffs[14]), f(this._coffs[15])]];
    else
      return [
        [this._coffs[0], this._coffs[1], this._coffs[2], this._coffs[3]],
        [this._coffs[4], this._coffs[5], this._coffs[6], this._coffs[7]],
        [this._coffs[8], this._coffs[9], this._coffs[10], this._coffs[11]],
        [this._coffs[12], this._coffs[13], this._coffs[14], this._coffs[15]]];
  }
  public scaleRowsInPlace(ax: number, ay: number, az: number, aw: number) {
    for (let i = 0; i < 4; i++)this._coffs[i] *= ax;
    for (let i = 4; i < 8; i++)this._coffs[i] *= ay;
    for (let i = 8; i < 12; i++)this._coffs[i] *= az;
    for (let i = 12; i < 16; i++)this._coffs[i] *= aw;
  }
}
/** Map4 carries two Matrix4d which are inverses of each other.
 */
export class Map4d implements BeJSONFunctions {
  private _matrix0: Matrix4d;
  private _matrix1: Matrix4d;

  private constructor(matrix0: Matrix4d, matrix1: Matrix4d) {
    this._matrix0 = matrix0;
    this._matrix1 = matrix1;
  }
  /** @returns Return a reference to (not copy of) the "forward" Matrix4d */
  public get transform0(): Matrix4d { return this._matrix0; }
  /** @returns Return a reference to (not copy of) the "reverse" Matrix4d */
  public get transform1(): Matrix4d { return this._matrix1; }

  /** Create a Map4d, capturing the references to the two matrices. */
  public static createRefs(matrix0: Matrix4d, matrix1: Matrix4d) {
    return new Map4d(matrix0, matrix1);
  }
  /** Create an identity map. */
  public static createIdentity(): Map4d { return new Map4d(Matrix4d.createIdentity(), Matrix4d.createIdentity()); }
  /** Create a Map4d with given transform pair.
   * @returns undefined if the transforms are not inverses of each other.
   */
  public static createTransform(transform0: Transform, transform1: Transform): Map4d | undefined {
    const product = transform0.multiplyTransformTransform(transform1);
    if (!product.isIdentity)
      return undefined;
    return new Map4d(Matrix4d.createTransform(transform0), Matrix4d.createTransform(transform1));
  }
  /**
   * Create a mapping the scales and translates (no rotation) between boxes.
   * @param lowA low point of box A
   * @param highA high point of box A
   * @param lowB low point of box B
   * @param highB high point of box B
   */
  public static createBoxMap(lowA: Point3d, highA: Point3d, lowB: Point3d, highB: Point3d, result?: Map4d): Map4d | undefined {
    const t0 = Matrix4d.createBoxToBox(lowA, highA, lowB, highB, result ? result.transform0 : undefined);
    const t1 = Matrix4d.createBoxToBox(lowB, highB, lowA, highA, result ? result.transform1 : undefined);
    if (t0 && t1) {
      if (result) return result;
      return new Map4d(t0, t1);
    }
    return undefined;
  }
  /** Copy contents from another Map4d */
  public setFrom(other: Map4d) { this._matrix0.setFrom(other._matrix0), this._matrix1.setFrom(other._matrix1); }
  /** @returns Return a clone of this Map4d */
  public clone(): Map4d { return new Map4d(this._matrix0.clone(), this._matrix1.clone()); }
  /** Reinitialize this Map4d as an identity. */
  public setIdentity() { this._matrix0.setIdentity(); this._matrix1.setIdentity(); }
  /** Set this map4d from a json object that the two Matrix4d values as properties named matrix0 and matrix1 */
  public setFromJSON(json: any): void {
    if (json.matrix0 && json.matrix1) {
      this._matrix0.setFromJSON(json.matrix0);
      this._matrix1.setFromJSON(json.matrix1);
    } else
      this.setIdentity();
  }
  /** Create a map4d from a json object that the two Matrix4d values as properties named matrix0 and matrix1 */
  public static fromJSON(json?: any): Map4d {
    const result = new Map4d(Matrix4d.createIdentity(), Matrix4d.createIdentity());
    result.setFromJSON(json);
    return result;
  }
  /** @returns a json object `{matrix0: value0, matrix1: value1}` */
  public toJSON(): any { return { matrix0: this._matrix0.toJSON(), matrix1: this._matrix1.toJSON() }; }
  public isAlmostEqual(other: Map4d) {
    return this._matrix0.isAlmostEqual(other._matrix0) && this._matrix1.isAlmostEqual(other._matrix1);
  }
  /** Create a map between a frustum and world coordinates.
   * @param origin lower left of frustum
   * @param uVector Vector from lower left rear to lower right rear
   * @param vVector Vector from lower left rear to upper left rear
   * @param wVector Vector from lower left rear to lower left front, i.e. lower left rear towards eye.
   * @param fraction front size divided by rear size.
   */
  public static createVectorFrustum(origin: Point3d, uVector: Vector3d, vVector: Vector3d, wVector: Vector3d, fraction: number): Map4d | undefined {
    fraction = Math.max(fraction, 1.0e-8);
    const slabToWorld = Transform.createOriginAndMatrix(origin, Matrix3d.createColumns(uVector, vVector, wVector));
    const worldToSlab = slabToWorld.inverse();
    if (!worldToSlab)
      return undefined;
    const worldToSlabMap = Map4d.createTransform(worldToSlab, slabToWorld);
    if (undefined === worldToSlab)
      return undefined;

    const slabToNPCMap = new Map4d(
      Matrix4d.createRowValues(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, fraction, 0,
        0, 0, fraction - 1.0, 1),
      Matrix4d.createRowValues(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1.0 / fraction, 0,
        0, 0, (1.0 - fraction) / fraction, 1));
    if (undefined === worldToSlabMap)
      return undefined;
    const result = slabToNPCMap.multiplyMapMap(worldToSlabMap);
    /*
    let numIdentity = 0;
    const productA = worldToSlabMap.matrix0.multiplyMatrixMatrix(worldToSlabMap.matrix1);
    if (productA.isIdentity())
      numIdentity++;
    const productB = slabToNPCMap.matrix0.multiplyMatrixMatrix(slabToNPCMap.matrix1);
    if (productB.isIdentity())
      numIdentity++;
    const product = result.matrix0.multiplyMatrixMatrix(result.matrix1);
    if (product.isIdentity())
      numIdentity++;
    if (numIdentity === 3)
        return result;
      */
    return result;
  }
  public multiplyMapMap(other: Map4d): Map4d {
    return new Map4d(
      this._matrix0.multiplyMatrixMatrix(other._matrix0),
      other._matrix1.multiplyMatrixMatrix(this._matrix1),
    );
  }
  public reverseInPlace() {
    const temp = this._matrix0;
    this._matrix0 = this._matrix1;
    this._matrix1 = temp;
  }
  /** return a Map4d whose transform0 is
   * other.transform0 * this.transform0 * other.transform1
   */
  public sandwich0This1(other: Map4d): Map4d {
    return new Map4d(
      other._matrix0.multiplyMatrixMatrix(this._matrix0.multiplyMatrixMatrix(other._matrix1)),
      other._matrix0.multiplyMatrixMatrix(this._matrix1.multiplyMatrixMatrix(other._matrix1)),
    );
  }

  /** return a Map4d whose transform0 is
   * other.transform1 * this.transform0 * other.transform0
   */
  public sandwich1This0(other: Map4d): Map4d {
    return new Map4d(
      other._matrix1.multiplyMatrixMatrix(this._matrix0.multiplyMatrixMatrix(other._matrix0)),
      other._matrix1.multiplyMatrixMatrix(this._matrix1.multiplyMatrixMatrix(other._matrix0)));
  }
} // Map4d

/**
 * A Plane4dByOriginAndVectors is a 4d origin and pair of 4d "vectors" defining a 4d plane.
 *
 * * The parameterization of the plane is    `X = A + U*t + V*v`
 * * The unit coefficient of pointA makes this like a Plane3dByOriginAndVectors. Hence it is not a barycentric combination of 4d points.
 */
export class Plane4dByOriginAndVectors {
  public origin: Point4d;
  public vectorU: Point4d;
  public vectorV: Point4d;
  private constructor(origin: Point4d, vectorU: Point4d, vectorV: Point4d) {
    this.origin = origin;
    this.vectorU = vectorU;
    this.vectorV = vectorV;
  }
  /** @returns Return a clone of this plane */
  public clone(result?: Plane4dByOriginAndVectors): Plane4dByOriginAndVectors {
    if (result) {
      result.setFrom(this);
      return result;
    }
    return new Plane4dByOriginAndVectors(
      this.origin.clone(),
      this.vectorU.clone(),
      this.vectorV.clone());
  }

  /** copy all content from other plane */
  public setFrom(other: Plane4dByOriginAndVectors): void {
    this.origin.setFrom(other.origin);
    this.vectorU.setFrom(other.vectorU);
    this.vectorV.setFrom(other.vectorV);
  }
  /** @returns Return true if origin, vectorU, and vectorV pass isAlmostEqual. */
  public isAlmostEqual(other: Plane4dByOriginAndVectors): boolean {
    return this.origin.isAlmostEqual(other.origin)
      && this.vectorU.isAlmostEqual(other.vectorU)
      && this.vectorV.isAlmostEqual(other.vectorV);
  }
  /** Create a plane with (copies of) origin, vectorU, vectorV parameters
   */
  public static createOriginAndVectors(origin: Point4d, vectorU: Point4d, vectorV: Point4d, result?: Plane4dByOriginAndVectors): Plane4dByOriginAndVectors {
    if (result) {
      result.setOriginAndVectors(origin, vectorU, vectorV);
      return result;
    }
    return new Plane4dByOriginAndVectors(origin.clone(), vectorU.clone(), vectorV.clone());
  }
  /** Set all numeric data from complete list of (x,y,z,w) in origin, vectorU, and vectorV */
  public setOriginAndVectorsXYZW(x0: number, y0: number, z0: number, w0: number,
    ux: number, uy: number, uz: number, uw: number,
    vx: number, vy: number, vz: number, vw: number): Plane4dByOriginAndVectors {
    this.origin.set(x0, y0, z0, w0);
    this.vectorU.set(ux, uy, uz, uw);
    this.vectorV.set(vx, vy, vz, vw);
    return this;
  }
  /** Copy the contents of origin, vectorU, vectorV parameters to respective member variables */
  public setOriginAndVectors(origin: Point4d, vectorU: Point4d, vectorV: Point4d): Plane4dByOriginAndVectors {
    this.origin.setFrom(origin);
    this.vectorU.setFrom(vectorU);
    this.vectorV.setFrom(vectorV);
    return this;
  }
  /** Create from complete list of (x,y,z,w) in origin, vectorU, and vectorV */
  public static createOriginAndVectorsXYZW(x0: number, y0: number, z0: number, w0: number,
    ux: number, uy: number, uz: number, uw: number,
    vx: number, vy: number, vz: number, vw: number,
    result?: Plane4dByOriginAndVectors): Plane4dByOriginAndVectors {
    if (result)
      return result.setOriginAndVectorsXYZW(x0, y0, z0, w0, ux, uy, uz, uw, vx, vy, vz, vw);
    return new Plane4dByOriginAndVectors(
      Point4d.create(x0, y0, z0, w0), Point4d.create(ux, uy, uz, uw), Point4d.create(vx, vy, vz, uw));
  }

  public static createOriginAndTargets3d(origin: Point3d, targetU: Point3d, targetV: Point3d,
    result?: Plane4dByOriginAndVectors): Plane4dByOriginAndVectors {
    return Plane4dByOriginAndVectors.createOriginAndVectorsXYZW(
      origin.x, origin.y, origin.z, 1.0,
      targetU.x - origin.x, targetU.y - origin.y, targetU.z - origin.z, 0.0,
      targetV.x - origin.x, targetV.y - origin.y, targetV.z - origin.z, 0.0,
      result);
  }

  public fractionToPoint(u: number, v: number, result?: Point4d): Point4d {
    return this.origin.plus2Scaled(this.vectorU, u, this.vectorV, v, result);
  }
  public static createXYPlane(result?: Plane4dByOriginAndVectors): Plane4dByOriginAndVectors {
    return Plane4dByOriginAndVectors.createOriginAndVectorsXYZW(
      0, 0, 0, 1,
      1, 0, 0, 0,
      0, 1, 0, 0, result);
  }

}
