/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert } from "@itwin/core-bentley";
import { BSplineCurve3d, BSplineCurve3dBase } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Geometry } from "../../Geometry";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { GrowableFloat64Array } from "../../geometry3d/GrowableFloat64Array";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import {
  CurveCurveCloseApproachXYRRtoRRD, CurvePointCloseApproachXYRtoRD,
  Newton1dUnbounded, Newton2dUnboundedWithDerivative, NewtonEvaluatorRRtoRRD,
} from "../../numerics/Newton";
import { AnalyticRoots, SmallSystem } from "../../numerics/Polynomials";
import { Arc3d } from "../Arc3d";
import { CurveChainWithDistanceIndex } from "../CurveChainWithDistanceIndex";
import { CurveCollection } from "../CurveCollection";
import { CurveIntervalRole, CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { AnyCurve } from "../CurveTypes";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";

// cspell:word XYRR currentdFdX

/**
 * Handler class for XY close approach between _geometryB and another geometry.
 * * Approach means the XY distance (z is ignored) between _geometryB and another geometry.
 * * Closest approach is a measure of the proximity of one curve to another. It's the length of the shortest line
 * segment perpendicular to both curves; if the curves intersect, the closest approach is zero. In the context of
 * this class, z-coordinates are ignored, so the closest approach is as seen in the top view. If you have coplanar
 * input curves and want to find closest approach in their plane, rotate them first into a plane parallel to the
 * xy-plane, then afterward, rotate the results back as required.
 * * Close approach can also be from a curve endpoint perpendicular to another curve or from a curve endpoint to
 * another curve endpoint.
 * * Instances are initialized and called from CurveCurve.
 * * geometryB is saved for later reference.
 * @internal
 */
export class CurveCurveCloseApproachXY extends RecurseToCurvesGeometryHandler {
  private _geometryB: AnyCurve | undefined;
  private _circularArcB: Arc3d | undefined;
  private _circularRadiusB: number | undefined;
  private setGeometryB(geometryB: AnyCurve | undefined) {
    this._geometryB = geometryB;
    this._circularArcB = undefined;
    this._circularRadiusB = undefined;
    if (geometryB instanceof Arc3d) {
      const r = geometryB.circularRadiusXY();
      if (r !== undefined) {
        this._circularRadiusB = r;
        this._circularArcB = geometryB;
      }
    }
  }
  /**
   * Maximum XY distance (z is ignored). Approach larger than this is not interesting.
   * This is caller defined and can be undefined.
   */
  private _maxDistanceToAccept: number | undefined;
  /** Squared max distance. This is private, and is forced to at least small metric distance squared. */
  private _maxDistanceSquared: number;
  /**
   * Start and end points of line segments that meet closest approach criteria, i.e., they are perpendicular to
   * both curves and their length is smaller than _maxDistanceToAccept.
   */
  private _results: CurveLocationDetailPair[];

  private static _workPointAA0 = Point3d.create();
  private static _workPointAA1 = Point3d.create();
  private static _workPointBB0 = Point3d.create();
  private static _workPointBB1 = Point3d.create();
  private static _workPointB = Point3d.create();

  /**
   * Constructor.
   * @param geometryB second curve for intersection. Saved for reference by specific handler methods.
   */
  public constructor(geometryB: AnyCurve | undefined) {
    super();
    this.setGeometryB(geometryB);
    this._maxDistanceSquared = Geometry.smallMetricDistanceSquared;
    this._results = [];
  }
  /** Set the (possibly undefined) max XY distance (z is ignored) to accept. */
  public set maxDistanceToAccept(value: number | undefined) {
    this._maxDistanceToAccept = value;
    if (this._maxDistanceToAccept !== undefined && this._maxDistanceToAccept > 0)
      this._maxDistanceSquared = this._maxDistanceToAccept * this._maxDistanceToAccept;
  }
  /** Access the (possibly undefined) max XY distance (z is ignored) to accept. */
  public get maxDistanceToAccept(): number | undefined {
    return this._maxDistanceToAccept;
  }
  /** Ask if the maxDistanceToAccept value is defined and positive */
  public get isMaxDistanceSet(): boolean {
    return this._maxDistanceToAccept !== undefined && this._maxDistanceToAccept > 0;
  }
  /** Reset the geometry and flags, leaving all other parts unchanged (and preserving accumulated intersections) */
  public resetGeometry(geometryB: AnyCurve) {
    this.setGeometryB(geometryB);
  }
  /** returns true if `fraction` is in [0,1] within tolerance */
  private acceptFraction(fraction: number, fractionTol: number = 1.0e-12) {
    if (fraction < -fractionTol)
      return false;
    if (fraction > 1.0 + fractionTol)
      return false;
    return true;
  }
  /**
   * Return the results structure for the intersection calculation, structured as an array of CurveLocationDetailPair.
   * @param reinitialize if true, a new results structure is created for use by later calls.
   */
  public grabPairedResults(reinitialize: boolean = false): CurveLocationDetailPair[] {
    const result = this._results;
    if (reinitialize)
      this._results = [];
    return result;
  }
  /**
   * If distance between pointA and pointB is less than maxDistance, record CurveLocationDetailPair which is
   * the approach from pointA to pointB.
   */
  private testAndRecordPointPairApproach(
    cpA: CurvePrimitive, fA: number, pointA: Point3d, cpB: CurvePrimitive, fB: number, pointB: Point3d, reversed: boolean,
  ): void {
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
  /**
   * Create a close approach pair if XY distance is within maxDistance.
   * @param localFractionA a fraction on first curve
   * @param cpA the first curve
   * @param fractionA0 start of the first curve
   * @param fractionA1 end of the first curve
   * @param localFractionB a fraction on second curve
   * @param cpB the second curve
   * @param fractionB0 start of the second curve
   * @param fractionB1 end of the second curve
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to geometryB).
   * @param intervalDetails optional CurveLocationDetailPair
   */
  private recordPointWithLocalFractions(
    localFractionA: number,
    cpA: CurvePrimitive,
    fractionA0: number,
    fractionA1: number,
    localFractionB: number,
    cpB: CurvePrimitive,
    fractionB0: number,
    fractionB1: number,
    reversed: boolean,
    intervalDetails?: undefined | CurveLocationDetailPair,
  ): void {
    let globalFractionA, globalFractionB;
    let globalFractionA1, globalFractionB1;
    const isInterval = intervalDetails !== undefined &&
      intervalDetails.detailA.hasFraction1 &&
      intervalDetails.detailB.hasFraction1;
    if (isInterval) {
      globalFractionA = Geometry.interpolate(fractionA0, intervalDetails.detailA.fraction, fractionA1);
      globalFractionB = Geometry.interpolate(fractionB0, intervalDetails.detailB.fraction, fractionB1);
      globalFractionA1 = Geometry.interpolate(fractionA0, intervalDetails.detailA.fraction1!, fractionA1);
      globalFractionB1 = Geometry.interpolate(fractionB0, intervalDetails.detailB.fraction1!, fractionB1);
    } else {
      globalFractionA = globalFractionA1 = Geometry.interpolate(fractionA0, localFractionA, fractionA1);
      globalFractionB = globalFractionB1 = Geometry.interpolate(fractionB0, localFractionB, fractionB1);
    }
    // ignore duplicate of most recent approach
    const numPrevious = this._results.length;
    if (numPrevious > 0 && !isInterval) {
      const oldDetailA = this._results[numPrevious - 1].detailA;
      const oldDetailB = this._results[numPrevious - 1].detailB;
      if (reversed) {
        if (oldDetailB.isSameCurveAndFraction({ curve: cpA, fraction: globalFractionA }) &&
          oldDetailA.isSameCurveAndFraction({ curve: cpB, fraction: globalFractionB }))
          return;
      } else {
        if (oldDetailA.isSameCurveAndFraction({ curve: cpA, fraction: globalFractionA }) &&
          oldDetailB.isSameCurveAndFraction({ curve: cpB, fraction: globalFractionB }))
          return;
      }
    }
    const detailA = CurveLocationDetail.createCurveFractionPoint(
      cpA, globalFractionA, cpA.fractionToPoint(globalFractionA),
    );
    const detailB = CurveLocationDetail.createCurveFractionPoint(
      cpB, globalFractionB, cpB.fractionToPoint(globalFractionB),
    );
    if (isInterval) {
      detailA.captureFraction1Point1(globalFractionA1, cpA.fractionToPoint(globalFractionA1));
      detailB.captureFraction1Point1(globalFractionB1, cpB.fractionToPoint(globalFractionB1));
    } else {
      const d2 = detailA.point.distanceSquaredXY(detailB.point);
      if (d2 > this._maxDistanceSquared)
        return;
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
   * Capture a close approach pair that has point and local fraction but not curve.
   * * Record the pair, each detail modified with global fraction and input curve.
   * * Pair is neither modified nor recorded if it would be a duplicate of the last recorded pair.
   * @param pair details computed with local fractions
   * @param cpA curveA
   * @param fractionA0 global start fraction on curveA
   * @param fractionA1 global end fraction on curveA
   * @param cpB curveB
   * @param fractionB0 global start fraction on curveB
   * @param fractionB1 global end fraction on curveB
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to geometryB).
   */
  private capturePairWithLocalFractions(
    pair: CurveLocationDetailPair,
    cpA: CurvePrimitive,
    fractionA0: number,
    fractionA1: number,
    cpB: CurvePrimitive,
    fractionB0: number,
    fractionB1: number,
    reversed: boolean,
  ) {
    const globalFractionA = Geometry.interpolate(fractionA0, pair.detailA.fraction, fractionA1);
    const globalFractionB = Geometry.interpolate(fractionB0, pair.detailB.fraction, fractionB1);
    // ignore duplicate of most recent pair
    const numPrevious = this._results.length;
    if (numPrevious > 0) {
      const oldDetailA = this._results[numPrevious - 1].detailA;
      const oldDetailB = this._results[numPrevious - 1].detailB;
      if (reversed) {
        if (oldDetailB.isSameCurveAndFraction({ curve: cpA, fraction: globalFractionA }) &&
          oldDetailA.isSameCurveAndFraction({ curve: cpB, fraction: globalFractionB }))
          return;
      } else {
        if (oldDetailA.isSameCurveAndFraction({ curve: cpA, fraction: globalFractionA }) &&
          oldDetailB.isSameCurveAndFraction({ curve: cpB, fraction: globalFractionB }))
          return;
      }
    }
    // recompute the points just in case
    CurveLocationDetail.createCurveEvaluatedFraction(cpA, globalFractionA, pair.detailA);
    CurveLocationDetail.createCurveEvaluatedFraction(cpB, globalFractionB, pair.detailB);
    pair.detailA.setIntervalRole(CurveIntervalRole.isolated);
    pair.detailB.setIntervalRole(CurveIntervalRole.isolated);
    if (reversed)
      pair.swapDetails();
    this._results.push(pair);
  }
  /**
   * Emit recordPoint for multiple pairs (on full curve) if within maxDistance.
   * @param cpA first curve primitive (possibly different from curve in detailA, but fraction compatible)
   * @param cpB second curve primitive (possibly different from curve in detailA, but fraction compatible)
   * @param pairs array of pairs
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to geometryB).
   */
  public recordPairs(
    cpA: CurvePrimitive, cpB: CurvePrimitive, pairs: CurveLocationDetailPair[] | undefined, reversed: boolean,
  ): void {
    if (pairs !== undefined) {
      for (const p of pairs) {
        this.recordPointWithLocalFractions(
          p.detailA.fraction, cpA, 0, 1, p.detailB.fraction, cpB, 0, 1, reversed, p,
        );
      }
    }
  }
  /**
   * Record fully assembled (but possibly reversed) detail pair.
   * @param detailA first detail
   * @param detailB second detail
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to geometryB).
   */
  public captureDetailPair(
    detailA: CurveLocationDetail | undefined, detailB: CurveLocationDetail | undefined, reversed: boolean,
  ): void {
    if (detailA && detailB) {
      if (reversed) {
        this._results.push(CurveLocationDetailPair.createCapture(detailB, detailA));
      } else {
        this._results.push(CurveLocationDetailPair.createCapture(detailA, detailB));
      }
    }
  }
  private static updatePointToSegmentDistance(
    fractionA: number,
    pointA: Point3d,
    pointB0: Point3d,
    pointB1: Point3d,
    fractionB: number,
    maxDistanceSquared: number,
    closestApproach: CurveLocationDetailPair,   // modified on return
  ): boolean {
    let updated = false;
    if (fractionB < 0)
      fractionB = 0;
    else if (fractionB > 1)
      fractionB = 1;
    this._workPointB = pointB0.interpolate(fractionB, pointB1, this._workPointB);
    const distanceSquared = this._workPointB.distanceSquaredXY(pointA);
    if (distanceSquared <= Math.min(maxDistanceSquared, closestApproach.detailA.a)) {
      closestApproach.detailA.setFP(fractionA, pointA, undefined, distanceSquared);
      closestApproach.detailB.setFP(fractionB, this._workPointB, undefined, distanceSquared);
      updated = true;
    }
    return updated;
  }
  /**
   * Return fractions of close approach within maxDistance between two line segments (a0,a1) and (b0,b1).
   * * Math details can be found at core/geometry/internaldocs/Curve.md
   * @param a0 start point of line a
   * @param a1 end point of line a
   * @param b0 start point of line b
   * @param b1 end point of line b
   * @param maxDistanceSquared maximum distance squared (assumed to be positive)
   * @returns the fractional (not xy) coordinates in result.x and result.y. result.x is fraction on line a.
   * result.y is fraction on line b.
   */
  private static segmentSegmentBoundedApproach(
    a0: Point3d,
    a1: Point3d,
    b0: Point3d,
    b1: Point3d,
    maxDistanceSquared: number,
  ): CurveLocationDetailPair | undefined {
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
    const hab0 = Geometry.crossProductXYXY(ux, uy, e00x, e00y);
    const hab1 = Geometry.crossProductXYXY(ux, uy, e01x, e01y);
    const hba0 = -Geometry.crossProductXYXY(vx, vy, e00x, e00y);
    const hba1 = -Geometry.crossProductXYXY(vx, vy, e10x, e10y);
    if (hab0 * hab1 < 0.0 && hba0 * hba1 < 0.0) { // true intersection, strictly within both segments
      const fractionA = -hba0 / (hba1 - hba0);
      const fractionB = -hab0 / (hab1 - hab0);
      return CurveLocationDetailPair.createCapture(
        CurveLocationDetail.createCurveFractionPoint(undefined, fractionA, a0.interpolate(fractionA, a1)),
        CurveLocationDetail.createCurveFractionPoint(undefined, fractionB, b0.interpolate(fractionB, b1)),
      );
    }
    // there's no intersection, so find the closest approach within maxDistance from an endpoint
    const closestApproach = new CurveLocationDetailPair();
    closestApproach.detailA.a = 2 * maxDistanceSquared; // init to an approach that's too far away
    let reversed = false;
    const uu = Geometry.hypotenuseSquaredXY(ux, uy);
    if (hab0 * hab0 <= maxDistanceSquared * uu) { // test distance of b0 to u
      const fractionA = Geometry.dotProductXYXY(ux, uy, e00x, e00y) / uu;
      if (this.updatePointToSegmentDistance(0, b0, a0, a1, fractionA, maxDistanceSquared, closestApproach))
        reversed = true;
    }
    if (hab1 * hab1 <= maxDistanceSquared * uu) { // test distance of b1 to u
      const fractionA = Geometry.dotProductXYXY(ux, uy, e01x, e01y) / uu;
      if (this.updatePointToSegmentDistance(1, b1, a0, a1, fractionA, maxDistanceSquared, closestApproach))
        reversed = true;
    }
    const vv = Geometry.hypotenuseSquaredXY(vx, vy);
    if (hba0 * hba0 <= maxDistanceSquared * vv) { // test distance of a0 to v
      const fractionB = -Geometry.dotProductXYXY(vx, vy, e00x, e00y) / vv;
      if (this.updatePointToSegmentDistance(0, a0, b0, b1, fractionB, maxDistanceSquared, closestApproach))
        reversed = false;
    }
    if (hba1 * hba1 <= maxDistanceSquared * vv) { // test distance of a1 to v
      const fractionB = -Geometry.dotProductXYXY(vx, vy, e10x, e10y) / vv;
      if (this.updatePointToSegmentDistance(1, a1, b0, b1, fractionB, maxDistanceSquared, closestApproach))
        reversed = false;
    }
    if (closestApproach.detailA.a > maxDistanceSquared)
      return undefined;
    if (reversed)
      closestApproach.swapDetails();
    return closestApproach;
  }
  /**
   * Check different combination of fractions on curveA and curveB. If distance between points at 2 fractions
   * is less than maxDistance, record CurveLocationDetailPair which is the approach between the 2 points.
   * Optionally, record close approaches of one curve's points if they fall between the other curve's points.
   * @param cpA curveA
   * @param fA0 fraction0 on curveA
   * @param fA1 fraction1 on curveA
   * @param testProjectionOnA whether to record projections of the given curveB points onto curveA
   * @param cpB curveB
   * @param fB0 fraction0 on curveB
   * @param fB1 fraction0 on curveB
   * @param testProjectionOnB whether to record projections of the given curveA points onto curveB
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to geometryB).
   */
  private testAndRecordFractionalPairApproach(
    cpA: CurvePrimitive,
    fA0: number,
    fA1: number,
    testProjectionOnA: boolean,
    cpB: CurvePrimitive,
    fB0: number,
    fB1: number,
    testProjectionOnB: boolean,
    reversed: boolean,
  ): void {
    const pointA0 = cpA.fractionToPoint(fA0);
    const pointA1 = cpA.fractionToPoint(fA1);
    const pointB0 = cpB.fractionToPoint(fB0);
    const pointB1 = cpB.fractionToPoint(fB1);
    this.testAndRecordPointPairApproach(cpA, fA0, pointA0, cpB, fB0, pointB0, reversed);
    this.testAndRecordPointPairApproach(cpA, fA1, pointA1, cpB, fB0, pointB0, reversed);
    this.testAndRecordPointPairApproach(cpA, fA0, pointA0, cpB, fB1, pointB1, reversed);
    this.testAndRecordPointPairApproach(cpA, fA1, pointA1, cpB, fB1, pointB1, reversed);
    if (testProjectionOnB) {
      this.testAndRecordProjection(cpA, fA0, pointA0, cpB, fB0, fB1, reversed);
      this.testAndRecordProjection(cpA, fA1, pointA1, cpB, fB0, fB1, reversed);
    }
    if (testProjectionOnA) {
      this.testAndRecordProjection(cpB, fB0, pointB0, cpA, fA0, fA1, !reversed);
      this.testAndRecordProjection(cpB, fB1, pointB1, cpA, fA0, fA1, !reversed);
    }
  }
  /**
   * Return XY closest approach between a curve primitive and a point.
   * Currently, this function only supports Arc3d and LineSegment.
   * Note that this function doesn't handle endpoints.
   */
  private getPointCurveClosestApproachXYNewton(curveP: CurvePrimitive, pointQ: Point3d): CurveLocationDetail | undefined {
    if (!(curveP instanceof Arc3d) && !(curveP instanceof LineSegment3d)) {
      assert(!!"getPointCurveClosestApproachXYNewton only supports Arc3d and LineSegment");
      return undefined;
    }
    const seeds = [0.2, 0.4, 0.6, 0.8]; // HEURISTIC: arcs have up to 4 perpendiculars; lines have only 1
    const newtonEvaluator = new CurvePointCloseApproachXYRtoRD(curveP, pointQ);
    const newtonSearcher = new Newton1dUnbounded(newtonEvaluator);
    let minCloseApproachLength = Geometry.largeCoordinateResult;
    let minCurvePFraction: number | undefined;
    let minPointP: Point3d | undefined;
    for (const seed of seeds) {
      newtonSearcher.setX(seed);
      if (newtonSearcher.runIterations()) {
        const curvePFraction = newtonSearcher.getX();
        if (this.acceptFraction(curvePFraction)) {
          const pointP = curveP.fractionToPoint(curvePFraction);
          const closeApproachLength = pointP.distanceSquaredXY(pointQ);
          if (closeApproachLength < minCloseApproachLength) {
            minCloseApproachLength = closeApproachLength;
            minCurvePFraction = curvePFraction;
            minPointP = pointP;
          }
        }
      }
    }
    if (minCurvePFraction && minPointP)
      return CurveLocationDetail.createCurveFractionPoint(curveP, minCurvePFraction, minPointP);
    return undefined;
  }
  /** Find the closest approach between pointA and cpB. Add the approach if it's within fB0 and fB1. */
  private testAndRecordProjection(
    cpA: CurvePrimitive, fA: number, pointA: Point3d, cpB: CurvePrimitive, fB0: number, fB1: number, reversed: boolean,
  ) {
    const detail = this.getPointCurveClosestApproachXYNewton(cpB, pointA);
    if (detail) {
      const fB = Geometry.restrictToInterval(detail.fraction, fB0, fB1);
      if (fB === detail.fraction) { // if fraction is within fB0 and fB1
        this.testAndRecordPointPairApproach(cpA, fA, pointA, cpB, detail.fraction, detail.point, reversed);
      }
    }
  }
  /**
   * Compute intersection of two line segments.
   * Filter by extension rules.
   * Record with fraction mapping.
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
  ): void {
    // compute a pair with fractions local to segments
    const approach = CurveCurveCloseApproachXY.segmentSegmentBoundedApproach(
      pointA0, pointA1, pointB0, pointB1, this._maxDistanceSquared,
    );
    // adjust the pair to refer to input curves and global fractions, then record it if new
    if (approach) {
      approach.detailA.setCurve(cpA);
      approach.detailB.setCurve(cpB);
      this.capturePairWithLocalFractions(approach, cpA, fractionA0, fractionA1, cpB, fractionB0, fractionB1, reversed);
    }
  }
  /** Low level dispatch of segment with segment. */
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
  ): void {
    this.computeSegmentSegment3D(
      cpA, pointA0, fractionA0, pointA1, fractionA1,
      cpB, pointB0, fractionB0, pointB1, fractionB1,
      reversed,
    );
  }
  /**
   * Low level dispatch of line segment with arc.
   * Find close approaches within maxDistance between a line segments (pointA0, pointA1) and an arc.
   * To consider:
   * 1) intersection between arc and segment.
   * 2) endpoints to endpoints or endpoints projection to the other curve.
   * 3) arc tangent parallel to line segment (or line string).
   * @param cpA curve A (line segment or line string; if it is a line string, then the fractions must specify a segment)
   * @param pointA0 start point of the segment
   * @param fractionA0 fraction of the start of the segment
   * @param pointA1 end point of the segment
   * @param fractionA1 fraction of the end of the segment
   * @param arc the arc
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to geometryB).
   */
  private dispatchSegmentArc(
    cpA: CurvePrimitive,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    arc: Arc3d,
    reversed: boolean,
  ): void {
    // 1) intersection between arc and line segment (or string).
    // Suppose:
    // Arc: X = C + cU + sV where c = cos(theta) and s = sin(theta)
    // Line: contains points A0 and A1
    // The arc intersects the line at point X if det(A0, A1, X) = 0 with homogeneous xyw points and vectors.
    // With equational X:  det(A0, A1, C) + c*det(A0, A1, U) + s*det(A0, A1, V) = 0.
    // solve for theta.
    // evaluate points.
    // project back to line.
    let intersectionFound = false;
    const data = arc.toTransformedVectors();
    const pointA0Local = pointA0;
    const pointA1Local = pointA1;
    const alpha = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.center, 1); //  det(A0, A1, C)
    const beta = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector0, 0); // det(A0, A1, U)
    const gamma = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector90, 0); // det(A0, A1, V)
    const cosines = new GrowableFloat64Array(2);
    const sines = new GrowableFloat64Array(2);
    const radians = new GrowableFloat64Array(2);
    const numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections( // solve the equation
      alpha, beta, gamma, cosines, sines, radians,
    );
    for (let i = 0; i < numRoots; i++) {
      const arcPoint = data.center.plus2Scaled(
        data.vector0, cosines.atUncheckedIndex(i), data.vector90, sines.atUncheckedIndex(i),
      );
      const arcFraction = data.sweep.radiansToSignedPeriodicFraction(radians.atUncheckedIndex(i));
      const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(pointA0Local, pointA1Local, arcPoint);
      // only add if the point is within the start and end fractions of both line segment and arc
      if (lineFraction !== undefined && this.acceptFraction(lineFraction) && this.acceptFraction(arcFraction)) {
        this.recordPointWithLocalFractions(
          lineFraction, cpA, fractionA0, fractionA1, arcFraction, arc, 0, 1, reversed,
        );
        intersectionFound = true;
      }
    }
    if (intersectionFound)
      return;
    // 2) endpoints to endpoints or endpoints projection to the other curve.
    this.testAndRecordFractionalPairApproach(cpA, fractionA0, fractionA1, true, arc, 0, 1, true, reversed);
    // 3) arc tangent parallel to line segment (or string).
    // If line does not intersect the arc, then the closest (and/or the furthest) point on arc to the line is a
    // point where the tangent line on arc at that point is parallel to the line.
    const dotUT = data.vector0.crossProductStartEndXY(pointA0, pointA1);
    const dotVT = data.vector90.crossProductStartEndXY(pointA0, pointA1);
    const parallelRadians = Math.atan2(dotVT, dotUT);
    for (const radians1 of [parallelRadians, parallelRadians + Math.PI]) {
      const arcPoint = data.center.plus2Scaled(data.vector0, Math.cos(radians1), data.vector90, Math.sin(radians1));
      const arcFraction = data.sweep.radiansToSignedPeriodicFraction(radians1);
      const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(pointA0Local, pointA1Local, arcPoint);
      // only add if the point is within the start and end fractions of both line segment and arc
      if (lineFraction !== undefined && this.acceptFraction(lineFraction) && this.acceptFraction(arcFraction)) {
        this.recordPointWithLocalFractions(
          lineFraction, cpA, fractionA0, fractionA1, arcFraction, arc, 0, 1, reversed,
        );
      }
    }
  }
  /** Solve Newton for 2 arcs and the given newtonEvaluator. */
  private solveArcArcNewton(
    curveP: Arc3d, curveQ: Arc3d, reversed: boolean, newtonEvaluator: NewtonEvaluatorRRtoRRD,
  ): void {
    const seedsU = [0.2, 0.4, 0.6, 0.8];  // HEURISTIC: 2 arcs have up to 4 perpendiculars/intersections
    const seedsV = [0.2, 0.4, 0.6, 0.8];
    const newtonSearcher = new Newton2dUnboundedWithDerivative(newtonEvaluator);
    for (const seedU of seedsU) {
      for (const seedV of seedsV) {
        newtonSearcher.setUV(seedU, seedV);
        if (newtonSearcher.runIterations()) {
          const curvePFraction = newtonSearcher.getU();
          const curveQFraction = newtonSearcher.getV();
          if (this.acceptFraction(curvePFraction) && this.acceptFraction(curveQFraction)) {
            this.recordPointWithLocalFractions(
              curvePFraction, curveP, 0, 1, curveQFraction, curveQ, 0, 1, reversed,
            );
          }
        }
      }
    }
  }
  /** Find and store perpendicular line between 2 arcs. */
  private findPerpLineXYArcArcNewton(curveP: Arc3d, curveQ: Arc3d, reversed: boolean): void {
    const newtonEvaluator = new CurveCurveCloseApproachXYRRtoRRD(curveP, curveQ);
    this.solveArcArcNewton(curveP, curveQ, reversed, newtonEvaluator);
  }
  /** Low level dispatch of arc with Arc3d. */
  private dispatchArcArc(cpA: Arc3d, cpB: Arc3d, reversed: boolean): void {
    const rangeA = cpA.range();
    const rangeB = cpB.range();
    rangeA.expandInPlace(this._maxDistanceToAccept!);
    if (!rangeB.intersectsRangeXY(rangeA))
      return;
    // 1) endpoints to endpoints or endpoints projection to the other curve
    this.testAndRecordFractionalPairApproach(cpA, 0, 1, true, cpB, 0, 1, true, reversed);
    // 2) perpendicular line between 2 arcs (includes intersections)
    this.findPerpLineXYArcArcNewton(cpA, cpB, reversed);
  }
  /** Low level dispatch of arc with (beziers of) a bspline curve */
  private dispatchArcBsplineCurve3d(cpA: Arc3d, cpB: BSplineCurve3d, reversed: boolean): void {
    const ls = LineString3d.create();
    cpB.emitStrokes(ls);
    this.computeArcLineString(cpA, ls, reversed);
  }
  /** Low level dispatch of (beziers of) a bspline curve with (beziers of) a bspline curve */
  private dispatchBSplineCurve3dBSplineCurve3d(
    bcurveA: BSplineCurve3dBase, bcurveB: BSplineCurve3dBase, reversed: boolean,
  ): void {
    const lsA = LineString3d.create();
    bcurveA.emitStrokes(lsA);
    const lsB = LineString3d.create();
    bcurveB.emitStrokes(lsB);
    this.computeLineStringLineString(lsA, lsB, reversed);
  }
  /** Low level dispatch of linestring with (beziers of) a bspline curve */
  public dispatchLineStringBSplineCurve(lsA: LineString3d, curveB: BSplineCurve3d, reversed: boolean): any {
    const lsB = LineString3d.create();
    curveB.emitStrokes(lsB);
    this.computeLineStringLineString(lsA, lsB, reversed);
  }
  /** Low level dispatch of segment with (beziers of) a bspline curve */
  public dispatchSegmentBsplineCurve(segA: LineSegment3d, curveB: BSplineCurve3d, reversed: boolean): any {
    const lsB = LineString3d.create();
    curveB.emitStrokes(lsB);
    this.computeSegmentLineString(segA, lsB, reversed);
  }
  /** Detail computation for segment approaching linestring. */
  public computeSegmentLineString(segA: LineSegment3d, lsB: LineString3d, reversed: boolean): void {
    const numB = lsB.numPoints();
    const deltaFracB = Geometry.safeDivideFraction(1, numB - 1, 0);
    const pointA0 = segA.point0Ref;
    const pointA1 = segA.point1Ref;
    const pointB0 = CurveCurveCloseApproachXY._workPointBB0;
    const pointB1 = CurveCurveCloseApproachXY._workPointBB1;
    for (let i = 0; i < numB - 1; ++i) {
      const fB0 = i * deltaFracB; // global linestring fractions
      const fB1 = (i + 1 === numB - 1) ? 1.0 : (i + 1) * deltaFracB;  // make sure we nail the end fraction
      lsB.packedPoints.getPoint3dAtUncheckedPointIndex(i, pointB0);
      lsB.packedPoints.getPoint3dAtUncheckedPointIndex(i + 1, pointB1);
      this.dispatchSegmentSegment(segA, pointA0, 0.0, pointA1, 1.0, lsB, pointB0, fB0, pointB1, fB1, reversed);
    }
  }
  /** Detail computation for arc approaching linestring. */
  public computeArcLineString(arcA: Arc3d, lsB: LineString3d, reversed: boolean): any {
    const rangeA = arcA.range();
    const rangeB = lsB.range();
    rangeA.expandInPlace(this._maxDistanceToAccept!);
    if (!rangeB.intersectsRangeXY(rangeA))
      return;
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
        this.dispatchSegmentArc(lsB, pointB0, fB0, pointB1, fB1, arcA, !reversed);
      }
    }
    return undefined;
  }
  /** Low level dispatch of curve collection. */
  private dispatchCurveCollection(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    const geomB = this._geometryB;  // save
    if (!geomB || !geomB.children || !(geomB instanceof CurveCollection))
      return;
    for (const child of geomB.children) {
      this.resetGeometry(child);
      geomAHandler(geomA);
    }
    this._geometryB = geomB;  // restore
  }
  /** Low level dispatch to geomA given a CurveChainWithDistanceIndex in geometryB. */
  private dispatchCurveChainWithDistanceIndex(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    if (!this._geometryB || !(this._geometryB instanceof CurveChainWithDistanceIndex))
      return;
    if (geomA instanceof CurveChainWithDistanceIndex) {
      assert(!!"call handleCurveChainWithDistanceIndex(geomA) instead");
      return;
    }
    const index0 = this._results.length;
    const geomB = this._geometryB;  // save
    for (const child of geomB.path.children) {
      this.resetGeometry(child);
      geomAHandler(geomA);
    }
    this.resetGeometry(geomB);  // restore
    this._results = CurveChainWithDistanceIndex.convertChildDetailToChainDetail(this._results, index0, undefined, geomB, true);
  }
  /** Double dispatch handler for strongly typed segment. */
  public override handleLineSegment3d(segmentA: LineSegment3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      const segmentB = this._geometryB;
      this.dispatchSegmentSegment(
        segmentA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0,
        segmentB, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0,
        false,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.computeSegmentLineString(segmentA, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchSegmentArc(segmentA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._geometryB, false);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchSegmentBsplineCurve(segmentA, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(segmentA, this.handleLineSegment3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(segmentA, this.handleLineSegment3d.bind(this));
    }
    return undefined;
  }
  /**
   * Set bits for comparison to range xy
   * * bit 0x01 => x smaller than range.low.x
   * * bit 0x02 => x larger than range.high.x
   * * bit 0x04 => y smaller than range.low.y
   * * bit 0x08 => y larger than range.high.y
   * * If we divide XY plane into 9 areas using the range, the function returns 0 for points
   * inside the range. Below is other binary numbers returned by the function for all 9 areas:
   *   1001 | 1000 | 1010
   *   ------------------
   *    1   |  0   |  10
   *   ------------------
   *   101  | 100  | 110
   * @param xy point to test
   * @param range range for comparison
   */
  private classifyBitsPointRangeXY(x: number, y: number, range: Range3d): number {
    let result = 0;
    if (x < range.low.x)
      result = 0x01;
    else if (x > range.high.x)
      result = 0x02;
    // note the OR operation
    if (y < range.low.y)
      result |= 0x04;
    else if (y > range.high.y)
      result |= 0x08;
    return result;
  }
  /** Low level dispatch of line string with line string. */
  private computeLineStringLineString(lsA: LineString3d, lsB: LineString3d, reversed: boolean): void {
    const rangeA = lsA.range();
    const rangeB = lsB.range();
    rangeA.expandInPlace(this._maxDistanceToAccept!);
    if (!rangeB.intersectsRangeXY(rangeA))
      return;
    let bitB0: number;
    let bitB1: number;
    const rangeA1 = Range3d.createNull();
    const pointA0 = CurveCurveCloseApproachXY._workPointAA0;
    const pointA1 = CurveCurveCloseApproachXY._workPointAA1;
    const pointB0 = CurveCurveCloseApproachXY._workPointBB0;
    const pointB1 = CurveCurveCloseApproachXY._workPointBB1;
    const numA = lsA.numPoints();
    const numB = lsB.numPoints();
    if (numA > 1 && numB > 1) {
      const dfA = 1.0 / (numA - 1);
      const dfB = 1.0 / (numB - 1);
      let fA0 = 0.0;
      let fA1, fB0, fB1;
      lsA.pointAt(0, pointA0);
      for (let ia = 1; ia < numA; ia++, pointA0.setFrom(pointA1), fA0 = fA1) {
        fA1 = ia * dfA;
        fB0 = 0.0;
        lsA.pointAt(ia, pointA1);
        // rangeA1 is around line segment [A0,A1] expanded by max distance
        rangeA1.setNull();
        rangeA1.extendPoint(pointA0);
        rangeA1.extendPoint(pointA1);
        rangeA1.expandInPlace(this._maxDistanceToAccept!);
        if (rangeA1.intersectsRangeXY(rangeB)) {
          lsB.pointAt(0, pointB0);
          bitB0 = this.classifyBitsPointRangeXY(pointB0.x, pointB0.y, rangeA1);
          for (let ib = 1; ib < numB; ib++, pointB0.setFrom(pointB1), fB0 = fB1, bitB0 = bitB1) {
            lsB.pointAt(ib, pointB1);
            bitB1 = this.classifyBitsPointRangeXY(pointB1.x, pointB1.y, rangeA1);
            fB1 = ib * dfB;
            // DO NOT study the segment in detail if both bitB bits are on for any of the 4 planes
            // (i.e., no intersection between rangeA1 and the range around line segment [B0,B1])
            if ((bitB0 & bitB1) === 0)
              this.dispatchSegmentSegment(lsA, pointA0, fA0, pointA1, fA1, lsB, pointB0, fB0, pointB1, fB1, reversed);
          }
        }
      }
    }
  }
  /** Double dispatch handler for strongly typed linestring. */
  public override handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineString3d) {
      const lsB = this._geometryB;
      this.computeLineStringLineString(lsA, lsB, false);
    } else if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentLineString(this._geometryB, lsA, true);
    } else if (this._geometryB instanceof Arc3d) {
      this.computeArcLineString(this._geometryB, lsA, true);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchLineStringBSplineCurve(lsA, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(lsA, this.handleLineString3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(lsA, this.handleLineString3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed arc. */
  public override handleArc3d(arc0: Arc3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentArc(
        this._geometryB, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, arc0, true,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.computeArcLineString(arc0, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcArc(arc0, this._geometryB, false);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchArcBsplineCurve3d(arc0, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(arc0, this.handleArc3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(arc0, this.handleArc3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed bspline curve. */
  public override handleBSplineCurve3d(curve: BSplineCurve3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentBsplineCurve(this._geometryB, curve, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.dispatchLineStringBSplineCurve(this._geometryB, curve, true);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcBsplineCurve3d(this._geometryB, curve, true);
    } else if (this._geometryB instanceof BSplineCurve3dBase) {
      this.dispatchBSplineCurve3dBSplineCurve3d(curve, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(curve, this.handleBSplineCurve3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(curve, this.handleBSplineCurve3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed CurveChainWithDistanceIndex. */
  public override handleCurveChainWithDistanceIndex(chain: CurveChainWithDistanceIndex): any {
    super.handleCurveChainWithDistanceIndex(chain);
    // if _geometryB is also a CurveChainWithDistanceIndex, it will already have been converted by dispatchCurveChainWithDistanceIndex
    this._results = CurveChainWithDistanceIndex.convertChildDetailToChainDetail(this._results, 0, chain, undefined, true);
  }
  /** Double dispatch handler for strongly typed homogeneous bspline curve .. */
  public override handleBSplineCurve3dH(_curve: BSplineCurve3dH): any {
    /*
    //NEEDS WORK -- make "dispatch" methods tolerant of both 3d and 3dH.
    // "easy" if both present BezierCurve3dH span loaders
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
