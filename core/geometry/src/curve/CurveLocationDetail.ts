/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { CurvePrimitive } from "./CurvePrimitive";
/**
 * An enumeration of special conditions being described by a CurveLocationDetail.
 */
export enum CurveIntervalRole {
  /** This point is an isolated point NOT at a primary vertex. */
  isolated = 0,
  /**  This point is an isolated vertex hit */
  isolatedAtVertex = 1,
  /** This is the beginning of an interval */
  intervalStart = 10,
  /** This is an interior point of an interval. */
  intervalInterior = 11,
  /** This is the end of an interval */
  intervalEnd = 12,
}
/**
 * CurveLocationDetail carries point and paramter data about a point evaluated on a curve.
 */
export class CurveLocationDetail {
  /** The curve being evaluated */
  public curve?: CurvePrimitive;
  /** The fractional position along the curve */
  public fraction: number;
  /** Deail condition of the role this point has in some context */
  public intervalRole?: CurveIntervalRole;
  /** The point on the curve */
  public point: Point3d;
  /** A vector (e.g. tangent vector) in context */
  public vector: Vector3d;
  /** A context-specific numeric value.  (E.g. a distance) */
  public a: number;
  /** A context-specific addtional point */
  public pointQ: Point3d;  // extra point for use in computations

  public constructor() {
    this.pointQ = Point3d.createZero();
    this.fraction = 0;
    this.point = Point3d.createZero();
    this.vector = Vector3d.unitX();
    this.a = 0.0;
  }
  /** Set the (optional) intervalRole field */
  public setIntervalRole(value: CurveIntervalRole): void {
    this.intervalRole = value;
  }
  /** test if this is an isolated point. This is true if intervalRole is any of (undefined, isolated, isolatedAtVertex) */
  public get isIsolated(): boolean {
    return this.intervalRole === undefined
      || this.intervalRole === CurveIntervalRole.isolated
      || this.intervalRole === CurveIntervalRole.isolatedAtVertex;
  }
  /** @returns Return a complete copy */
  public clone(result?: CurveLocationDetail): CurveLocationDetail {
    if (result === this)
      return result;
    result = result ? result : new CurveLocationDetail();
    result.curve = this.curve;
    result.fraction = this.fraction;
    result.point = this.point;
    result.vector = this.vector;
    result.a = this.a;
    return result;
  }

  // Set the fraction, point, with optional vector and number.
  // (curve is unchanged)
  public setFP(fraction: number, point: Point3d, vector?: Vector3d, a?: number) {
    this.fraction = fraction;
    this.point.setFrom(point);
    if (vector)
      this.vector.setFrom(vector);
    else
      this.vector.set(0, 0, 0);
    this.a = a ? a : 0;
  }

  // Set the fraction, point, and vector
  public setFR(fraction: number, ray: Ray3d, a?: number) {
    this.fraction = fraction;
    this.point.setFrom(ray.origin);
    this.vector.setFrom(ray.direction);
    this.a = a ? a : 0;
  }
  /** Set the CurvePrimitive pointer, leaving all other properties untouched.
   */
  public setCurve(curve: CurvePrimitive) { this.curve = curve; }

  /** record the distance from the CurveLocationDetail's point to the parameter point. */
  public setDistanceTo(point: Point3d) {
    this.a = this.point.distance(point);
  }

  /** create with a CurvePrimitive pointer but no coordinate data.
   */
  public static create(
    curve: CurvePrimitive,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    return result;
  }

  /** create with CurvePrimitive pointer, fraction, and point coordinates.
   */
  public static createCurveFractionPoint(
    curve: CurvePrimitive,
    fraction: number,
    point: Point3d,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vector.set(0, 0, 0);
    result.a = 0.0;
    return result;
  }

  /** create with CurvePrimitive pointer, fraction, and point coordinates.
   */
  public static createCurveFractionPointDistance(
    curve: CurvePrimitive,
    fraction: number,
    point: Point3d,
    a: number,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vector.set(0, 0, 0);
    result.a = a;
    return result;
  }

  /** update or create if closer than current contents.
   * @param curve candidate curve
   * @param fraction candidate fraction
   * @param point candidate point
   * @param a candidate distance
   * @returns true if the given distance is smaller (and hence this detail was updated.)
   */
  public updateIfCloserCurveFractionPointDistance(
    curve: CurvePrimitive,
    fraction: number,
    point: Point3d,
    a: number): boolean {
    if (this.a < a)
      return false;
    CurveLocationDetail.createCurveFractionPointDistance(curve, fraction, point, a, this);
    return true;
  }

}
/** A pair of CurveLocationDetail. */
export class CurveLocationDetailPair {
  public detailA: CurveLocationDetail;
  public detailB: CurveLocationDetail;

  public constructor() {
    this.detailA = new CurveLocationDetail();
    this.detailB = new CurveLocationDetail();
  }

  /** Create a curve detail pair using references to two CurveLocationDetails */
  public static createDetailRef(detailA: CurveLocationDetail, detailB: CurveLocationDetail, result?: CurveLocationDetailPair): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = detailA;
    result.detailB = detailB;
    return result;
  }

  /** Make a deep copy of this CurveLocationDetailPair */
  public clone(result?: CurveLocationDetailPair): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = this.detailA.clone();
    result.detailB = this.detailB.clone();
    return result;
  }
}
