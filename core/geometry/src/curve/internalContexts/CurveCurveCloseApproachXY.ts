/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert, DuplicatePolicy, SortedArray } from "@itwin/core-bentley";
import { BSplineCurve3d, BSplineCurve3dBase } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Geometry } from "../../Geometry";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { GrowableFloat64Array } from "../../geometry3d/GrowableFloat64Array";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { CurveCurveCloseApproachXYRRtoRRD, Newton2dUnboundedWithDerivative } from "../../numerics/Newton";
import { AnalyticRoots } from "../../numerics/Polynomials";
import { SmallSystem } from "../../numerics/SmallSystem";
import { Arc3d } from "../Arc3d";
import { CurveChainWithDistanceIndex } from "../CurveChainWithDistanceIndex";
import { CurveCollection } from "../CurveCollection";
import { CurveCurve } from "../CurveCurve";
import { CurveIntervalRole, CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { AnyCurve } from "../CurveTypes";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { ProxyCurve } from "../ProxyCurve";
import { TransitionSpiral3d } from "../spiral/TransitionSpiral3d";
import { StrokeOptions } from "../StrokeOptions";

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
  /**
   * Maximum XY distance (z is ignored). Approach larger than this is not interesting.
   * This is caller defined and can be undefined.
   */
  private _maxDistanceToAccept: number | undefined;
  /** Squared max distance. Default is [[Geometry.smallMetricDistanceSquared]]. */
  private _maxDistanceSquared: number;
  private _xyTolerance: number;
  private _newtonTolerance: number;
  /**
   * Start and end points of line segments that meet closest approach criteria, i.e., they are perpendicular to
   * both curves and their length is smaller than _maxDistanceToAccept.
   */
  private _results: SortedArray<CurveLocationDetailPair>;

  private static _workPointAA0 = Point3d.create();
  private static _workPointAA1 = Point3d.create();
  private static _workPointBB0 = Point3d.create();
  private static _workPointBB1 = Point3d.create();
  private static _workPointB = Point3d.create();

  /**
   * Constructor.
   * @param geometryB second curve for intersection. Saved for reference by specific handler methods.
   * @param xyTolerance optional tolerance for comparing xy points (default [[Geometry.smallMetricDistance]]).
   * @param newtonTolerance optional relative fraction tolerance for Newton iteration (default [[Geometry.smallNewtonStep]]).
   */
  public constructor(geometryB?: AnyCurve, xyTolerance: number = Geometry.smallMetricDistance, newtonTolerance: number = Geometry.smallNewtonStep) {
    super();
    this._geometryB = geometryB instanceof ProxyCurve ? geometryB.proxyCurve : geometryB;
    this._maxDistanceSquared = Geometry.smallMetricDistanceSquared;
    this._xyTolerance = xyTolerance;
    this._newtonTolerance = newtonTolerance;
    const compare = CurveLocationDetailPair.comparePairsByPoints(xyTolerance, true);
    this._results = new SortedArray<CurveLocationDetailPair>(compare, DuplicatePolicy.Retain);
  }
  /** Set the (possibly undefined) max XY distance (z is ignored) to accept. */
  public set maxDistanceToAccept(value: number | undefined) {
    if (value === undefined) {
      this._maxDistanceToAccept = undefined;
      this._maxDistanceSquared = Geometry.smallMetricDistanceSquared;
    } else {
      this._maxDistanceToAccept = Math.abs(value);
      this._maxDistanceSquared = value * value;
    }
  }
  /** Access the (possibly undefined) max XY distance (z is ignored) to accept. */
  public get maxDistanceToAccept(): number | undefined {
    return this._maxDistanceToAccept;
  }
  /** Ask if the maxDistanceToAccept value is defined and positive */
  public get isMaxDistanceSet(): boolean {
    return this._maxDistanceToAccept !== undefined && this._maxDistanceToAccept > 0;
  }
  /**
   * Reset the geometry.
   * * Undefined inputs are ignored.
   * * All other instance data is unchanged, including accumulated intersections.
   */
  public resetGeometry(geometryB?: AnyCurve) {
    if (geometryB)
      this._geometryB = geometryB;
  }
  /** returns true if `fraction` is in [0,1] within tolerance */
  private acceptFraction(fraction: number, fractionTol: number = 1.0e-12) {
    if (fraction < -fractionTol)
      return false;
    if (fraction > 1.0 + fractionTol)
      return false;
    return true;
  }
  /** Extract (and clear) the results, structured as an array of CurveLocationDetailPair. */
  public grabPairedResults(): CurveLocationDetailPair[] {
    return this._results.extractArray();
  }
  /**
   * Create and record a close-approach pair from raw curve/fraction/point data.
   * * If points are undefined, they are computed from the fractions via `fractionToPoint`.
   * * Fractions are global (i.e., relative to the full curve, not a sub-segment).
   * * The pair is recorded only if the XY distance is within `_maxDistanceSquared`.
   * @param cpA first curve
   * @param fA global fraction on cpA
   * @param pointA point on cpA at fA, or undefined to compute from fA
   * @param cpB second curve
   * @param fB global fraction on cpB
   * @param pointB point on cpB at fB, or undefined to compute from fB
   * @param reversed if true, swap detailA and detailB before recording
   */
  private testAndRecordPointPair(
    cpA: CurvePrimitive, fA: number, pointA: Point3d | undefined,
    cpB: CurvePrimitive, fB: number, pointB: Point3d | undefined,
    reversed: boolean
  ): void {
    if (!pointA)
      pointA = cpA.fractionToPoint(fA);
    if (!pointB)
      pointB = cpB.fractionToPoint(fB);
    const d2 = pointA.distanceSquaredXY(pointB);
    if (d2 <= this._maxDistanceSquared) {
      const d = Math.sqrt(d2);
      const detailA = CurveLocationDetail.createCurveFractionPointDistance(cpA, fA, pointA, d);
      const detailB = CurveLocationDetail.createCurveFractionPointDistance(cpB, fB, pointB, d);
      detailA.setIntervalRole(CurveIntervalRole.isolated);
      detailB.setIntervalRole(CurveIntervalRole.isolated);
      const pair = CurveLocationDetailPair.createCapture(detailA, detailB);
      if (reversed)
        pair.swapDetails();
      this._results.insert(pair);
    }
  }
  /**
   * Record a pre-built close-approach pair with global fractions already set.
   * * Computes and stores the XY distance on both details.
   * * The pair is recorded only if the XY distance is within `_maxDistanceSquared`.
   * @param pair details with global fractions and points already set; modified in place
   * @param reversed if true, swap detailA and detailB before recording
   */
  private testAndRecordPair(pair: CurveLocationDetailPair, reversed: boolean) {
    const d2 = pair.detailA.point.distanceSquaredXY(pair.detailB.point);
    if (d2 > this._maxDistanceSquared)
      return;
    const d = Math.sqrt(d2);
    pair.detailA.a = pair.detailB.a = d;
    pair.detailA.setIntervalRole(CurveIntervalRole.isolated);
    pair.detailB.setIntervalRole(CurveIntervalRole.isolated);
    if (reversed)
      pair.swapDetails();
    this._results.insert(pair);
  }
  /**
   * Convert a close-approach pair from local (sub-segment) fractions to global fractions, then record it.
   * * Local fractions in the pair are interpolated into the global fraction ranges.
   * * Points are recomputed from the parent curves at the global fractions.
   * * The pair is recorded only if the XY distance is within `_maxDistanceSquared`.
   * @param pair local details (curve unspecified); modified in place with global fractions, curves, and points
   * @param cpA parent curve A
   * @param fractionA0 global fraction corresponding to local fraction 0 on curve A
   * @param fractionA1 global fraction corresponding to local fraction 1 on curve A
   * @param cpB parent curve B
   * @param fractionB0 global fraction corresponding to local fraction 0 on curve B
   * @param fractionB1 global fraction corresponding to local fraction 1 on curve B
   * @param reversed if true, swap detailA and detailB before recording
   */
  private testAndRecordLocalPair(
    pair: CurveLocationDetailPair,
    cpA: CurvePrimitive, fractionA0: number, fractionA1: number,
    cpB: CurvePrimitive, fractionB0: number, fractionB1: number,
    reversed: boolean,
  ) {
    const globalFractionA = Geometry.interpolate(fractionA0, pair.detailA.fraction, fractionA1);
    const globalFractionB = Geometry.interpolate(fractionB0, pair.detailB.fraction, fractionB1);
    const pointA = cpA.fractionToPoint(globalFractionA);
    const pointB = cpB.fractionToPoint(globalFractionB);
    const d2 = pointA.distanceSquaredXY(pointB);
    if (d2 > this._maxDistanceSquared)
      return;
    const d = Math.sqrt(d2);
    CurveLocationDetail.createCurveFractionPointDistance(cpA, globalFractionA, pointA, d, pair.detailA);
    CurveLocationDetail.createCurveFractionPointDistance(cpB, globalFractionB, pointB, d, pair.detailB);
    pair.detailA.setIntervalRole(CurveIntervalRole.isolated);
    pair.detailB.setIntervalRole(CurveIntervalRole.isolated);
    if (reversed)
      pair.swapDetails();
    this._results.insert(pair);
  }
  /** Modify the current closest approach if the inputs are closer. */
  private static updatePointToSegmentDistance(
    closestApproach: CurveLocationDetailPair,
    fractionA: number, pointA: Point3d,
    fractionB: number, pointB0: Point3d, pointB1: Point3d,
    maxDistanceSquared: number,
  ): boolean {
    let updated = false;
    if (fractionB < 0)
      fractionB = 0;
    else if (fractionB > 1)
      fractionB = 1;
    const pointB = pointB0.interpolate(fractionB, pointB1, this._workPointB);
    const distanceSquared = pointB.distanceSquaredXY(pointA);
    if (distanceSquared <= Math.min(maxDistanceSquared, closestApproach.detailA.a)) {
      closestApproach.detailA.setFP(fractionA, pointA, undefined, distanceSquared);
      closestApproach.detailB.setFP(fractionB, pointB, undefined, distanceSquared);
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
   * @returns a pair of details for the closest approach, or `undefined` if no approach is within `maxDistanceSquared`.
    * `detailA.fraction` is the fraction on segment a; `detailB.fraction` is the fraction on segment b. Returned
    * details store the *squared* distance in the `a` property.
   */
  private static segmentSegmentBoundedApproach(
    a0: Point3d, a1: Point3d,
    b0: Point3d, b1: Point3d,
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
      const fractionA = Geometry.safeDivideFraction(Geometry.dotProductXYXY(ux, uy, e00x, e00y), uu, 0.0);
      if (this.updatePointToSegmentDistance(closestApproach, 0, b0, fractionA, a0, a1, maxDistanceSquared))
        reversed = true;
    }
    if (hab1 * hab1 <= maxDistanceSquared * uu) { // test distance of b1 to u
      const fractionA = Geometry.safeDivideFraction(Geometry.dotProductXYXY(ux, uy, e01x, e01y), uu, 0.0);
      if (this.updatePointToSegmentDistance(closestApproach, 1, b1, fractionA, a0, a1, maxDistanceSquared))
        reversed = true;
    }
    const vv = Geometry.hypotenuseSquaredXY(vx, vy);
    if (hba0 * hba0 <= maxDistanceSquared * vv) { // test distance of a0 to v
      const fractionB = Geometry.safeDivideFraction(-Geometry.dotProductXYXY(vx, vy, e00x, e00y), vv, 0.0);
      if (this.updatePointToSegmentDistance(closestApproach, 0, a0, fractionB, b0, b1, maxDistanceSquared))
        reversed = false;
    }
    if (hba1 * hba1 <= maxDistanceSquared * vv) { // test distance of a1 to v
      const fractionB = Geometry.safeDivideFraction(-Geometry.dotProductXYXY(vx, vy, e10x, e10y), vv, 0.0);
      if (this.updatePointToSegmentDistance(closestApproach, 1, a1, fractionB, b0, b1, maxDistanceSquared))
        reversed = false;
    }
    if (closestApproach.detailA.a > maxDistanceSquared)
      return undefined;
    if (reversed)
      closestApproach.swapDetails();
    return closestApproach;
  }
  /**
   * Compute closest approaches from the endpoints of each curve (if open) to the other curve.
   * Record a [[CurveLocationDetailPair]] if such a distance is less than [[maxDistance]].
   * @param cpA curveA
   * @param cpB curveB
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to curveA).
   */
  private testAndRecordEndPointApproaches(cpA: CurvePrimitive, cpB: CurvePrimitive, reversed: boolean): void {
    const pt = CurveCurveCloseApproachXY._workPointB;
    // in closest approach context, endpoints of full sweep arcs are artificial locations, and thus ignored
    const isClosedArc = (curve: CurvePrimitive) => curve instanceof Arc3d && curve.sweep.isFullCircle;
    if (!isClosedArc(cpA)) {
      this.testAndRecordProjection(cpA, 0, cpA.startPoint(pt), cpB, reversed);
      this.testAndRecordProjection(cpA, 1, cpA.endPoint(pt), cpB, reversed);
    }
    if (!isClosedArc(cpB)) {
      this.testAndRecordProjection(cpB, 0, cpB.startPoint(pt), cpA, !reversed);
      this.testAndRecordProjection(cpB, 1, cpB.endPoint(pt), cpA, !reversed);
    }
  }
  /** Find the closest xy approach between `pointA` and `cpB`. */
  private testAndRecordProjection(cpA: CurvePrimitive, fA: number, pointA: Point3d, cpB: CurvePrimitive, reversed: boolean): void {
    const detail = cpB.closestPointXY(pointA);
    if (detail)
      this.testAndRecordPointPair(cpA, fA, pointA, cpB, detail.fraction, detail.point, reversed);
  }
  /**
   * Compute closest xy approach of two line segments.
   * Filter by extension rules.
   * Record with fraction mapping.
   * * The fraction mappings allow portions of a linestring to be passed here.
   */
  private computeSegmentSegment(
    cpA: CurvePrimitive, pointA0: Point3d, fractionA0: number, pointA1: Point3d, fractionA1: number,
    cpB: CurvePrimitive, pointB0: Point3d, fractionB0: number, pointB1: Point3d, fractionB1: number,
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
      this.testAndRecordLocalPair(approach, cpA, fractionA0, fractionA1, cpB, fractionB0, fractionB1, reversed);
    }
  }
  /**
   * Compute the perpendiculars between a line segment and an arc, without extending either curve.
   * * One or two perpendiculars will be found.
   * * Each perpendicular segment starts or ends on the arc where the arc tangent is parallel to the line tangent.
   * @param startA line segment start point
   * @param endA line segment end point
   * @param arcB the arc
   * @param announce callback to receive line and arc fractions and optional points of each perpendicular segment computed.
   */
  private announceAllPerpendicularsSegmentArcBounded(
    startA: Point3d, endA: Point3d, arcB: Arc3d,
    announce: (lineFraction: number, linePoint: Point3d | undefined, arcFraction: number, arcPoint: Point3d | undefined) => void,
  ): void {
    const dotUT = arcB.vector0.crossProductStartEndXY(startA, endA);
    const dotVT = arcB.vector90.crossProductStartEndXY(startA, endA);
    const parallelRadians = Math.atan2(dotVT, dotUT);
    for (const radians1 of [parallelRadians, parallelRadians + Math.PI]) {
      const arcPoint = arcB.radiansToPoint(radians1);
      const arcFraction = arcB.sweep.radiansToSignedPeriodicFraction(radians1);
      if (this.acceptFraction(arcFraction)) { // reject solution outside arc sweep
        const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(startA, endA, arcPoint);
        if (lineFraction !== undefined && this.acceptFraction(lineFraction))
          announce(lineFraction, undefined, arcFraction, arcPoint);
      }
    }
  }
  /**
   * Find close approaches within maxDistance between a line segment and an arc.
   * To consider:
   * 1) intersection between arc and segment.
   * 2) endpoints to endpoints, or endpoints projection to the other curve.
   * 3) arc tangent parallel to line segment
   * @param lineA the line segment
   * @param arcB the arc
   * @param reversed whether to reverse the details in the pair (e.g., so that detailB refers to arcA).
   */
  private computeSegmentArc(lineA: LineSegment3d, arcB: Arc3d, reversed: boolean): void {
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
    const data = arcB.toTransformedVectors();
    const alpha = Geometry.tripleProductXYW(lineA.point0Ref, 1, lineA.point1Ref, 1, data.center, 1); //  det(A0, A1, C)
    const beta = Geometry.tripleProductXYW(lineA.point0Ref, 1, lineA.point1Ref, 1, data.vector0, 0); // det(A0, A1, U)
    const gamma = Geometry.tripleProductXYW(lineA.point0Ref, 1, lineA.point1Ref, 1, data.vector90, 0); // det(A0, A1, V)
    const cosines = new GrowableFloat64Array(2);
    const sines = new GrowableFloat64Array(2);
    const radians = new GrowableFloat64Array(2);
    const numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians);
    for (let i = 0; i < numRoots; i++) {
      const arcPoint = data.center.plus2Scaled(data.vector0, cosines.atUncheckedIndex(i), data.vector90, sines.atUncheckedIndex(i));
      const arcFraction = data.sweep.radiansToSignedPeriodicFraction(radians.atUncheckedIndex(i));
      if (this.acceptFraction(arcFraction)) { // reject solution outside arc sweep
        const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(lineA.point0Ref, lineA.point1Ref, arcPoint);
        if (lineFraction !== undefined && this.acceptFraction(lineFraction)) {
          this.testAndRecordPointPair(lineA, lineFraction, undefined, arcB, arcFraction, arcPoint, reversed);
          intersectionFound = true;
        }
      }
    }
    if (intersectionFound)
      return;
    // 2) endpoints to endpoints, or endpoints projection to the other curve.
    this.testAndRecordEndPointApproaches(lineA, arcB, reversed);
    // 3) arc tangent parallel to line segment.
    // If line does not intersect the arc, then the closest (and/or the furthest) point on arc to the line is a
    // point where the tangent line on arc at that point is parallel to the line.
    this.announceAllPerpendicularsSegmentArcBounded(lineA.point0Ref, lineA.point1Ref, arcB,
      (lineFraction: number, linePoint: Point3d | undefined, arcFraction: number, arcPoint: Point3d | undefined) =>
        this.testAndRecordPointPair(lineA, lineFraction, linePoint, arcB, arcFraction, arcPoint, reversed),
    );
  }
  /**
   * Compute segments perpendicular to two elliptical arcs, without extending either curve.
   * * Perpendiculars from an endpoint are not explicitly computed.
   * * Intersections are also found by this search: they are reported as zero-length segments.
   * @param arcA first arc
   * @param arcB second arc
   * @param reversed swap the details in the recorded pair (default: false)
   */
  public allPerpendicularsArcArcBounded(arcA: Arc3d, arcB: Arc3d, reversed: boolean = false): void {
    const newtonEvaluator = new CurveCurveCloseApproachXYRRtoRRD(arcA, arcB);
    // HEURISTIC: 2 ellipses have up to 8 perpendiculars
    const seedDelta = 1 / 10; // denominator 9 fails the unit test
    const seedStart = seedDelta / 2;
    const newtonSearcher = new Newton2dUnboundedWithDerivative(newtonEvaluator, 100); // observed convergence to 1.0e-11 in 49 iters
    for (let seedU = seedStart; seedU < 1; seedU += seedDelta) {
      for (let seedV = seedStart; seedV < 1; seedV += seedDelta) {
        newtonSearcher.setUV(seedU, seedV);
        if (newtonSearcher.runIterations()) {
          const fractionA = newtonSearcher.getU();
          const fractionB = newtonSearcher.getV();
          if (this.acceptFraction(fractionA) && this.acceptFraction(fractionB)) {
            this.testAndRecordPointPair(arcA, fractionA, undefined, arcB, fractionB, undefined, reversed);
          }
        }
      }
    }
  }
  /** Low level dispatch of arc with Arc3d. */
  private dispatchArcArc(cpA: Arc3d, cpB: Arc3d, reversed: boolean): void {
    const rangeA = cpA.range();
    const rangeB = cpB.range();
    if (this._maxDistanceToAccept)
      rangeA.expandInPlace(this._maxDistanceToAccept);
    if (!rangeB.intersectsRangeXY(rangeA))
      return;
    // 1) endpoints to endpoints or endpoints projection to the other curve
    this.testAndRecordEndPointApproaches(cpA, cpB, reversed);
    // 2) perpendicular line between 2 arcs (includes intersections)
    this.allPerpendicularsArcArcBounded(cpA, cpB, reversed);
  }
  /** Detail computation for segment approaching linestring. */
  private computeSegmentLineString(segA: LineSegment3d, lsB: LineString3d, reversed: boolean): void {
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
      this.computeSegmentSegment(segA, pointA0, 0.0, pointA1, 1.0, lsB, pointB0, fB0, pointB1, fB1, reversed);
    }
  }
  /** Detail computation for arc approaching linestring. */
  private computeArcLineString(arcA: Arc3d, lsB: LineString3d, reversed: boolean): void {
    const rangeA = arcA.range();
    const rangeB = lsB.range();
    if (this._maxDistanceToAccept)
      rangeA.expandInPlace(this._maxDistanceToAccept);
    if (!rangeB.intersectsRangeXY(rangeA))
      return;
    const v0 = CurveCurveCloseApproachXY._workPointBB0;
    const v1 = CurveCurveCloseApproachXY._workPointBB1;
    // 1. record intersections
    const intersections = CurveCurve.intersectionXYPairs(arcA, false, lsB, false, this._xyTolerance);
    for (const intersection of intersections)
      this.testAndRecordPair(intersection, reversed);
    // 2. record linestring interior vertex projections onto arc
    const fStep = Geometry.safeDivideFraction(1.0, lsB.numEdges(), 0);
    for (let i = 1; i < lsB.numEdges(); ++i)
      this.testAndRecordProjection(lsB, i * fStep, lsB.pointAtUnchecked(i, v0), arcA, !reversed);
    // 3. record arc/linestring endpoint projections onto linestring/arc
    this.testAndRecordEndPointApproaches(arcA, lsB, reversed);
    // 4. record perpendiculars from within a segment to the arc
    lsB.startPoint(v0);
    for (let iSeg = 0; iSeg < lsB.numEdges(); ++iSeg, v0.setFrom(v1)) {
      lsB.pointAtUnchecked(iSeg + 1, v1);
      this.announceAllPerpendicularsSegmentArcBounded(v0, v1, arcA,
        (lineFraction: number, linePoint: Point3d | undefined, arcFraction: number, arcPoint: Point3d | undefined) => {
          const fLineString = lsB.segmentIndexAndLocalFractionToGlobalFraction(iSeg, lineFraction);
          this.testAndRecordPointPair(arcA, arcFraction, arcPoint, lsB, fLineString, linePoint, reversed);
        },
      );
    }
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
    if (this._maxDistanceToAccept)
      rangeA.expandInPlace(this._maxDistanceToAccept);
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
        if (this._maxDistanceToAccept)
          rangeA1.expandInPlace(this._maxDistanceToAccept);
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
              this.computeSegmentSegment(lsA, pointA0, fA0, pointA1, fA1, lsB, pointB0, fB0, pointB1, fB1, reversed);
          }
        }
      }
    }
  }
  /** Low level dispatch of curve collection. */
  private dispatchCurveCollection(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    const geomB = this._geometryB; // save
    if (!geomB || !geomB.children || !(geomB instanceof CurveCollection))
      return;
    for (const child of geomB.children) {
      this.resetGeometry(child);
      geomAHandler(geomA);
    }
    this._geometryB = geomB; // restore
  }
  /** Low level dispatch to geomA given a CurveChainWithDistanceIndex in geometryB. */
  private dispatchCurveChainWithDistanceIndex(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    if (!this._geometryB || !(this._geometryB instanceof CurveChainWithDistanceIndex))
      return;
    if (geomA instanceof CurveChainWithDistanceIndex)
      assert(false, "call handleCurveChainWithDistanceIndex(geomA) instead");
    const saveResults = this.grabPairedResults();
    const geomB = this._geometryB;
    for (const child of geomB.path.children) {
      this.resetGeometry(child);
      geomAHandler(geomA);
    }
    this.resetGeometry(geomB);
    const childResults = this._results.extractArray();
    childResults.forEach((pair: CurveLocationDetailPair) => {
      CurveChainWithDistanceIndex.convertChildDetailToChainDetailSingle(pair, undefined, geomB);
      this._results.insert(pair);
    });
    saveResults.forEach((pair: CurveLocationDetailPair) => this._results.insert(pair));
  }
  /** Specifies whether the curve needs to be stroked for close approach computation. */
  private needsStroking(curve?: AnyCurve): curve is BSplineCurve3dBase | TransitionSpiral3d {
    return curve instanceof BSplineCurve3dBase || curve instanceof TransitionSpiral3d;
  }
  /**
   * Process seeds for xy close approach between one curve and another curve to be stroked.
   * * Refine each result via Newton iteration. If it doesn't converge, remove it.
   * @param seeds the initial seed results to refine.
   * @param curveA curve to find its XY close approach with curveB.
   * @param curveB the other curve to be stroked.
   * @param reversed whether `curveB` data is in `detailA` of each recorded pair, and `curveA` data in `detailB`.
   */
  private refineStrokedResultsByNewton(
    seeds: CurveLocationDetailPair[], curveA: CurvePrimitive, curveB: CurvePrimitive, reversed = false
  ): void {
    const xyMatchingFunction = new CurveCurveCloseApproachXYRRtoRRD(curveA, curveB);
    const newtonSearcher = new Newton2dUnboundedWithDerivative(xyMatchingFunction, 50, this._newtonTolerance); // seen: 47
    for (const seed of seeds) {
      const detailA = reversed ? seed.detailB : seed.detailA;
      const detailB = reversed ? seed.detailA : seed.detailB;
      assert(detailB.curve instanceof LineString3d, "Caller has discretized the curve");
      newtonSearcher.setUV(detailA.fraction, detailB.fraction); // use the linestring fraction as initial curveB fraction (ASSUME it's close enough)
      if (newtonSearcher.runIterations()) {
        const fractionA = newtonSearcher.getU();
        const fractionB = newtonSearcher.getV();
        if (this.acceptFraction(fractionA) && this.acceptFraction(fractionB))
          this.testAndRecordPointPair(curveA, fractionA, undefined, curveB, fractionB, undefined, reversed);
      } // ignore failure to converge
    }
  }
  /**
   * Append stroke points and return the line string.
   * * This is a convenient wrapper for [[CurvePrimitive.emitStrokes]] but the analogous instance method cannot be added
   * to that class due to the ensuing recursion with subclass [[LineString3d]].
   * @param options options for stroking the instance curve.
   * @param result object to receive appended stroke points; if omitted, a new object is created, populated, and returned.
   */
  private strokeCurve(curve: CurvePrimitive, options?: StrokeOptions, result?: LineString3d): LineString3d {
    const ls = result ? result : LineString3d.create();
    curve.emitStrokes(ls, options);
    return ls;
  }
  /** Find and return the close approaches between curveA and the discretization of curveB. */
  private computeDiscreteCloseApproachResults(curveA: CurvePrimitive, lsB: LineString3d, reversed: boolean): CurveLocationDetailPair[] {
    const maxDist = this.maxDistanceToAccept;
    const saveResults = this.grabPairedResults(); // save current results
    const geomB = this._geometryB;
    this.maxDistanceToAccept = maxDist ? maxDist * 1.2 : undefined; // HEURISTIC: allow slack for Newton seeds
    this.resetGeometry(curveA);
    this.handleLineString3d(lsB); // populate empty results with discrete solutions
    if (!reversed) {
      // handleLineString3d put lsB data into detailA, so if we aren't reversing, we need to swap
      for (const result of this._results)
        result.swapDetails();
    }
    this.resetGeometry(geomB);
    this.maxDistanceToAccept = maxDist;
    const discreteResults = this._results.extractArray();
    saveResults.forEach((pair: CurveLocationDetailPair) => this._results.insert(pair)); // restore current results
    return discreteResults;
  }
  /**
   * Compute the XY close approach of a curve and another curve to be stroked.
   * @param curveA curve to find its XY close approach with curveB.
   * @param curveB the other curve to be stroked.
   * @param reversed whether `curveB` data will be recorded in `detailA` of each result, and `curveA` data in `detailB`.
   */
  private dispatchCurveStrokedCurve(curveA: CurvePrimitive, curveB: CurvePrimitive, reversed: boolean): void {
    // explicit search for intersections (Newton converges too slowly on DirectSpiral3d tangent intersections)
    const intersections = CurveCurve.intersectionXYPairs(curveA, false, curveB, false, this._xyTolerance);
    for (const intersection of intersections)
      this.testAndRecordPair(intersection, reversed);
    // append seeds computed by solving the discretized spiral close approach problem, then refine the seeds via Newton
    let cpA = curveA;
    if (this.needsStroking(curveA))
      cpA = this.strokeCurve(curveA);
    const cpB = this.strokeCurve(curveB);
    const seeds = this.computeDiscreteCloseApproachResults(cpA, cpB, reversed);
    this.refineStrokedResultsByNewton(seeds, curveA, curveB, reversed);
    if (curveA instanceof LineString3d) { // explicitly test corners (where Newton converges too slowly)
      const fStep = Geometry.safeDivideFraction(1.0, curveA.numEdges(), 0);
      const v0 = CurveCurveCloseApproachXY._workPointBB0;
      for (let i = 1; i < curveA.numEdges(); ++i)
        this.testAndRecordProjection(curveA, i * fStep, curveA.pointAtUnchecked(i, v0), curveB, reversed);
    }
    this.testAndRecordEndPointApproaches(curveA, curveB, reversed);
  }
  /** Double dispatch handler for strongly typed segment. */
  public override handleLineSegment3d(segmentA: LineSegment3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      const segmentB = this._geometryB;
      this.computeSegmentSegment(
        segmentA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0,
        segmentB, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0,
        false,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.computeSegmentLineString(segmentA, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.computeSegmentArc(segmentA, this._geometryB, false);
    } else if (this.needsStroking(this._geometryB)) {
      this.dispatchCurveStrokedCurve(segmentA, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(segmentA, this.handleLineSegment3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(segmentA, this.handleLineSegment3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed linestring. */
  public override handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentLineString(this._geometryB, lsA, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.computeLineStringLineString(lsA, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.computeArcLineString(this._geometryB, lsA, true);
    } else if (this.needsStroking(this._geometryB)) {
      this.dispatchCurveStrokedCurve(lsA, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(lsA, this.handleLineString3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(lsA, this.handleLineString3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed arc. */
  public override handleArc3d(arcA: Arc3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentArc(this._geometryB, arcA, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.computeArcLineString(arcA, this._geometryB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcArc(arcA, this._geometryB, false);
    } else if (this.needsStroking(this._geometryB)) {
      this.dispatchCurveStrokedCurve(arcA, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(arcA, this.handleArc3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(arcA, this.handleArc3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed bspline curve. */
  public override handleBSplineCurve3d(curveA: BSplineCurve3d): any {
    if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(curveA, this.handleBSplineCurve3d.bind(this));
    } else if (this._geometryB instanceof CurvePrimitive) {
      this.dispatchCurveStrokedCurve(this._geometryB, curveA, true);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(curveA, this.handleBSplineCurve3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed spiral curve. */
  public override handleTransitionSpiral(spiral: TransitionSpiral3d): any {
    if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(spiral, this.handleTransitionSpiral.bind(this));
    } else if (this._geometryB instanceof CurvePrimitive) {
      this.dispatchCurveStrokedCurve(this._geometryB, spiral, true);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(spiral, this.handleTransitionSpiral.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed CurveChainWithDistanceIndex. */
  public override handleCurveChainWithDistanceIndex(chain: CurveChainWithDistanceIndex): any {
    super.handleCurveChainWithDistanceIndex(chain);
    // if _geometryB is also a CurveChainWithDistanceIndex, it will already have been converted by dispatchCurveChainWithDistanceIndex
    const childResults = this._results.extractArray();
    childResults.forEach((pair: CurveLocationDetailPair) => {
      CurveChainWithDistanceIndex.convertChildDetailToChainDetailSingle(pair, chain, undefined);
      this._results.insert(pair);
    });
  }
  /** Double dispatch handler for strongly typed homogeneous bspline curve .. */
  public override handleBSplineCurve3dH(_curve: BSplineCurve3dH): any {
    // NEEDS WORK -- make "dispatch" methods tolerant of both 3d and 3dH
    return undefined;
  }
}
