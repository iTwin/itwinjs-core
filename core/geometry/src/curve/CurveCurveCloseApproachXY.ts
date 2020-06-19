/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { BezierCurve3dH } from "../bspline/BezierCurve3dH";
import { BezierCurveBase } from "../bspline/BezierCurveBase";
import { BSplineCurve3d, BSplineCurve3dBase } from "../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";
import { Geometry } from "../Geometry";
import { CoincidentGeometryQuery } from "../geometry3d/CoincidentGeometryOps";
import { NullGeometryHandler } from "../geometry3d/GeometryHandler";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { XYAndZ } from "../geometry3d/XYZProps";
import { Point4d } from "../geometry4d/Point4d";
import { UnivariateBezier } from "../numerics/BezierPolynomials";
import { Newton2dUnboundedWithDerivative } from "../numerics/Newton";
import { AnalyticRoots, SmallSystem, TrigPolynomial } from "../numerics/Polynomials";
import { Arc3d } from "./Arc3d";
import { CurveIntervalRole, CurveLocationDetail, CurveLocationDetailPair } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
import { BezierBezierIntersectionXYRRToRRD } from "./CurveCurveIntersectXY";

// cspell:word XYRR

/**
 * * Instances are initialized and called from CurveCurve.
 * * Constructor is told two geometry items A and B
 *   * geometryB is saved for later reference
 *   * type-specific handler methods will "see" geometry A repeatedly.
 *   * Hence geometryA is NOT saved by the constructor.
 * @internal
 */
export class CurveCurveCloseApproachXY extends NullGeometryHandler {
  // private geometryA: GeometryQuery;  // nb never used -- passed through handlers.
  private _geometryB: GeometryQuery | undefined;
  /** approach larger than this is not interesting.
   * This is caller defined and can be undefined.
   */
  private _maxDistanceToAccept: number | undefined;
  /** Squared max distance.  This is private, and is forced to at least small metric distance squared */
  private _maxDistanceSquared: number;
  private _results!: CurveLocationDetailPair[];
  private _coincidentGeometryContext: CoincidentGeometryQuery;
  private reinitialize() {
    this._results = [];
  }

  /**
   * @param worldToLocal optional (simple linear -- not perspective) transform to project to xy plane for intersection.
   * @param _geometryA first curve for intersection.  This is NOT saved.
   * @param geometryB second curve for intersection.  Saved for reference by specific handler methods.
   */
  public constructor(_geometryA: GeometryQuery | undefined, geometryB: GeometryQuery | undefined) {
    super();
    // this.geometryA = _geometryA;
    this._geometryB = geometryB;
    this._maxDistanceSquared = Geometry.smallMetricDistanceSquared;
    this._coincidentGeometryContext = CoincidentGeometryQuery.create();
    this.reinitialize();
  }
  /** Access the (possibly undefined) max distance to accept. */
  public set maxDistanceToAccept(value: number | undefined) {
    this._maxDistanceToAccept = value;
    if (this._maxDistanceToAccept !== undefined && this._maxDistanceToAccept > 0)
      this._maxDistanceSquared = this._maxDistanceToAccept * this._maxDistanceToAccept;
  }
  /** Set the (possibly undefined) max distance to accept. */
  public get maxDistanceToAccept(): number | undefined { return this._maxDistanceToAccept; }
  /** Ask if the maxDistanceToAccept value is defined and positive */
  public get isMaxDistanceSet(): boolean { return this._maxDistanceToAccept !== undefined && this._maxDistanceToAccept > 0; }
  /** Reset the geometry and flags, leaving all other parts unchanged (and preserving accumulated intersections) */
  public resetGeometry(_geometryA: GeometryQuery, geometryB: GeometryQuery) {
    this._geometryB = geometryB;
  }

