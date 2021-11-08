/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { Geometry } from "../Geometry";
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
 * Return code for CurvePrimitive method `moveSignedDistanceFromFraction`
 * @public
 */
export enum CurveSearchStatus {
  /** unimplemented or zero length curve  */
  error,
  /** complete success of search */
  success = 1,
  /** search ended prematurely (e.g. at incomplete distance moved) at start or end of curve */
  stoppedAtBoundary = 2,
}

/**
 * use to update a vector in case where source and prior result are both possibly undefined.
 * * Any undefined source returns undefined.
 * * For defined source, reuse optional result if available.
 * @param source optional source
 * @param result optional result
 */
function optionalVectorUpdate(source: Vector3d | undefined, result: Vector3d | undefined): Vector3d | undefined {
  if (source) {
    return source.clone(result);
  }
  return undefined;
}
/**
 * CurveLocationDetail carries point and paramter data about a point evaluated on a curve.
 * * These are returned by a variety of queries.
 * * Particular contents can vary among the queries.
 * @public
 */
export class CurveLocationDetail {
  /** The curve being evaluated */
  public curve?: CurvePrimitive;
  /** optional ray */
  public ray?: Ray3d;
  /** The fractional position along the curve */
  public fraction: number;
  /** Detail condition of the role this point has in some context */
  public intervalRole?: CurveIntervalRole;
  /** The point on the curve */
  public point: Point3d;
  /** A vector (e.g. tangent vector) in context */
  public vectorInCurveLocationDetail?: Vector3d;
  /** A context-specific numeric value.  (E.g. a distance) */
  public a: number;
  /** optional CurveLocationDetail with more detail of location.  For instance, a detail for fractional position within
   * a CurveChainWithDistanceIndex returns fraction and distance along the chain as its primary data and
   * further detail of the particular curve within the chain in the childDetail.
   */
  public childDetail?: CurveLocationDetail;
  /** A status indicator for certain searches.
   * * e.g. CurvePrimitive.moveSignedDistanceFromFraction
   */
  public curveSearchStatus?: CurveSearchStatus;
  /** (optional) second fraction, e.g. end of interval of coincident curves */
  public fraction1?: number;
  /** (optional) second point, e.g. end of interval of coincident curves */
  public point1?: Point3d;
  /** A context-specific additional point */
  public pointQ: Point3d;  // extra point for use in computations

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

  /** test if this pair has fraction1 defined */
  public get hasFraction1(): boolean {
    return this.fraction1 !== undefined;
  }

  /** test if this is an isolated point. This is true if intervalRole is any of (undefined, isolated, isolatedAtVertex) */
  public get isIsolated(): boolean {
    return this.intervalRole === undefined
      || this.intervalRole === CurveIntervalRole.isolated
      || this.intervalRole === CurveIntervalRole.isolatedAtVertex;
  }

  /** return the fraction delta. (0 if no fraction1) */
  public get fractionDelta(): number {
    return this.fraction1 !== undefined ? this.fraction1 - this.fraction : 0.0;
  }

  /** If (fraction1, point1) are defined, make them the primary (and only) data.
   * * No action if undefined.
   */
  public collapseToEnd() {
    if (this.fraction1 !== undefined) {
      this.fraction = this.fraction1;
      this.fraction1 = undefined;
    }
    if (this.point1) {
      this.point = this.point1;
      this.point1 = undefined;
    }
  }

  /** make (fraction, point) the primary (and only) data.
   * * No action if undefined.
   */
  public collapseToStart() {
    this.fraction1 = undefined;
    this.point1 = undefined;
  }

  /** Return a complete copy, WITH CAVEATS . . .
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
    result.point1 = this.point1;
    result.point.setFromPoint3d(this.point);
    result.vectorInCurveLocationDetail = optionalVectorUpdate(this.vectorInCurveLocationDetail, result.vectorInCurveLocationDetail);
    result.a = this.a;
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
  public setFP(fraction: number, point: Point3d, vector?: Vector3d, a: number = 0.0) {
    this.fraction = fraction;
    this.point.setFrom(point);
    this.vectorInCurveLocationDetail = optionalVectorUpdate(vector, this.vectorInCurveLocationDetail);
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
  public setFR(fraction: number, ray: Ray3d, a: number = 0) {
    return this.setFP(fraction, ray.origin, ray.direction, a);
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
    curve?: CurvePrimitive,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    return result;
  }

  /** create with CurvePrimitive pointer, fraction, and point coordinates.
   */
  public static createCurveFractionPoint(
    curve: CurvePrimitive | undefined,
    fraction: number,
    point: Point3d,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = 0.0;
    result.curveSearchStatus = undefined;
    return result;
  }
  /**
   * Create a new detail with only ray, fraction, and point.
   */
  public static createRayFractionPoint(ray: Ray3d, fraction: number, point: Point3d, result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.fraction = fraction;
    result.ray = ray;
    result.point.setFromPoint3d(point);
    return result;
  }

