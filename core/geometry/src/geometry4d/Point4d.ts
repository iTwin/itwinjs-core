/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Numerics */
import { Geometry, BeJSONFunctions } from "../Geometry";
import { XYAndZ } from "../geometry3d/XYZProps";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";

export type Point4dProps = number[];
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
export function quotientDerivative2(ddg: number, dh: number, ddh: number,
  f: number, df: number, divh: number): number {
  return divh * (ddg - 2.0 * df * dh - f * ddh);
}

/** 4 Dimensional point (x,y,z,w) used in perspective calculations.
 * * the coordinates are stored in a Float64Array of length 4.
 * * properties `x`, `y`, `z`, `w` access array members.
 * *
 * * The coordinates are physically stored as a single FLoat64Array with 4 entries. (w last)
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
    return Geometry.hypotenuseXYZW(other.xyzw[0] - this.xyzw[0], other.xyzw[1] - this.xyzw[1], other.xyzw[2] - this.xyzw[2], other.xyzw[3] - this.xyzw[3]);
  }
  /** Return the squared 4d distance from this point to other, with all 4 components squared into the hypotenuse.
   * * x,y,z,w all participate without normalization.
   */
  public distanceSquaredXYZW(other: Point4d): number {
    return Geometry.hypotenuseSquaredXYZW(other.xyzw[0] - this.xyzw[0], other.xyzw[1] - this.xyzw[1], other.xyzw[2] - this.xyzw[2], other.xyzw[3] - this.xyzw[3]);
  }
  /** Return the distance between the instance and other after normalizing by weights
   */
  public realDistanceXY(other: Point4d): number | undefined {
    const wA = this.w;
    const wB = other.w;
    if (Geometry.isSmallMetricDistance(wA) || Geometry.isSmallMetricDistance(wB))
      return undefined;
    return Geometry.hypotenuseXY(other.xyzw[0] / wB - this.xyzw[0] / wA, other.xyzw[1] / wB - this.xyzw[1] / wA);
  }
  /** Return the largest absolute distance between corresponding components
   * * x,y,z,w all participate without normalization.
   */
  public maxDiff(other: Point4d): number {
    return Math.max(Math.abs(other.xyzw[0] - this.xyzw[0]), Math.abs(other.xyzw[1] - this.xyzw[1]), Math.abs(other.xyzw[2] - this.xyzw[2]), Math.abs(other.xyzw[3] - this.xyzw[3]));
  }
  /** @returns Return the largest absolute entry of all 4 components x,y,z,w */
  public maxAbs(): number {
    return Math.max(Math.abs(this.xyzw[0]), Math.abs(this.xyzw[1]), Math.abs(this.xyzw[2]), Math.abs(this.xyzw[3]));
  }
  /**  @returns Returns the magnitude including all 4 components x,y,z,w */
  public magnitudeXYZW(): number {
    return Geometry.hypotenuseXYZW(this.xyzw[0], this.xyzw[1], this.xyzw[2], this.xyzw[3]);
  }
  /** @returns Return the difference (this-other) using all 4 components x,y,z,w */
  public minus(other: Point4d, result?: Point4d): Point4d {
    return Point4d.create(this.xyzw[0] - other.xyzw[0], this.xyzw[1] - other.xyzw[1], this.xyzw[2] - other.xyzw[2], this.xyzw[3] - other.xyzw[3], result);
  }
  /** @returns Return `((other.w * this) -  (this.w * other))` */
  public crossWeightedMinus(other: Point4d, result?: Vector3d): Vector3d {
    const wa = this.xyzw[3];
    const wb = other.xyzw[3];
    return Vector3d.create(wb * this.xyzw[0] - wa * other.xyzw[0], wb * this.xyzw[1] - wa * other.xyzw[1], wb * this.xyzw[2] - wa * other.xyzw[2], result);
  }
  /** @returns Return the sum of this and other, using all 4 components x,y,z,w */
  public plus(other: Point4d, result?: Point4d): Point4d {
    return Point4d.create(this.xyzw[0] + other.xyzw[0], this.xyzw[1] + other.xyzw[1], this.xyzw[2] + other.xyzw[2], this.xyzw[3] + other.xyzw[3], result);
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
  public static createPlanePointPointZ(pointA: Point4d, pointB: Point4d, result?: Point4d) {
    return Point4d.create(pointA.y * pointB.w - pointA.w * pointB.y, pointA.w * pointB.x - pointA.x * pointB.w, 0.0, pointA.x * pointB.y - pointA.y * pointB.x, result);
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
  /** Return `point + vector * scalar` */
  public plusScaled(vector: Point4d, scaleFactor: number, result?: Point4d): Point4d {
    return Point4d.create(this.xyzw[0] + vector.xyzw[0] * scaleFactor, this.xyzw[1] + vector.xyzw[1] * scaleFactor, this.xyzw[2] + vector.xyzw[2] * scaleFactor, this.xyzw[3] + vector.xyzw[3] * scaleFactor, result);
  }
  /** Return interpolation between instance and pointB at fraction
   */
  public interpolate(fraction: number, pointB: Point4d, result?: Point4d): Point4d {
    const v = 1.0 - fraction;
    return Point4d.create(this.xyzw[0] * v + pointB.xyzw[0] * fraction, this.xyzw[1] * v + pointB.xyzw[1] * fraction, this.xyzw[2] * v + pointB.xyzw[2] * fraction, this.xyzw[3] * v + pointB.xyzw[3] * fraction, result);
  }
  /** Return `point + vectorA * scalarA + vectorB * scalarB` */
  public plus2Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, result?: Point4d): Point4d {
    return Point4d.create(this.xyzw[0] + vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB, this.xyzw[1] + vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB, this.xyzw[2] + vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB, this.xyzw[3] + vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB, result);
  }
  /** Return `point + vectorA * scalarA + vectorB * scalarB + vectorC * scalarC` */
  public plus3Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, vectorC: Point4d, scalarC: number, result?: Point4d): Point4d {
    return Point4d.create(this.xyzw[0] + vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB + vectorC.xyzw[0] * scalarC, this.xyzw[1] + vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB + vectorC.xyzw[1] * scalarC, this.xyzw[2] + vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB + vectorC.xyzw[2] * scalarC, this.xyzw[3] + vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB + vectorC.xyzw[3] * scalarC, result);
  }
  /** Return `point + vectorA * scalarA + vectorB * scalarB` */
  public static createAdd2Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, result?: Point4d): Point4d {
    return Point4d.create(vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB, vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB, vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB, vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB, result);
  }
  /** Return `point + vectorA \ scalarA + vectorB * scalarB + vectorC * scalarC` */
  public static createAdd3Scaled(vectorA: Point4d, scalarA: number, vectorB: Point4d, scalarB: number, vectorC: Point4d, scalarC: number, result?: Point4d): Point4d {
    return Point4d.create(vectorA.xyzw[0] * scalarA + vectorB.xyzw[0] * scalarB + vectorC.xyzw[0] * scalarC, vectorA.xyzw[1] * scalarA + vectorB.xyzw[1] * scalarB + vectorC.xyzw[1] * scalarC, vectorA.xyzw[2] * scalarA + vectorB.xyzw[2] * scalarB + vectorC.xyzw[2] * scalarC, vectorA.xyzw[3] * scalarA + vectorB.xyzw[3] * scalarB + vectorC.xyzw[3] * scalarC, result);
  }
  /** Return dot produt of (4d) vectors from the instance to targetA and targetB */
  public dotVectorsToTargets(targetA: Point4d, targetB: Point4d): number {
    return (targetA.xyzw[0] - this.xyzw[0]) * (targetB.xyzw[0] - this.xyzw[0]) +
      (targetA.xyzw[1] - this.xyzw[1]) * (targetB.xyzw[1] - this.xyzw[1]) +
      (targetA.xyzw[2] - this.xyzw[2]) * (targetB.xyzw[2] - this.xyzw[2]) +
      (targetA.xyzw[3] - this.xyzw[3]) * (targetB.xyzw[3] - this.xyzw[3]);
  }
  /** return (4d) dot product of the instance and other point. */
  public dotProduct(other: Point4d): number {
    return this.xyzw[0] * other.xyzw[0] + this.xyzw[1] * other.xyzw[1] + this.xyzw[2] * other.xyzw[2] + this.xyzw[3] * other.xyzw[3];
  }
  /** return (4d) dot product of the instance with xyzw */
  public dotProductXYZW(x: number, y: number, z: number, w: number): number {
    return this.xyzw[0] * x + this.xyzw[1] * y + this.xyzw[2] * z + this.xyzw[3] * w;
  }
  /** dotProduct with (point.x, point.y, point.z, 1) Used in PlaneAltitudeEvaluator interface */
  public altitude(point: Point3d): number {
    return this.xyzw[0] * point.x + this.xyzw[1] * point.y + this.xyzw[2] * point.z + this.xyzw[3];
  }
  /** dotProduct with (point.x, point.y, point.z, 1) Used in PlaneAltitudeEvaluator interface */
  public weightedAltitude(point: Point4d): number {
    return this.xyzw[0] * point.x + this.xyzw[1] * point.y + this.xyzw[2] * point.z + this.xyzw[3] * point.w;
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
    const a = 1.0 / mag; // in zero case everything multiplies right back to true zero.
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
    const a = mag === 0 ? 0.0 : (1.0 / mag); // in zero case everything multiplies right back to true zero.
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
    const a = mag === 0 ? 0.0 : (1.0 / mag); // in zero case everything multiplies right back to true zero.
    const aa = a * a;
    return Ray3d.createXYZUVW(x * a, y * a, z * a, (dx * w - dw * x) * aa, (dy * w - dw * y) * aa, (dz * w - dw * z) * aa, result);
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
  public static createRealDerivativePlane3dByOriginAndVectorsDefault000(x: number, y: number, z: number, w: number, dx: number, dy: number, dz: number, dw: number, ddx: number, ddy: number, ddz: number, ddw: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const mag = Geometry.correctSmallMetricDistance(w);
    // real point is X/w.
    // real derivative is (X' * w - X *w) / ww, and weight is always 0 by cross products.
    const a = mag === 0 ? 0.0 : (1.0 / mag); // in zero case everything multiplies right back to true zero.
    const aa = a * a;
    const fx = x * a;
    const fy = y * a;
    const fz = z * a;
    const dfx = (dx * w - dw * x) * aa;
    const dfy = (dy * w - dw * y) * aa;
    const dfz = (dz * w - dw * z) * aa;
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(fx, fy, fz, dfx, dfy, dfz, quotientDerivative2(ddx, dw, ddw, fx, dfx, a), quotientDerivative2(ddy, dw, ddw, fy, dfy, a), quotientDerivative2(ddz, dw, ddw, fz, dfz, a), result);
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