  private acceptFraction(fraction: number, fractionTol: number = 1.0e-12) {
    if (fraction < -fractionTol)
      return false;
    if (fraction > 1.0 + fractionTol)
      return false;
    return true;
  }
  /**
   * * Return the results structure for the intersection calculation, structured as an array of CurveLocationDetailPair
   * @param reinitialize if true, a new results structure is created for use by later calls.
   *
   */
  public grabPairedResults(reinitialize: boolean = false): CurveLocationDetailPair[] {
    const result = this._results;
    if (reinitialize)
      this.reinitialize();
    return result;
  }
  private sameCurveAndFraction(cp: CurvePrimitive, fraction: number, detail: CurveLocationDetail): boolean {
    return cp === detail.curve && Geometry.isAlmostEqualNumber(fraction, detail.fraction);
  }
  private testAndRecordPointPairApproach(cpA: CurvePrimitive, fA: number, pointA: Point3d,
    cpB: CurvePrimitive, fB: number, pointB: Point3d, reversed: boolean) {
    const d2 = pointA.distanceSquaredXY(pointB);
    if (d2 < this._maxDistanceSquared) {
      const detailA = CurveLocationDetail.createCurveFractionPoint(cpA, fA, pointA);
      const detailB = CurveLocationDetail.createCurveFractionPoint(cpB, fB, pointB);
      const pair = CurveLocationDetailPair.createCapture(detailA, detailB);
      if (reversed)
        pair.swapDetails();
      this._results.push(pair);
    }
  }
  /** compute intersection of two line segments.
   * filter by extension rules.
   * record with fraction mapping.
   */
  private recordPointWithLocalFractions(
    localFractionA: number,
    cpA: CurvePrimitive,
    fractionA0: number,
    fractionA1: number,
    localFractionB: number,   // Computed intersection fraction
    cpB: CurvePrimitive,
    fractionB0: number,
    fractionB1: number,
    reversed: boolean,
    intervalDetails?: undefined | CurveLocationDetailPair) {
    let globalFractionA, globalFractionB;
    let globalFractionA1, globalFractionB1;
    const isInterval = intervalDetails !== undefined && intervalDetails.detailA.hasFraction1 && intervalDetails.detailB.hasFraction1;
    if (isInterval) {
      globalFractionA = Geometry.interpolate(fractionA0, intervalDetails!.detailA.fraction, fractionA1);
      globalFractionB = Geometry.interpolate(fractionB0, intervalDetails!.detailB.fraction, fractionB1);
      globalFractionA1 = Geometry.interpolate(fractionA0, intervalDetails!.detailA.fraction1!, fractionA1);
      globalFractionB1 = Geometry.interpolate(fractionB0, intervalDetails!.detailB.fraction1!, fractionB1);
    } else {
      globalFractionA = globalFractionA1 = Geometry.interpolate(fractionA0, localFractionA, fractionA1);
      globalFractionB = globalFractionB1 = Geometry.interpolate(fractionB0, localFractionB, fractionB1);

    }
    // ignore duplicate of most recent point .  ..
    const numPrevious = this._results.length;
    if (numPrevious > 0 && !isInterval) {
      const oldDetailA = this._results[numPrevious - 1].detailA;
      const oldDetailB = this._results[numPrevious - 1].detailB;
      if (reversed) {
        if (this.sameCurveAndFraction(cpA, globalFractionA, oldDetailB) && this.sameCurveAndFraction(cpB, globalFractionB, oldDetailA))
          return;
      } else {
        if (this.sameCurveAndFraction(cpA, globalFractionA, oldDetailA) && this.sameCurveAndFraction(cpB, globalFractionB, oldDetailB))
          return;
      }
    }
    const detailA = CurveLocationDetail.createCurveFractionPoint(cpA,
      globalFractionA, cpA.fractionToPoint(globalFractionA));
    const detailB = CurveLocationDetail.createCurveFractionPoint(cpB,
      globalFractionB, cpB.fractionToPoint(globalFractionB));

    if (isInterval) {
      detailA.captureFraction1Point1(globalFractionA1, cpA.fractionToPoint(globalFractionA1));
      detailB.captureFraction1Point1(globalFractionB1, cpB.fractionToPoint(globalFractionB1));
    } else {
      detailA.setIntervalRole(CurveIntervalRole.isolated);
      detailB.setIntervalRole(CurveIntervalRole.isolated);
    }
    if (reversed) {
      this._results.push(new CurveLocationDetailPair(detailB, detailA));
    } else {
      this._results.push(new CurveLocationDetailPair(detailA, detailB));
    }
  }
  /**
   * capture a close approach pair that has point and local fraction but not curve.
   * record with fraction mapping.
   */
  private capturePairWithLocalFractions(
    pair: CurveLocationDetailPair,
    cpA: CurvePrimitive,
    fractionA0: number,
    fractionA1: number,
    cpB: CurvePrimitive,
    fractionB0: number,
    fractionB1: number,
    reversed: boolean) {
    const globalFractionA = Geometry.interpolate(fractionA0, pair.detailA.fraction, fractionA1);
    const globalFractionB = Geometry.interpolate(fractionB0, pair.detailB.fraction, fractionB1);
    // ignore duplicate of most recent point .  ..
    const numPrevious = this._results.length;
    if (numPrevious > 0) {
      const oldDetailA = this._results[numPrevious - 1].detailA;
      const oldDetailB = this._results[numPrevious - 1].detailB;
      if (reversed) {
        if (this.sameCurveAndFraction(cpA, globalFractionA, oldDetailB) && this.sameCurveAndFraction(cpB, globalFractionB, oldDetailA))
          return;
      } else {
        if (this.sameCurveAndFraction(cpA, globalFractionA, oldDetailA) && this.sameCurveAndFraction(cpB, globalFractionB, oldDetailB))
          return;
      }
    }
    pair.detailA.setIntervalRole(CurveIntervalRole.isolated);
    pair.detailB.setIntervalRole(CurveIntervalRole.isolated);

    if (reversed) {
      this._results.push(pair);
    } else {
      pair.swapDetails();
      this._results.push(pair);
    }
  }

