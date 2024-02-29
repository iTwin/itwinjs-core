/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { Geometry, ICloneable } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { CurvePrimitive } from "./CurvePrimitive";

/**
 * An enumeration of special conditions being described by a CurveLocationDetail.
 * @public
 */
export enum CurveIntervalRole {
  /** This point is an isolated point NOT at a primary vertex. */
  isolated = 0,
  /** This point is an isolated vertex hit */
  isolatedAtVertex = 1,
  /** This is the beginning of an interval */
  intervalStart = 10,
  /** This is an interior point of an interval. */
  intervalInterior = 11,
  /** This is the end of an interval */
  intervalEnd = 12,
}

/**
 * Return code for CurvePrimitive method `moveSignedDistanceFromFraction`
 * @public
 */
export enum CurveSearchStatus {
  /** Unimplemented or zero length curve  */
  error,
  /** Complete success of search */
  success = 1,
  /** Search ended prematurely (e.g. at incomplete distance moved) at start or end of curve */
  stoppedAtBoundary = 2,
}

/**
 * Use to update a cloneable object when source and/or prior result are possibly undefined.
 * * Any undefined source returns undefined.
 * * For defined source, reuse optional result if available.
 * @param source optional source
 * @param result optional result
 */
function optionalUpdate<T extends ICloneable<T>>(source: T | undefined, result: T | undefined): T | undefined {
  return source ? source.clone(result) : undefined;
}

/**
 * CurveLocationDetail carries point and parameter data about a point evaluated on a curve.
 * * These are returned by a variety of queries.
 * * Particular contents can vary among the queries.
 * @public
 */