  /** create with CurvePrimitive pointer, fraction, and point coordinates
   */
  public static createCurveFractionPointDistanceCurveSearchStatus(
    curve: CurvePrimitive | undefined,
    fraction: number,
    point: Point3d,
    distance: number,
    status: CurveSearchStatus,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point.setFromPoint3d(point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = distance;
    result.curveSearchStatus = status;
    return result;
  }
  /** create with curveSearchStatus affected by allowExtension.
   * *
   */
  public static createConditionalMoveSignedDistance(
    allowExtension: boolean,
    curve: CurvePrimitive,
    startFraction: number,
    endFraction: number,
    requestedSignedDistance: number,
    result?: CurveLocationDetail): CurveLocationDetail {
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
    result.point = curve.fractionToPoint(endFraction, result.point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = a;
    result.curveSearchStatus = status;
    return result;
  }

  /** create with CurvePrimitive pointer and fraction for evaluation.
   */
  public static createCurveEvaluatedFraction(
    curve: CurvePrimitive,
    fraction: number,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    result.point = curve.fractionToPoint(fraction);
    result.vectorInCurveLocationDetail = undefined;
    result.curveSearchStatus = undefined;
    result.a = 0.0;
    return result;
  }
  /** create with CurvePrimitive pointer and fraction for evaluation.
   */
  public static createCurveEvaluatedFractionPointAndDerivative(
    curve: CurvePrimitive,
    fraction: number,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction;
    const ray = curve.fractionToPointAndDerivative(fraction);
    result.point = ray.origin;
    result.vectorInCurveLocationDetail = ray.direction;
    result.curveSearchStatus = undefined;
    result.a = 0.0;
    return result;
  }

  /** create with CurvePrimitive pointer and 2 fractions for evaluation.
   */
  public static createCurveEvaluatedFractionFraction(
    curve: CurvePrimitive,
    fraction0: number,
    fraction1: number,
    result?: CurveLocationDetail): CurveLocationDetail {
    result = result ? result : new CurveLocationDetail();
    result.curve = curve;
    result.fraction = fraction0;
    result.point = curve.fractionToPoint(fraction0);
    result.fraction1 = fraction1;
    result.point1 = curve.fractionToPoint(fraction1);
    result.vectorInCurveLocationDetail = undefined;
    result.curveSearchStatus = undefined;
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
    result.vectorInCurveLocationDetail = undefined;
    result.a = a;
    result.curveSearchStatus = undefined;
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
  /**
   * * Exchange the (fraction,fraction1) and (point, point1) pairs.
   * * (Skip each swap if its "1" value is undefined)
   */
  public swapFractionsAndPoints() {
    if (this.fraction1 !== undefined) {
      const f = this.fraction; this.fraction = this.fraction1; this.fraction1 = f;
    }
    if (this.point1 !== undefined) {
      const p = this.point; this.point = this.point1; this.point1 = p;
    }
  }
  /**
   * * return the fraction where f falls between fraction and fraction1.
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
  public static chooseSmallerA(detailA: CurveLocationDetail | undefined, detailB: CurveLocationDetail | undefined): CurveLocationDetail | undefined {
    if (detailA) {
      if (!detailB)
        return detailA;
      return detailA.a <= detailB.a ? detailA : detailB;
    }
    return detailB;
  }
}
/** Enumeration of configurations for intersections and min/max distance-between-curve
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
/** A pair of CurveLocationDetail.
 * @public
 */
export class CurveLocationDetailPair {
  /** The first of the two details ... */
  public detailA: CurveLocationDetail;
  /** The second of the two details ... */
  public detailB: CurveLocationDetail;
  /** enumeration of how the detail pairs relate.
   * * This is set only by certain closeApproach calculations.
   */
  public approachType?: CurveCurveApproachType;

  public constructor(detailA?: CurveLocationDetail, detailB?: CurveLocationDetail) {
    this.detailA = detailA ? detailA : new CurveLocationDetail();
    this.detailB = detailB ? detailB : new CurveLocationDetail();
  }

  /** Create a curve detail pair using references to two CurveLocationDetails */
  public static createCapture(detailA: CurveLocationDetail, detailB: CurveLocationDetail, result?: CurveLocationDetailPair): CurveLocationDetailPair {
    result = result ? result : new CurveLocationDetailPair();
    result.detailA = detailA;
    result.detailB = detailB;
    return result;
  }
  /** Create a curve detail pair using references to two CurveLocationDetails.
   * * optionally install in reversed positions
   */
  public static createCaptureOptionalReverse(detailA: CurveLocationDetail, detailB: CurveLocationDetail,
    reversed: boolean,
    result?: CurveLocationDetailPair): CurveLocationDetailPair {
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
}