  /**
   * emit recordPoint for multiple pairs (on full curve!)
   * @param cpA first curve primitive.   (possibly different from curve in detailA, but fraction compatible)
   * @param cpB second curve primitive.   (possibly different from curve in detailA, but fraction compatible)
   * @param pairs array of pairs
   * @param reversed true to have order reversed in final structures.
   */
  public recordPairs(cpA: CurvePrimitive, cpB: CurvePrimitive,
    pairs: CurveLocationDetailPair[] | undefined, reversed: boolean) {
    if (pairs !== undefined) {
      for (const p of pairs) {
        this.recordPointWithLocalFractions(p.detailA.fraction, cpA, 0, 1,
          p.detailB.fraction, cpB, 0, 1, reversed, p);
      }
    }
  }
  /**
   *
   * @param fractionA
   * @param pointA
   * @param pointB0
   * @param pointB1
   * @param fractionB
   * @param minDistanceSquared
   * @param closestApproach
   */
  private static updatePointToSegmentDistance(fractionA: number, pointA: Point3d, pointB0: Point3d, pointB1: Point3d, fractionB: number, minDistanceSquared: number, closestApproach?: CurveLocationDetailPair): CurveLocationDetailPair | undefined {
    if (fractionB < 0)
      fractionB = 0;
    else if (fractionB > 1)
      fractionB = 1;
    this._workPointB0 = pointB0.interpolate(fractionB, pointB1, this._workPointB0);
    const distanceSquared = this._workPointB0.distanceSquaredXY(pointA);
    if (distanceSquared < minDistanceSquared) {
      if (closestApproach === undefined || distanceSquared < closestApproach.detailA.a) {
        if (closestApproach === undefined)
          closestApproach = CurveLocationDetailPair.createCapture(CurveLocationDetail.create(), CurveLocationDetail.create());
        closestApproach.detailA.setFP(fractionA, pointA);
        closestApproach.detailA.a = distanceSquared;
        closestApproach.detailB.setFP(fractionB, this._workPointB0);
        closestApproach.detailA.a = distanceSquared;
      }
    }
    return closestApproach;
  }
  /**
   * Return fractions of close approach within minDistance between two line segments( a0,a1) and (b0, b1)
   * * minDistance is assumed positive
   * Return the fractional (not xy) coordinates in result.x, result.y
   * @param a0 start point of line a
   * @param a1  end point of line a
   * @param b0  start point of line b
   * @param b1 end point of line b
   * @param result point to receive fractional coordinates of intersection.   result.x is fraction on line a. result.y is fraction on line b.
   */
  private static segmentSegmentBoundedApproach(a0: Point3d, a1: Point3d, b0: Point3d, b1: Point3d, minDistanceSquared: number): CurveLocationDetailPair | undefined {
    const ux = a1.x - a0.x;
    const uy = a1.y - a0.y;

    const vx = b1.x - b0.x;
    const vy = b1.y - b0.y;
    const e00x = b0.x - a0.x;
    const e00y = b0.y - a0.y;

    const e01x = b1.x - a0.x;
    const e01y = b1.y - a0.y;

    const e10x = b0.x - a1.x;
    const e10y = b0.y - a1.y;

    const e11x = b1.x - a1.x;
    const e11y = b1.y - a1.y;
    const hab0 = Geometry.crossProductXYXY(ux, uy, e00x, e00y);
    const hab1 = Geometry.crossProductXYXY(ux, uy, e01x, e01y);
    const hba0 = -Geometry.crossProductXYXY(vx, vy, e00x, e00y);
    const hba1 = -Geometry.crossProductXYXY(vx, vy, e11x, e11y);

    if (hab0 * hab1 < 0.0 && hba0 * hba1 < 0.0) {
      // true intersection, strictly within both segments !!!
      const fractionA = -hba0 / (hba1 - hba0);
      const fractionB = -hab0 / (hab1 - hab0);
      return CurveLocationDetailPair.createCapture(CurveLocationDetail.createCurveFractionPoint(undefined, fractionA, a0.interpolate(fractionA, a1)),
        CurveLocationDetail.createCurveFractionPoint(undefined, fractionB, b0.interpolate(fractionB, b1)));
    }
    let closestApproach: CurveLocationDetailPair | undefined;
    const uu = Geometry.hypotenuseSquaredXY(ux, uy);
    if (hab0 * hab0 < minDistanceSquared * uu)
      closestApproach = this.updatePointToSegmentDistance(0, b0, a0, a1, Geometry.dotProductXYXY(ux, uy, e00x, e00y) / uu, minDistanceSquared, closestApproach);
    if (hab1 * hab1 < minDistanceSquared * uu)
      closestApproach = this.updatePointToSegmentDistance(1, b1, a0, a1, Geometry.dotProductXYXY(ux, uy, e01x, e01y) / uu, minDistanceSquared, closestApproach);

    const vv = Geometry.hypotenuseSquaredXY(vx, vy);
    if (hba0 * hba0 < minDistanceSquared * vv)
      closestApproach = this.updatePointToSegmentDistance(0, a0, b0, b1, -Geometry.dotProductXYXY(vx, vy, e00x, e00y) / vv, minDistanceSquared, closestApproach);
    if (hba1 * hba1 < minDistanceSquared * vv)
      closestApproach = this.updatePointToSegmentDistance(1, a1, b0, b1, -Geometry.dotProductXYXY(vx, vy, e10x, e10y) / vv, minDistanceSquared, closestApproach);
    return closestApproach;
  }
  /**
   * Return fractions of close approach within minDistance between two line segments( a0,a1) and (b0, b1)
   * * minDistance is assumed positive
   * Return the fractional (not xy) coordinates in result.x, result.y
   * @param a0 start point of line a
   * @param a1  end point of line a
   * @param b0  start point of line b
   * @param b1 end point of line b
   * @param result point to receive fractional coordinates of intersection.   result.x is fraction on line a. result.y is fraction on line b.
   */
  private testAndRecordFractionalPairApproach(cpA: CurvePrimitive, fA0: number, fA1: number,
    cpB: CurvePrimitive, fB0: number, fB1: number, testProjections: boolean, reversed: boolean) {
    const pointA0 = cpA.fractionToPoint(fA0);
    const pointA1 = cpA.fractionToPoint(fA1);
    const pointB0 = cpB.fractionToPoint(fB0);
    const pointB1 = cpB.fractionToPoint(fB1);
    this.testAndRecordPointPairApproach(cpA, fA0, pointA0, cpB, fB0, pointB0, reversed);
    this.testAndRecordPointPairApproach(cpA, fA1, pointA1, cpB, fB0, pointB0, reversed);
    this.testAndRecordPointPairApproach(cpA, fA0, pointA0, cpB, fB1, pointB1, reversed);
    this.testAndRecordPointPairApproach(cpA, fA1, pointA1, cpB, fB1, pointB1, reversed);
    if (testProjections) {
      this.testAndRecordProjection(cpA, fA0, pointA0, cpB, fB0, fB1, reversed);
      this.testAndRecordProjection(cpA, fA1, pointA1, cpB, fB0, fB1, reversed);
      this.testAndRecordProjection(cpB, fB0, pointB0, cpA, fA0, fA1, !reversed);
      this.testAndRecordProjection(cpB, fB1, pointB1, cpA, fA0, fA1, !reversed);
    }
  }