export class CurveLocationDetail {
  /** The curve being evaluated */
  public curve?: CurvePrimitive;
  /** Optional ray */
  public ray?: Ray3d;
  /** The fractional position along the curve */
  public fraction: number;
  /** Detail condition of the role this point has in some context */
  public intervalRole?: CurveIntervalRole;
  /** The point on the curve */
  public point: Point3d;
  /** A vector (e.g. tangent vector) in context */
  public vectorInCurveLocationDetail?: Vector3d;
  /** A context-specific numeric value. (e.g. a distance) */
  public a: number;
  /**
   * Optional CurveLocationDetail with more detail of location. For instance, a detail for fractional position
   * within a CurveChainWithDistanceIndex returns fraction and distance along the chain as its primary data and
   * further detail of the particular curve within the chain in the childDetail.
   */
  public childDetail?: CurveLocationDetail;
  /**
   * A status indicator for certain searches.
   * * e.g. CurvePrimitive.moveSignedDistanceFromFraction
   */
  public curveSearchStatus?: CurveSearchStatus;
  /** (Optional) second fraction, e.g. end of interval of coincident curves */
  public fraction1?: number;
  /** (Optional) second point, e.g. end of interval of coincident curves */
  public point1?: Point3d;
  /** A context-specific additional point */
  public pointQ: Point3d;  // extra point for use in computations
  /** Constructor */
  public constructor() {
    this.pointQ = Point3d.createZero();
    this.fraction = 0;
    this.point = Point3d.createZero();
    this.a = 0.0;
  }
  /** Set the (optional) intervalRole field */
  public setIntervalRole(value: CurveIntervalRole): void {
    this.intervalRole = value;
  }
  /** Set the (optional) fraction1 and point1, using direct assignment (capture!) to point1 */
  public captureFraction1Point1(fraction1: number, point1: Point3d): void {
    this.fraction1 = fraction1;
    this.point1 = point1;
  }
  /** Test if this pair has fraction1 defined */
  public get hasFraction1(): boolean {
    return this.fraction1 !== undefined;
  }
  /** Test if this is an isolated point. This is true if intervalRole is any of (undefined, isolated, isolatedAtVertex) */
  public get isIsolated(): boolean {
    return this.intervalRole === undefined
      || this.intervalRole === CurveIntervalRole.isolated
      || this.intervalRole === CurveIntervalRole.isolatedAtVertex;
  }
  /** Return the fraction delta. (0 if no fraction1) */
  public get fractionDelta(): number {
    return this.fraction1 !== undefined ? this.fraction1 - this.fraction : 0.0;
  }
  /**
   * If (fraction1, point1) are defined, make them the primary (and only) data.
   * * No action if undefined.
   */
  public collapseToEnd() {
    if (this.fraction1 !== undefined)
      this.fraction = this.fraction1;
    if (this.point1)
      this.point = this.point1;
    this.collapseToStart();
  }
  /** Make (fraction, point) the primary (and only) data. */
  public collapseToStart() {
    this.fraction1 = undefined;
    this.point1 = undefined;
  }
  /**
   * Return a complete copy, WITH CAVEATS . . .
   * * curve member is copied as a reference.
   * * point and vector members are cloned.
   */
  public clone(result?: CurveLocationDetail): CurveLocationDetail {
    if (result === this)
      return result;
    result = result ? result : new CurveLocationDetail();
    result.curve = this.curve;
    result.fraction = this.fraction;
    result.fraction1 = this.fraction1;
    result.point1 = optionalUpdate<Point3d>(this.point1, result.point1);
    result.point.setFromPoint3d(this.point);
    result.vectorInCurveLocationDetail = optionalUpdate<Vector3d>(this.vectorInCurveLocationDetail, result.vectorInCurveLocationDetail);
    result.a = this.a;
    result.childDetail = optionalUpdate<CurveLocationDetail>(this.childDetail, result.childDetail);
    result.curveSearchStatus = this.curveSearchStatus;
    return result;
  }
  /**
   * Updated in this instance.
   * * Note that if caller omits `vector` and `a`, those fields are updated to the call-list defaults (NOT left as-is)
   * * point and vector updates are by data copy (not capture of pointers)
   * @param fraction (required) fraction to install
   * @param point  (required) point to install
   * @param vector (optional) vector to install.
   * @param a (optional) numeric value to install.
   */
  public setFP(fraction: number, point: Point3d, vector?: Vector3d, a: number = 0.0): void {
    this.fraction = fraction;
    this.point.setFromPoint3d(point);
    this.vectorInCurveLocationDetail = optionalUpdate<Vector3d>(vector, this.vectorInCurveLocationDetail);
    this.a = a;
  }
  /**
   * Updated in this instance.
   * * Note that if caller omits a`, that field is updated to the call-list default (NOT left as-is)
   * * point and vector updates are by data copy (not capture of the ray members)
   * @param fraction (required) fraction to install
   * @param ray  (required) point and vector to install
   * @param a (optional) numeric value to install.
   */
  public setFR(fraction: number, ray: Ray3d, a: number = 0): void {
    return this.setFP(fraction, ray.origin, ray.direction, a);
  }
  /** Set the CurvePrimitive pointer, leaving all other properties untouched. */
  public setCurve(curve: CurvePrimitive) {
    this.curve = curve;
  }
  /** Record the distance from the CurveLocationDetail's point to the parameter point. */
  public setDistanceTo(point: Point3d) {
    this.a = this.point.distance(point);
  }
  /** Create with a CurvePrimitive pointer but no coordinate data. */
  public static create(curve?: CurvePrimitive, result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    return result;
  }
  /** Create a new detail using CurvePrimitive pointer, fraction, and point coordinates. */
  public static createCurveFractionPoint(
    curve: CurvePrimitive | undefined, fraction: number, point: Point3d, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = 0.0;
    result.childDetail = undefined;
    result.curveSearchStatus = undefined;
    return result;
  }
  /** Create a new detail with only ray, fraction, and point. */
  public static createRayFractionPoint(
    ray: Ray3d, fraction: number, point: Point3d, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.fraction = fraction;
    result.ray = ray;
    result.point.setFromPoint3d(point);
    return result;
  }
  /** Create with CurvePrimitive pointer, fraction, and point coordinates */
  public static createCurveFractionPointDistanceCurveSearchStatus(
    curve: CurvePrimitive | undefined,
    fraction: number,
    point: Point3d,
    distance: number,
    status: CurveSearchStatus,
    result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = distance;
    result.childDetail = undefined;
    result.curveSearchStatus = status;
    return result;
  }
  /** Create with curveSearchStatus affected by allowExtension. */
  public static createConditionalMoveSignedDistance(
    allowExtension: boolean,
    curve: CurvePrimitive,
    startFraction: number,
    endFraction: number,
    requestedSignedDistance: number,
    result?: CurveLocationDetail,
  ): CurveLocationDetail {
    let a = requestedSignedDistance;
    let status = CurveSearchStatus.success;
    if (!allowExtension && !Geometry.isIn01(endFraction)) {
      // cap the movement at the endpoint
      if (endFraction < 0.0) {
        a = - curve.curveLengthBetweenFractions(startFraction, 0.0);
        endFraction = 0.0;
        status = CurveSearchStatus.stoppedAtBoundary;
      } else if (endFraction > 1.0) {
        endFraction = 1.0;
        a = curve.curveLengthBetweenFractions(startFraction, 1.0);
        status = CurveSearchStatus.stoppedAtBoundary;
      }
    }
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = endFraction;
    curve.fractionToPoint(endFraction, result.point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = a;
    result.childDetail = undefined;
    result.curveSearchStatus = status;
    return result;
  }
  /** Create with CurvePrimitive pointer and fraction for evaluation. */
  public static createCurveEvaluatedFraction(
    curve: CurvePrimitive, fraction: number, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    curve.fractionToPoint(fraction, result.point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = 0.0;
    result.childDetail = undefined;
    result.curveSearchStatus = undefined;
    return result;
  }
  /** Create with CurvePrimitive pointer and fraction for evaluation. */
  public static createCurveEvaluatedFractionPointAndDerivative(
    curve: CurvePrimitive, fraction: number, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    const ray = curve.fractionToPointAndDerivative(fraction);
    result.point.setFromPoint3d(ray.origin);
    result.vectorInCurveLocationDetail = ray.direction;
    result.a = 0.0;
    result.childDetail = undefined;
    result.curveSearchStatus = undefined;
    return result;
  }
  /** Create with CurvePrimitive pointer and 2 fractions for evaluation. */
  public static createCurveEvaluatedFractionFraction(
    curve: CurvePrimitive, fraction0: number, fraction1: number, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction0;
    curve.fractionToPoint(fraction0, result.point);
    result.fraction1 = fraction1;
    result.point1 = curve.fractionToPoint(fraction1, result.point1);
    result.vectorInCurveLocationDetail = undefined;
    result.a = 0.0;
    result.childDetail = undefined;
    result.curveSearchStatus = undefined;
    return result;
  }
  /** Create with CurvePrimitive pointer, fraction, and point coordinates. */
  public static createCurveFractionPointDistance(
    curve: CurvePrimitive,
    fraction: number,
    point: Point3d,
    a: number,
    result?: CurveLocationDetail,
  ): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = a;
    result.childDetail = undefined;
    result.curveSearchStatus = undefined;
    return result;
  }
  /**
   * Update or create if closer than current contents.
   * @param curve candidate curve
   * @param fraction candidate fraction
   * @param point candidate point
   * @param a candidate distance
   * @returns true if the given distance is smaller (and hence this detail was updated.)
   */
  public updateIfCloserCurveFractionPointDistance(
    curve: CurvePrimitive, fraction: number, point: Point3d, a: number,
  ): boolean {
    if (this.a < a)
      return false;
    CurveLocationDetail.createCurveFractionPointDistance(curve, fraction, point, a, this);
    return true;
  }
  /**
   * Exchange the (fraction,fraction1) and (point, point1) pairs.
   * * (Skip each swap if its "1" value is undefined)
   */
  public swapFractionsAndPoints(): void {
    if (this.fraction1 !== undefined) {
      const f = this.fraction;
      this.fraction = this.fraction1;
      this.fraction1 = f;
    }
    if (this.point1 !== undefined) {
      const p = this.point;
      this.point = this.point1;
      this.point1 = p;
    }
  }
  /**
   * Return the fraction where f falls between fraction and fraction1.
   * * ASSUME fraction1 defined
   */
  public inverseInterpolateFraction(f: number, defaultFraction: number = 0): number {
    const a = Geometry.inverseInterpolate01(this.fraction, this.fraction1!, f);
    if (a === undefined)
      return defaultFraction;
    return a;
  }
  /**
   * Return the detail with smaller `a` value -- detailA returned if equal.
   * @param detailA first candidate
   * @param detailB second candidate
   */
  public static chooseSmallerA(
    detailA: CurveLocationDetail | undefined, detailB: CurveLocationDetail | undefined,
  ): CurveLocationDetail | undefined {
    if (detailA) {
      if (!detailB)
        return detailA;
      return detailA.a <= detailB.a ? detailA : detailB;
    }
    return detailB;
  }
  /** Compare only the curve and fraction of this detail with `other`. */
  public isSameCurveAndFraction(other: CurveLocationDetail | {curve: CurvePrimitive, fraction: number}): boolean {
    return this.curve === other.curve && Geometry.isAlmostEqualNumber(this.fraction, other.fraction);
  }
}

/**
 * Enumeration of configurations for intersections and min/max distance-between-curve
 * @public
 */
export enum CurveCurveApproachType {
  /** Intersection at a single point */
  Intersection = 0,
  /** Distinct points on the two curves, with each curve's tangent perpendicular to the chord between the points */
  PerpendicularChord = 1,
  /** Completely coincident geometry */
  CoincidentGeometry = 2,
  /** Completely parallel geometry. */
  ParallelGeometry = 3,
}

/**
 * A pair of CurveLocationDetail.
 * @public
 */
export class CurveLocationDetailPair {
  /** The first of the two details. */
  public detailA: CurveLocationDetail;
  /** The second of the two details. */
  public detailB: CurveLocationDetail;
  /**
   * Enumeration of how the detail pairs relate.
   * * This is set only by certain closeApproach calculations.
   */
  public approachType?: CurveCurveApproachType;