  private testAndRecordProjection(cpA: CurvePrimitive, fA: number, pointA: Point3d,
    cpB: CurvePrimitive, fB0: number, fB1: number, reversed: boolean) {
    // NO NO NO -- this is 3D closest point --- need 2d !!
    const detail = cpB.closestPoint(pointA, false);
    if (detail) {
      const fB = Geometry.restrictToInterval(detail.fraction, fB0, fB1);
      if (fB === detail.fraction) {
        this.testAndRecordPointPairApproach(cpA, fA, pointA, cpB, detail.fraction, detail.point, reversed);
      }
    }
  }
  /** compute intersection of two line segments.
   * filter by extension rules.
   * record with fraction mapping.
   * * The fraction mappings allow portions of a linestring to be passed here.
   */
  private computeSegmentSegment3D(
    cpA: CurvePrimitive,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    cpB: CurvePrimitive,
    pointB0: Point3d,
    fractionB0: number,
    pointB1: Point3d,
    fractionB1: number,
    reversed: boolean,
  ) {
    const approach = CurveCurveCloseApproachXY.segmentSegmentBoundedApproach(pointA0, pointA1, pointB0, pointB1, this._maxDistanceSquared);
    if (approach)
      this.capturePairWithLocalFractions(approach, cpA, fractionA0, fractionA1, cpB, fractionB0, fractionB1, reversed);
  }

  // Caller accesses data from a line segment and passes to here.
  // (The line segment in question might be (a) a full line segment or (b) a fragment within a linestring.  The fraction and extend parameters
  // allow all combinations to be passed in)
  // This method applies transform.
  private dispatchSegmentSegment(
    cpA: CurvePrimitive,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    cpB: CurvePrimitive,
    pointB0: Point3d,
    fractionB0: number,
    pointB1: Point3d,
    fractionB1: number,
    reversed: boolean,
  ) {
    this.computeSegmentSegment3D(
      cpA, pointA0, fractionA0, pointA1, fractionA1,
      cpB, pointB0, fractionB0, pointB1, fractionB1,
      reversed);
  }

  // Caller accesses data from a linestring or segment and passes it here.
  // (The line segment in question might be (a) a full line segment or (b) a fragment within a linestring.  The fraction and extend parameters
  // allow all combinations to be passed in)
  private dispatchSegmentArc(
    cpA: CurvePrimitive,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    arc: Arc3d,
    reversed: boolean,
  ) {
    this.testAndRecordFractionalPairApproach(cpA, 0, 1, arc, 0, 1, true, reversed);
    // Arc: X = C + cU + sV
    // Line:  contains points A0,A1
    // Arc point colinear with line if det (A0, A1, X) = 0
    // with homogeneous xyw points and vectors.
    // With equational X:   det (A0, A1, C) + c det (A0, A1,U) + s det (A0, A1, V) = 0.
    // solve for theta.
    // evaluate points.
    // project back to line.

    const data = arc.toTransformedVectors();
    const pointA0Local = pointA0;
    const pointA1Local = pointA1;
    const alpha = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.center, 1);
    const beta = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector0, 0);
    const gamma = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector90, 0);
    const cosines = new GrowableFloat64Array(2);
    const sines = new GrowableFloat64Array(2);
    const radians = new GrowableFloat64Array(2);
    const numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians);
    for (let i = 0; i < numRoots; i++) {
      const arcPoint = data.center.plus2Scaled(data.vector0, cosines.atUncheckedIndex(i), data.vector90, sines.atUncheckedIndex(i));
      const arcFraction = data.sweep.radiansToSignedPeriodicFraction(radians.atUncheckedIndex(i));
      const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(pointA0Local, pointA1Local, arcPoint);
      if (lineFraction !== undefined && this.acceptFraction(lineFraction) && this.acceptFraction(arcFraction)) {
        this.recordPointWithLocalFractions(lineFraction, cpA, fractionA0, fractionA1,
          arcFraction, arc, 0, 1, reversed);
      }
    }
  }

  // Caller accesses data from two arcs.
  // each matrix has [U V C] in (x,y,w) form from projection.
  // invert the projection matrix matrixA.
  // apply the inverse to matrixB. Then arc b is an ellipse in the circular space of A

  private dispatchArcArcThisOrder(
    cpA: Arc3d,
    matrixA: Matrix3d,  // homogeneous xyw projection !!!
    cpB: Arc3d,
    matrixB: Matrix3d,  // homogeneous xyw projection !!!
    reversed: boolean,
  ) {
    const inverseA = matrixA.inverse();
    if (inverseA) {
      const localB = inverseA.multiplyMatrixMatrix(matrixB);
      const ellipseRadians: number[] = [];
      const circleRadians: number[] = [];
      TrigPolynomial.solveUnitCircleHomogeneousEllipseIntersection(
        localB.coffs[2], localB.coffs[5], localB.coffs[8],  // center xyw
        localB.coffs[0], localB.coffs[3], localB.coffs[6],  // center xyw
        localB.coffs[1], localB.coffs[4], localB.coffs[7],  // center xyw
        ellipseRadians, circleRadians);
      for (let i = 0; i < ellipseRadians.length; i++) {
        const fractionA = cpA.sweep.radiansToSignedPeriodicFraction(circleRadians[i]);
        const fractionB = cpB.sweep.radiansToSignedPeriodicFraction(ellipseRadians[i]);
        // hm .. do we really need to check the fractions?  We know they are internal to the beziers
        if (this.acceptFraction(fractionA) && this.acceptFraction(fractionB)) {
          this.recordPointWithLocalFractions(fractionA, cpA, 0, 1,
            fractionB, cpB, 0, 1, reversed);
        }
      }
    }
  }
  // Caller accesses data from two arcs.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion"
  // Solves the arc-arc equations
  private dispatchArcArc(
    cpA: Arc3d,
    cpB: Arc3d,
    reversed: boolean,
  ) {
    // Arc: X = C + cU + sV
    // Line:  contains points A0,A1
    // Arc point colinear with line if det (A0, A1, X) = 0
    // with homogeneous xyw points and vectors.
    // With equational X:   det (A0, A1, C) + c det (A0, A1,U) + s det (A0, A1, V) = 0.
    // solve for theta.
    // evaluate points.
    // project back to line.
    let matrixA: Matrix3d;
    let matrixB: Matrix3d;
    const dataA = cpA.toTransformedVectors();
    const dataB = cpB.toTransformedVectors();
    matrixA = Matrix3d.createColumnsXYW(dataA.vector0, 0, dataA.vector90, 0, dataA.center, 1);
    matrixB = Matrix3d.createColumnsXYW(dataB.vector0, 0, dataB.vector90, 0, dataB.center, 1);
    const conditionA = matrixA.conditionNumber();
    const conditionB = matrixB.conditionNumber();
    if (conditionA > conditionB)
      this.dispatchArcArcThisOrder(cpA, matrixA, cpB, matrixB, reversed);
    else
      this.dispatchArcArcThisOrder(cpB, matrixB, cpA, matrixA, !reversed);

    if (!this._coincidentGeometryContext) {

    } else {
      const pairs = this._coincidentGeometryContext.coincidentArcIntersectionXY(cpA, cpB, true);
      if (pairs !== undefined)
        this.recordPairs(cpA, cpB, pairs, reversed);
    }
  }
  // Caller accesses data from two arcs.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion"
  // Solves the arc-arc equations
  private dispatchArcBsplineCurve3d(
    cpA: Arc3d,
    cpB: BSplineCurve3d,
    reversed: boolean,
  ) {
    // Arc: X = C + cU + sV
    // implicitize the arc as viewed.  This "3d" matrix is homogeneous "XYW" not "xyz"
    let matrixA: Matrix3d;
    const dataA = cpA.toTransformedVectors();
    matrixA = Matrix3d.createColumnsXYW(dataA.vector0, 0, dataA.vector90, 0, dataA.center, 1);
    // The worldToLocal has moved the arc vectors into screen space.
    // matrixA captures the xyw parts (ignoring z)
    // for any point in world space,
    // THIS CODE ONLY WORKS FOR
    const matrixAInverse = matrixA.inverse();
    if (matrixAInverse) {
      const orderF = cpB.order; // order of the beziers for simple coordinates
      const orderG = 2 * orderF - 1;  // order of the (single) bezier for squared coordinates.
      const coffF = new Float64Array(orderF);
      const univariateBezierG = new UnivariateBezier(orderG);
      const axx = matrixAInverse.at(0, 0); const axy = matrixAInverse.at(0, 1); const axz = 0.0; const axw = matrixAInverse.at(0, 2);
      const ayx = matrixAInverse.at(1, 0); const ayy = matrixAInverse.at(1, 1); const ayz = 0.0; const ayw = matrixAInverse.at(1, 2);
      const awx = matrixAInverse.at(2, 0); const awy = matrixAInverse.at(2, 1); const awz = 0.0; const aww = matrixAInverse.at(2, 2);

      if (matrixAInverse) {
        let bezier: BezierCurve3dH | undefined;
        for (let spanIndex = 0; ; spanIndex++) {
          bezier = cpB.getSaturatedBezierSpan3dH(spanIndex, bezier);
          if (!bezier) break;
          univariateBezierG.zero();
          bezier.poleProductsXYZW(coffF, axx, axy, axz, axw);
          univariateBezierG.addSquaredSquaredBezier(coffF, 1.0);
          bezier.poleProductsXYZW(coffF, ayx, ayy, ayz, ayw);
          univariateBezierG.addSquaredSquaredBezier(coffF, 1.0);
          bezier.poleProductsXYZW(coffF, awx, awy, awz, aww);
          univariateBezierG.addSquaredSquaredBezier(coffF, -1.0);
          const roots = univariateBezierG.roots(0.0, true);
          if (roots) {
            for (const root of roots) {
              const fractionB = bezier.fractionToParentFraction(root);
              // The univariate bezier (which has been transformed by the view transform) evaluates into xyw space
              const bcurvePoint4d = bezier.fractionToPoint4d(root);
              const c = bcurvePoint4d.dotProductXYZW(axx, axy, axz, axw);
              const s = bcurvePoint4d.dotProductXYZW(ayx, ayy, ayz, ayw);
              const arcFraction = cpA.sweep.radiansToSignedPeriodicFraction(Math.atan2(s, c));
              if (this.acceptFraction(arcFraction) && this.acceptFraction(fractionB)) {
                this.recordPointWithLocalFractions(arcFraction, cpA, 0, 1,
                  fractionB, cpB, 0, 1, reversed);
              }
            }
          }
        }
      }
    }
  }

  private getRanges(beziers: BezierCurveBase[]): Range3d[] {
    const ranges: Range3d[] = [];
    ranges.length = 0;
    for (const b of beziers) {
      ranges.push(b.range());
    }
    return ranges;
  }
  private _xyzwA0?: Point4d;
  private _xyzwA1?: Point4d;
  private _xyzwPlane?: Point4d;
  private _xyzwB?: Point4d;

  private dispatchBezierBezierStrokeFirst(
    bezierA: BezierCurve3dH,
    bcurveA: BSplineCurve3dBase,
    strokeCountA: number,
    bezierB: BezierCurve3dH,
    bcurveB: BSplineCurve3dBase,
    _strokeCountB: number,
    univariateBezierB: UnivariateBezier,  // caller-allocated for univariate coefficients.
    reversed: boolean) {
    if (!this._xyzwA0) this._xyzwA0 = Point4d.create();
    if (!this._xyzwA1) this._xyzwA1 = Point4d.create();
    if (!this._xyzwPlane) this._xyzwPlane = Point4d.create();
    if (!this._xyzwB) this._xyzwB = Point4d.create();
    /*

              const roots = univariateBezierG.roots(0.0, true);
              if (roots) {
                for (const root of roots) {
                  const fractionB = bezier.fractionToParentFraction(root);
                  // The univariate bezier (which has been transformed by the view transform) evaluates into xyw space
                  const bcurvePoint4d = bezier.fractionToPoint4d(root);
                  const c = bcurvePoint4d.dotProductXYZW(axx, axy, axz, axw);
                  const s = bcurvePoint4d.dotProductXYZW(ayx, ayy, ayz, ayw);
                  const arcFraction = cpA.sweep.radiansToSignedPeriodicFraction(Math.atan2(s, c));
                  if (this.acceptFraction(extendA, arcFraction, extendA) && this.acceptFraction(extendB, fractionB, extendB)) {
                    this.recordPointWithLocalFractions(arcFraction, cpA, 0, 1,
                      fractionB, cpB, 0, 1, reversed);
                  }
                }
    */
    bezierA.fractionToPoint4d(0.0, this._xyzwA0);
    let f0 = 0.0;
    let f1;
    const intervalTolerance = 1.0e-5;
    const df = 1.0 / strokeCountA;
    for (let i = 1; i <= strokeCountA; i++, f0 = f1, this._xyzwA0.setFrom(this._xyzwA1)) {
      f1 = i * df;
      bezierA.fractionToPoint4d(f1, this._xyzwA1);
      Point4d.createPlanePointPointZ(this._xyzwA0, this._xyzwA1, this._xyzwPlane);
      bezierB.poleProductsXYZW(univariateBezierB.coffs, this._xyzwPlane.x, this._xyzwPlane.y, this._xyzwPlane.z, this._xyzwPlane.w);
      let errors = 0;
      const roots = univariateBezierB.roots(0.0, true);
      if (roots)
        for (const r of roots) {
          let bezierBFraction = r;
          bezierB.fractionToPoint4d(bezierBFraction, this._xyzwB);
          const segmentAFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(this._xyzwA0, this._xyzwA1, this._xyzwB);
          if (segmentAFraction && Geometry.isIn01WithTolerance(segmentAFraction, intervalTolerance)) {
            let bezierAFraction = Geometry.interpolate(f0, segmentAFraction, f1);
            const xyMatchingFunction = new BezierBezierIntersectionXYRRToRRD(bezierA, bezierB);
            const newtonSearcher = new Newton2dUnboundedWithDerivative(xyMatchingFunction);
            newtonSearcher.setUV(bezierAFraction, bezierBFraction);
            if (newtonSearcher.runIterations()) {
              bezierAFraction = newtonSearcher.getU();
              bezierBFraction = newtonSearcher.getV();
            }
            // We have a near intersection at fractions on the two beziers !!!
            // Iterate on the curves for a true intersection ....
            // NEEDS WORK -- just accept . . .
            const bcurveAFraction = bezierA.fractionToParentFraction(bezierAFraction);
            const bcurveBFraction = bezierB.fractionToParentFraction(bezierBFraction);
            const xyzA0 = bezierA.fractionToPoint(bezierAFraction);
            const xyzA1 = bcurveA.fractionToPoint(bcurveAFraction);
            const xyzB0 = bezierB.fractionToPoint(bezierBFraction);
            const xyzB1 = bcurveB.fractionToPoint(bcurveBFraction);
            if (!xyzA0.isAlmostEqualXY(xyzA1))
              errors++;
            if (!xyzB0.isAlmostEqualXY(xyzB1))
              errors++;
            if (errors > 0 && !xyzA0.isAlmostEqual(xyzB0))
              errors++;
            if (errors > 0 && !xyzA1.isAlmostEqual(xyzB1))
              errors++;
            if (this.acceptFraction(bcurveAFraction) && this.acceptFraction(bcurveBFraction)) {
              this.recordPointWithLocalFractions(bcurveAFraction, bcurveA, 0, 1,
                bcurveBFraction, bcurveB, 0, 1, reversed);
            }
          }
        }
    }
  }
  // Caller accesses data from two arcs.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion"
  // Solves the arc-arc equations
  private dispatchBSplineCurve3dBSplineCurve3d(
    bcurveA: BSplineCurve3dBase,
    bcurveB: BSplineCurve3dBase,
    _reversed: boolean) {
    const bezierSpanA = bcurveA.collectBezierSpans(true) as BezierCurve3dH[];
    const bezierSpanB = bcurveB.collectBezierSpans(true) as BezierCurve3dH[];
    const numA = bezierSpanA.length;
    const numB = bezierSpanB.length;
    const rangeA = this.getRanges(bezierSpanA);
    const rangeB = this.getRanges(bezierSpanB);
    const orderA = bcurveA.order;
    const orderB = bcurveB.order;
    const univariateCoffsA = new UnivariateBezier(orderA);
    const univariateCoffsB = new UnivariateBezier(orderB);
    for (let a = 0; a < numA; a++) {
      for (let b = 0; b < numB; b++) {
        if (rangeA[a].intersectsRangeXY(rangeB[b])) {
          const strokeCountA = bezierSpanA[a].computeStrokeCountForOptions();
          const strokeCountB = bezierSpanB[b].computeStrokeCountForOptions();
          if (strokeCountA < strokeCountB)
            this.dispatchBezierBezierStrokeFirst(bezierSpanA[a], bcurveA, strokeCountA, bezierSpanB[b], bcurveB, strokeCountB, univariateCoffsB, !_reversed);
          else
            this.dispatchBezierBezierStrokeFirst(bezierSpanB[b], bcurveB, strokeCountB, bezierSpanA[a], bcurveA, strokeCountA, univariateCoffsA, _reversed);
        }
      }
    }
  }

  /**
   * Apply the projection transform (if any) to (xyz, w)
   * @param xyz xyz parts of input point.
   * @param w   weight to use for homogeneous effects
   */
  private projectPoint(xyz: XYAndZ, w: number = 1.0): Point4d {
    return Point4d.createFromPointAndWeight(xyz, w);
  }
  private mapNPCPlaneToWorld(npcPlane: Point4d, worldPlane: Point4d) {
    npcPlane.clone(worldPlane);
  }
  // Caller accesses data from segment and bsplineCurve
  // Selects the best conditioned arc (in xy parts) as "circle after inversion"
  // Solves the arc-arc equations
  private dispatchSegmentBsplineCurve(
    cpA: CurvePrimitive,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    bcurve: BSplineCurve3d, reversed: boolean) {
    const pointA0H = this.projectPoint(pointA0);
    const pointA1H = this.projectPoint(pointA1);
    const planeCoffs = Point4d.createPlanePointPointZ(pointA0H, pointA1H);
    this.mapNPCPlaneToWorld(planeCoffs, planeCoffs);
    // NOW .. we have a plane in world space.  Intersect it with the bspline:
    const intersections: CurveLocationDetail[] = [];
    bcurve.appendPlaneIntersectionPoints(planeCoffs, intersections);
    // intersections has WORLD points with bspline fractions.   (The bspline fractions are all good 0..1 fractions within the spline.)
    // accept those that are within the segment range.
    for (const detail of intersections) {
      const fractionB = detail.fraction;
      const curvePoint = detail.point;
      const curvePointH = this.projectPoint(curvePoint);
      const lineFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(pointA0H, pointA1H, curvePointH);
      if (lineFraction !== undefined && this.acceptFraction(lineFraction) && this.acceptFraction(fractionB)) {
        this.recordPointWithLocalFractions(lineFraction, cpA, fractionA0, fractionA1,
          fractionB, bcurve, 0, 1, reversed);
      }
    }
  }

  private static _workPointAA0 = Point3d.create();
  private static _workPointAA1 = Point3d.create();
  private static _workPointBB0 = Point3d.create();
  private static _workPointBB1 = Point3d.create();
  /** low level dispatch of linestring with (beziers of) a bspline curve */
  public dispatchLineStringBSplineCurve(lsA: LineString3d, curveB: BSplineCurve3d, reversed: boolean): any {
    const numA = lsA.numPoints();
    if (numA > 1) {
      const dfA = 1.0 / (numA - 1);
      let fA0;
      let fA1;
      fA0 = 0.0;
      const pointA0 = CurveCurveCloseApproachXY._workPointA0;
      const pointA1 = CurveCurveCloseApproachXY._workPointA1;
      lsA.pointAt(0, pointA0);
      for (let iA = 1; iA < numA; iA++, pointA0.setFrom(pointA1), fA0 = fA1) {
        lsA.pointAt(iA, pointA1);
        fA1 = iA * dfA;
        this.dispatchSegmentBsplineCurve(
          lsA, pointA0, fA0, pointA1, fA1,
          curveB, reversed);
      }
    }
    return undefined;
  }
  /** Detail computation for segment intersecting linestring. */
  public computeSegmentLineString(lsA: LineSegment3d, lsB: LineString3d, reversed: boolean): any {
    const pointA0 = lsA.point0Ref;
    const pointA1 = lsA.point1Ref;
    const pointB0 = CurveCurveCloseApproachXY._workPointBB0;
    const pointB1 = CurveCurveCloseApproachXY._workPointBB1;
    const numB = lsB.numPoints();
    if (numB > 1) {
      const dfB = 1.0 / (numB - 1);
      let fB0;
      let fB1;
      fB0 = 0.0;
      lsB.pointAt(0, pointB0);
      for (let ib = 1; ib < numB; ib++, pointB0.setFrom(pointB1), fB0 = fB1) {
        lsB.pointAt(ib, pointB1);
        fB1 = ib * dfB;
        this.dispatchSegmentSegment(
          lsA, pointA0, 0.0, pointA1, 1.0,
          lsB, pointB0, fB0, pointB1, fB1,
          reversed);
      }
    }
    return undefined;
  }
  /** Detail computation for arcA intersecting lsB. */
  public computeArcLineString(arcA: Arc3d, lsB: LineString3d, reversed: boolean): any {
    const pointB0 = CurveCurveCloseApproachXY._workPointBB0;
    const pointB1 = CurveCurveCloseApproachXY._workPointBB1;
    const numB = lsB.numPoints();
    if (numB > 1) {
      const dfB = 1.0 / (numB - 1);
      let fB0;
      let fB1;
      fB0 = 0.0;
      lsB.pointAt(0, pointB0);
      for (let ib = 1; ib < numB; ib++, pointB0.setFrom(pointB1), fB0 = fB1) {
        lsB.pointAt(ib, pointB1);
        fB1 = ib * dfB;
        this.dispatchSegmentArc(
          lsB, pointB0, fB0, pointB1, fB1,
          arcA,
          !reversed);
      }
    }
    return undefined;
  }

  private static _workPointA0 = Point3d.create();
  private static _workPointA1 = Point3d.create();
  private static _workPointB0 = Point3d.create();
  // private static _workPointB1 = Point3d.create();
  /** double dispatch handler for strongly typed segment.. */
  public handleLineSegment3d(segmentA: LineSegment3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      const segmentB = this._geometryB;
      this.dispatchSegmentSegment(
        segmentA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0,
        segmentB, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0,
        false);
    } else if (this._geometryB instanceof LineString3d) {
      this.computeSegmentLineString(segmentA, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchSegmentArc(
        segmentA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0,
        this._geometryB, false);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchSegmentBsplineCurve(
        segmentA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0,
        this._geometryB, false);
    }
  }

  /** double dispatch handler for strongly typed linestring.. */
  public handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineString3d) {
      const lsB = this._geometryB as LineString3d;
      const pointA0 = CurveCurveCloseApproachXY._workPointAA0;
      const pointA1 = CurveCurveCloseApproachXY._workPointAA1;
      const pointB0 = CurveCurveCloseApproachXY._workPointBB0;
      const pointB1 = CurveCurveCloseApproachXY._workPointBB1;
      const numA = lsA.numPoints();
      const numB = lsB.numPoints();
      if (numA > 1 && numB > 1) {
        lsA.pointAt(0, pointA0);
        const dfA = 1.0 / (numA - 1);
        const dfB = 1.0 / (numB - 1);
        let fA0 = 0.0;
        let fB0;
        let fA1;
        let fB1;
        lsA.pointAt(0, pointA0);
        for (let ia = 1; ia < numA; ia++, pointA0.setFrom(pointA1), fA0 = fA1) {
          fA1 = ia * dfA;
          fB0 = 0.0;
          lsA.pointAt(ia, pointA1);
          lsB.pointAt(0, pointB0);
          for (let ib = 1; ib < numB; ib++, pointB0.setFrom(pointB1), fB0 = fB1) {
            lsB.pointAt(ib, pointB1);
            fB1 = ib * dfB;
            this.dispatchSegmentSegment(
              lsA, pointA0, fA0, pointA1, fA1,
              lsB, pointB0, fB0, pointB1, fB1,
              false);
          }
        }
      }
    } else if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentLineString(this._geometryB, lsA, true);
    } else if (this._geometryB instanceof Arc3d) {
      this.computeArcLineString(this._geometryB, lsA, true);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchLineStringBSplineCurve(lsA, this._geometryB, false);
    }
    return undefined;
  }
  /** double dispatch handler for strongly typed arc .. */
  public handleArc3d(arc0: Arc3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentArc(
        this._geometryB, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0,
        arc0, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.computeArcLineString(arc0, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcArc(arc0, this._geometryB, false);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchArcBsplineCurve3d(arc0, this._geometryB, false);
    }
    return undefined;
  }
  /** double dispatch handler for strongly typed bspline curve .. */
  public handleBSplineCurve3d(curve: BSplineCurve3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentBsplineCurve(
        this._geometryB, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0,
        curve, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.dispatchLineStringBSplineCurve(this._geometryB, curve, true);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcBsplineCurve3d(this._geometryB, curve, true);
    } else if (this._geometryB instanceof BSplineCurve3dBase) {
      this.dispatchBSplineCurve3dBSplineCurve3d(curve, this._geometryB, false);
    }
    return undefined;
  }
  /** double dispatch handler for strongly typed homogeneous bspline curve .. */
  public handleBSplineCurve3dH(_curve: BSplineCurve3dH): any {
    /* NEEDS WORK -- make "dispatch" methods tolerant of both 3d and 3dH ..."easy" if both present BezierCurve3dH span loaders
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentBsplineCurve(
        this._geometryB, this._extendB, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB,
        curve, this._extendA, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.dispatchLineStringBSplineCurve(this._geometryB, this._extendB, curve, this._extendA, true);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcBsplineCurve3d(this._geometryB, this._extendB, curve, this._extendA, true);
    }
    */
    return undefined;
  }
}