  public constructor(detailA?: CurveLocationDetail, detailB?: CurveLocationDetail) {
    this.detailA = detailA ? detailA : new CurveLocationDetail();
    this.detailB = detailB ? detailB : new CurveLocationDetail();
  }
  /** Create a curve detail pair using references to two CurveLocationDetails */
  public static createCapture(
    detailA: CurveLocationDetail, detailB: CurveLocationDetail, result?: CurveLocationDetailPair,
  ): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = detailA;
    result.detailB = detailB;
    return result;
  }
  /**
   * Create a curve detail pair using references to two CurveLocationDetails.
   * * optionally install in reversed positions
   */
  public static createCaptureOptionalReverse(
    detailA: CurveLocationDetail, detailB: CurveLocationDetail, reversed: boolean, result?: CurveLocationDetailPair,
  ): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    if (reversed) {
      result.detailA = detailA;
      result.detailB = detailB;

    } else {
      result.detailA = detailA;
      result.detailB = detailB;
    }
    return result;
  }
  /** Make a deep copy of this CurveLocationDetailPair */
  public clone(result?: CurveLocationDetailPair): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = this.detailA.clone();
    result.detailB = this.detailB.clone();
    result.approachType = this.approachType;
    return result;
  }
  /** Swap the details of A, B */
  public swapDetails() {
    const q = this.detailA;
    this.detailA = this.detailB;
    this.detailB = q;
  }
  /**
   * Mutate the input array by removing the second of two adjacent duplicate pairs.
   * * Ignores details representing coincident intervals (e.g., for which `fraction1` is defined).
   * * Comparison is performed by [[CurveLocationDetail.isSameCurveAndFraction]].
   * * No sorting is performed.
   * @param pairs array to de-duplicate in place
   * @param index0 look for duplicates in the tail of the array starting at index0
   * @return reference to input array
   * @internal
   */
  public static removeAdjacentDuplicates(pairs: CurveLocationDetailPair[], index0: number = 0): CurveLocationDetailPair[] {
    return pairs.flatMap(
      (pair: CurveLocationDetailPair, i: number, arr: CurveLocationDetailPair[]) => {
        if (i >= index0 && i > 0) {
          if (!pair.detailA.hasFraction1 && !pair.detailB.hasFraction1) {
            if (pair.detailA.isSameCurveAndFraction(arr[i - 1].detailA)) {
              if (pair.detailB.isSameCurveAndFraction(arr[i - 1].detailB)) {
                return [];  // remove the i_th pair
              }
            }
          }
        }
        return [pair];  // preserve the i_th pair
      },
    );
  }
}

/**
 * Data bundle for a pair of arrays of CurveLocationDetail structures.
 * @deprecated in 4.x. Use CurveLocationDetailPair[] instead.
 * @public
 */
export class CurveLocationDetailArrayPair {
  /** First array of details. */
  public dataA: CurveLocationDetail[];
  /** Second array of details. */
  public dataB: CurveLocationDetail[];
  public constructor() {
    this.dataA = [];
    this.dataB = [];
  }
}
