/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert, DuplicatePolicy, OrderedComparator, SortedArray } from "@itwin/core-bentley";
import { BezierCurve3dH } from "../../bspline/BezierCurve3dH";
import { BezierCurveBase } from "../../bspline/BezierCurveBase";
import { BSplineCurve3d, BSplineCurve3dBase } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Geometry } from "../../Geometry";
import { CoincidentGeometryQuery } from "../../geometry3d/CoincidentGeometryOps";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { GrowableFloat64Array } from "../../geometry3d/GrowableFloat64Array";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { XYAndZ } from "../../geometry3d/XYZProps";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Point4d } from "../../geometry4d/Point4d";
import { UnivariateBezier } from "../../numerics/BezierPolynomials";
import { CurveCurveIntersectionXYRRToRRD, Newton2dUnboundedWithDerivative } from "../../numerics/Newton";
import { AnalyticRoots, TrigPolynomial } from "../../numerics/Polynomials";
import { SmallSystem } from "../../numerics/SmallSystem";
import { Arc3d } from "../Arc3d";
import { CurveChainWithDistanceIndex } from "../CurveChainWithDistanceIndex";
import { CurveCollection } from "../CurveCollection";
import { CurveCurve } from "../CurveCurve";
import { CurveIntervalRole, CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { AnyCurve } from "../CurveTypes";
import { GeometryQuery } from "../GeometryQuery";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop } from "../Loop";
import { Path } from "../Path";
import { ProxyCurve } from "../ProxyCurve";
import { TransitionSpiral3d } from "../spiral/TransitionSpiral3d";
import { StrokeOptions } from "../StrokeOptions";

// cspell:word XYRR
/**
 * Handler class for XY intersections between _geometryB and another geometry.
 * * Instances are initialized and called from CurveCurve.
 * * geometryB is saved for later reference.
 * @internal
 */
export class CurveCurveIntersectXY extends RecurseToCurvesGeometryHandler {
  private _extendA0: boolean;
  private _extendA1: boolean;
  private _geometryB: AnyCurve | undefined;
  private _extendB0: boolean;
  private _extendB1: boolean;
  private _results: CurveLocationDetailPair[];
  private _worldToLocalPerspective: Matrix4d | undefined;
  private _worldToLocalAffine: Transform | undefined;
  private _coincidentGeometryContext: CoincidentGeometryQuery;
  private static _workPointA0H = Point4d.create();
  private static _workPointA1H = Point4d.create();
  private static _workPointB0H = Point4d.create();
  private static _workPointB1H = Point4d.create();
  private static _workPointAA0 = Point3d.create();
  private static _workPointAA1 = Point3d.create();
  private static _workPointBB0 = Point3d.create();
  private static _workPointBB1 = Point3d.create();
  private static _workPointA0 = Point3d.create();
  private static _workPointA1 = Point3d.create();
  private static _workPointB0 = Point3d.create();
  private static _workPointB1 = Point3d.create();
  private _xyzwA0?: Point4d;
  private _xyzwA1?: Point4d;
  private _xyzwPlane?: Point4d;
  private _xyzwB?: Point4d;
  /**
   * The constructor.
   * @param worldToLocal optional transform (possibly perspective) to project to xy plane for intersection.
   * @param extendA flag for extension of the other geometry.
   * @param geometryB second curve for intersection. Saved for reference by specific handler methods.
   * @param extendB flag for extension of geometryB.
   * @param tolerance optional distance tolerance for coincidence.
   */
  public constructor(
    worldToLocal: Matrix4d | undefined,
    extendA: boolean,
    geometryB: AnyCurve | undefined,
    extendB: boolean,
    tolerance: number = Geometry.smallMetricDistance,
  ) {
    super();
    this._extendA0 = extendA;
    this._extendA1 = extendA;
    this._geometryB = geometryB instanceof ProxyCurve ? geometryB.proxyCurve : geometryB;
    this._extendB0 = extendB;
    this._extendB1 = extendB;
    this._worldToLocalPerspective = undefined;
    this._worldToLocalAffine = undefined;
    if (worldToLocal !== undefined && !worldToLocal.isIdentity()) {
      this._worldToLocalAffine = worldToLocal.asTransform;
      if (!this._worldToLocalAffine)
        this._worldToLocalPerspective = worldToLocal.clone();
    }
    this._coincidentGeometryContext = CoincidentGeometryQuery.create(tolerance);
    this._results = [];
  }
  /**
   * Reset geometryA extension flags.
   * * Undefined inputs are ignored.
   * * All other instance data is unchanged, including accumulated intersections.
   */
  public resetGeometryA(extendA0?: boolean, extendA1?: boolean): void {
    if (extendA0 !== undefined)
      this._extendA0 = extendA0;
    if (extendA1 !== undefined)
      this._extendA1 = extendA1;
  }
  /**
   * Reset geometryB and its extension flags.
   * * Undefined inputs are ignored.
   * * All other instance data is unchanged, including accumulated intersections.
   */
  public resetGeometryB(geometryB?: AnyCurve, extendB0?: boolean, extendB1?: boolean): void {
    if (geometryB)
      this._geometryB = geometryB;
    if (extendB0 !== undefined)
      this._extendB0 = extendB0;
    if (extendB1 !== undefined)
      this._extendB1 = extendB1;
  }
  /** Accept the fraction if it falls inside (possibly extended) fraction range. */
  private acceptFraction(extend0: boolean, fraction: number, extend1: boolean, fractionTol: number = 1.0e-12): boolean {
    // Note that default tol is tighter than Geometry.smallFraction. We aggressively toss intersections past endpoints.
    if (!extend0 && fraction < -fractionTol)
      return false;
    if (!extend1 && fraction > 1.0 + fractionTol)
      return false;
    return true;
  }
  /** Test the fraction by strict parameter, but allow toleranced distance test at ends. */
  private acceptFractionOnLine(
    extend0: boolean,
    fraction: number,
    extend1: boolean,
    pointA: Point3d,
    pointB: Point3d,
    tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    if (!extend0 && fraction < 0) {
      return Geometry.isDistanceWithinTol(fraction * pointA.distanceXY(pointB), tolerance);
    } else if (!extend1 && fraction > 1.0)
      return Geometry.isDistanceWithinTol((fraction - 1.0) * pointA.distanceXY(pointB), tolerance);
    return true;
  }
  /**
   * Return the results structure for the intersection calculation, structured as an array of CurveLocationDetailPair
   * @param reinitialize if true, a new results structure is created for use by later calls.
   */
  public grabPairedResults(reinitialize: boolean = false): CurveLocationDetailPair[] {
    const result = this._results;
    if (reinitialize)
      this._results = [];
    return result;
  }
  /**
   * Record the pre-computed intersection between two curves. Filter by extension rules. Record with fraction mapping.
   * @param localFractionA intersection fraction local to the subcurve of cpA between fractionA0 and fractionA1
   * @param cpA the first curve
   * @param fractionA0 start of the subcurve of cpA
   * @param fractionA1 end of the subcurve of cpA
   * @param localFractionB intersection fraction local to the subcurve of cpB between fractionB0 and fractionB1
   * @param cpB the second curve
   * @param fractionB0 start of the subcurve of cpB
   * @param fractionB1 end of the subcurve of cpB
   * @param reversed whether to reverse the details in the recorded intersection pair
   * @param intervalDetails optional data for a coincident segment intersection
   * @param fractionTol relative tolerance for comparing fractions to avoid duplicating the last intersection. Defaults to [[Geometry.smallAngleRadians]].
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
    intervalDetails?: CurveLocationDetailPair,
    fractionTol?: number,
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
    // ignore duplicate of most recent pair
    const numPrevious = this._results.length;
    if (numPrevious > 0 && !isInterval) {
      const oldDetailA = this._results[numPrevious - 1].detailA;
      const oldDetailB = this._results[numPrevious - 1].detailB;
      if (reversed) {
        if (oldDetailB.isSameCurveAndFraction({ curve: cpA, fraction: globalFractionA }, fractionTol) &&
          oldDetailA.isSameCurveAndFraction({ curve: cpB, fraction: globalFractionB }, fractionTol))
          return;
      } else {
        if (oldDetailA.isSameCurveAndFraction({ curve: cpA, fraction: globalFractionA }, fractionTol) &&
          oldDetailB.isSameCurveAndFraction({ curve: cpB, fraction: globalFractionB }, fractionTol))
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
   * Emit recordPoint for multiple pairs (on full curve).
   * @param cpA first curve primitive (possibly different from curve in detailA, but fraction compatible).
   * @param cpB second curve primitive (possibly different from curve in detailA, but fraction compatible).
   * @param pairs array of pairs.
   * @param reversed true to have order reversed in final structures.
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
  /** Compute intersection of two line segments. Filter by extension rules. Record with fraction mapping. */
  private computeSegmentSegment3D(
    cpA: CurvePrimitive,
    extendA0: boolean,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    extendA1: boolean,
    cpB: CurvePrimitive,
    extendB0: boolean,
    pointB0: Point3d,
    fractionB0: number,
    pointB1: Point3d,
    fractionB1: number,
    extendB1: boolean,
    reversed: boolean,
  ): void {
    const aDir = { x: pointA1.x - pointA0.x, y: pointA1.y - pointA0.y };
    const bDir = { x: pointB1.x - pointB0.x, y: pointB1.y - pointB0.y };
    const tol = this._coincidentGeometryContext.tolerance;
    const fractions = SmallSystem.lineSegmentXYUVIntersectionUnbounded(pointA0, aDir, pointB0, bDir, tol);
    if (!fractions)
      return;
    if (fractions.f1) { // the lines are coincident
      const detailA = CurveLocationDetail.createCurveFractionPoint(undefined, fractions.f0.x, pointA0.interpolate(fractions.f0.x, pointA1));
      detailA.captureFraction1Point1(fractions.f1.x, pointA0.interpolate(fractions.f1.x, pointA1));
      const detailB = CurveLocationDetail.createCurveFractionPoint(undefined, fractions.f0.y, pointB0.interpolate(fractions.f0.y, pointB1));
      detailB.captureFraction1Point1(fractions.f1.y, pointB0.interpolate(fractions.f1.y, pointB1));
      const overlap = CurveLocationDetailPair.createCapture(detailA, detailB);
      if (this._coincidentGeometryContext.clampCoincidentOverlapToSegmentBounds(overlap, pointA0, pointA1, pointB0, pointB1, extendA0, extendA1, extendB0, extendB1))
        this.recordPointWithLocalFractions(overlap.detailA.fraction, cpA, fractionA0, fractionA1, overlap.detailB.fraction, cpB, fractionB0, fractionB1, reversed, overlap);
    } else { // the lines have a transverse intersection
      if (this.acceptFractionOnLine(extendA0, fractions.f0.x, extendA1, pointA0, pointA1, tol)) {
        if (this.acceptFractionOnLine(extendB0, fractions.f0.y, extendB1, pointB0, pointB1, tol))
          this.recordPointWithLocalFractions(fractions.f0.x, cpA, fractionA0, fractionA1, fractions.f0.y, cpB, fractionB0, fractionB1, reversed);
      }
    }
  }
  /**
   * Compute intersection of projected homogeneous line segments. Filter by extension rules. Record with
   * fraction mapping. Assumes caller knows the _worldToLocal is present.
   */
  private computeSegmentSegment3DH(
    cpA: CurvePrimitive,
    extendA0: boolean,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    extendA1: boolean,
    cpB: CurvePrimitive,
    extendB0: boolean,
    pointB0: Point3d,
    fractionB0: number,
    pointB1: Point3d,
    fractionB1: number,
    extendB1: boolean,
    reversed: boolean,
  ): void {
    const hA0 = CurveCurveIntersectXY._workPointA0H;
    const hA1 = CurveCurveIntersectXY._workPointA1H;
    const hB0 = CurveCurveIntersectXY._workPointB0H;
    const hB1 = CurveCurveIntersectXY._workPointB1H;
    this._worldToLocalPerspective!.multiplyPoint3d(pointA0, 1, hA0);
    this._worldToLocalPerspective!.multiplyPoint3d(pointA1, 1, hA1);
    this._worldToLocalPerspective!.multiplyPoint3d(pointB0, 1, hB0);
    this._worldToLocalPerspective!.multiplyPoint3d(pointB1, 1, hB1);
    const fractionAB = SmallSystem.lineSegment3dHXYTransverseIntersectionUnbounded(hA0, hA1, hB0, hB1);
    if (fractionAB !== undefined) {
      const fractionA = fractionAB.x;
      const fractionB = fractionAB.y;
      if (this.acceptFraction(extendA0, fractionA, extendA1) && this.acceptFraction(extendB0, fractionB, extendB1)) {
        // final fraction acceptance uses original world points, with perspective-aware fractions
        this.recordPointWithLocalFractions(
          fractionA, cpA, fractionA0, fractionA1, fractionB, cpB, fractionB0, fractionB1, reversed,
        );
      }
    }
  }
  // Caller accesses data from a line segment and passes to here.
  // The line segment in question might be (a) a full line segment or (b) a fragment within a linestring.
  // The fraction and extend parameters allow all combinations to be passed in.
  // This method applies transform.
  private dispatchSegmentSegment(
    cpA: CurvePrimitive,
    extendA0: boolean,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    extendA1: boolean,
    cpB: CurvePrimitive,
    extendB0: boolean,
    pointB0: Point3d,
    fractionB0: number,
    pointB1: Point3d,
    fractionB1: number,
    extendB1: boolean,
    reversed: boolean,
  ): void {
    if (this._worldToLocalAffine) {
      // non-perspective projection
      CurveCurveIntersectXY.setTransformedWorkPoints(this._worldToLocalAffine, pointA0, pointA1, pointB0, pointB1);
      this.computeSegmentSegment3D(
        cpA, extendA0, CurveCurveIntersectXY._workPointA0,
        fractionA0, CurveCurveIntersectXY._workPointA1, fractionA1, extendA1,
        cpB, extendB0, CurveCurveIntersectXY._workPointB0,
        fractionB0, CurveCurveIntersectXY._workPointB1, fractionB1, extendB1,
        reversed,
      );
    } else if (this._worldToLocalPerspective) {
      this.computeSegmentSegment3DH(
        cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1,
        cpB, extendB0, pointB0, fractionB0, pointB1, fractionB1, extendB1,
        reversed,
      );
    } else {
      this.computeSegmentSegment3D(
        cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1,
        cpB, extendB0, pointB0, fractionB0, pointB1, fractionB1, extendB1,
        reversed,
      );
    }
  }
  // Caller accesses data from a linestring or segment and passes it here.
  // The line segment in question might be (a) a full line segment or (b) a fragment within a linestring.
  // The fraction and extend parameters allow all combinations to be passed in.
  private dispatchSegmentArc(
    cpA: CurvePrimitive,
    extendA0: boolean,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    extendA1: boolean,
    arc: Arc3d,
    extendB0: boolean,
    extendB1: boolean,
    reversed: boolean,
  ): void {
    const tol2 = this._coincidentGeometryContext.tolerance * this._coincidentGeometryContext.tolerance;
    const cosines = new GrowableFloat64Array(2);
    const sines = new GrowableFloat64Array(2);
    const radians = new GrowableFloat64Array(2);
    // Arc: X = C + cU + sV
    // Line:  contains points A0,A1
    // Arc point colinear with line if det (A0, A1, X) = 0
    // with homogeneous xyw points and vectors.
    // With equational X: det (A0, A1, C) + c det (A0, A1,U) + s det (A0, A1, V) = 0.
    // solve for theta.
    // evaluate points.
    // project back to line.
    if (this._worldToLocalPerspective) {
      const data = arc.toTransformedPoint4d(this._worldToLocalPerspective);
      const radians0 = data.sweep.fractionToRadians(0);
      const pointB0H = data.center.plus2Scaled(data.vector0, Math.cos(radians0), data.vector90, Math.sin(radians0));
      const radians1 = data.sweep.fractionToRadians(1);
      const pointB1H = data.center.plus2Scaled(data.vector0, Math.cos(radians1), data.vector90, Math.sin(radians1));
      const pointA0H = this._worldToLocalPerspective.multiplyPoint3d(pointA0, 1);
      const pointA1H = this._worldToLocalPerspective.multiplyPoint3d(pointA1, 1);
      const alpha = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.center);
      const beta = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.vector0);
      const gamma = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.vector90);
      let numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians);
      const closeApproach = (0 === numRoots);
      if (closeApproach)
        numRoots = 1; // we returned the arc's closest approach as the first "root"; if within tolerance and at endpoints, we record it
      const acceptSolution = (iRoot: number, checkOnlyEndPointDistance: boolean = false): { fLine: number, fArc: number } | undefined => {
        const arcPoint = data.center.plus2Scaled(data.vector0, cosines.atUncheckedIndex(iRoot), data.vector90, sines.atUncheckedIndex(iRoot));
        let fArc = data.sweep.radiansToSignedFraction(radians.atUncheckedIndex(iRoot), extendB0);
        let fLine = SmallSystem.lineSegment3dHXYClosestPointUnbounded(pointA0H, pointA1H, arcPoint);
        if (fLine === undefined)
          return undefined;
        if (!checkOnlyEndPointDistance && this.acceptFraction(extendA0, fLine, extendA1) && this.acceptFraction(extendB0, fArc, extendB1))
          return { fLine, fArc };
        // check for an endpoint intersection that is beyond parametric tolerance but within point tolerance
        fLine = fLine < 0.5 ? 0 : 1;
        fArc = data.sweep.fractionToSignedPeriodicFraction(fArc) < 0.5 ? 0 : 1;
        const pointAH = fLine ? pointA1H : pointA0H;
        const pointBH = fArc ? pointB1H : pointB0H;
        const dist2 = pointAH.realDistanceSquaredXY(pointBH);
        return (dist2 !== undefined && Geometry.isDistanceWithinTol(dist2, tol2)) ? { fLine, fArc } : undefined;
      };
      for (let i = 0; i < numRoots; i++) {
        const result = acceptSolution(i, closeApproach);
        if (result)
          this.recordPointWithLocalFractions(result.fLine, cpA, fractionA0, fractionA1, result.fArc, arc, 0, 1, reversed);
      }
    } else {
      const data = arc.toTransformedVectors(this._worldToLocalAffine);
      const radians0 = data.sweep.fractionToRadians(0);
      const pointB0Local = data.center.plus2Scaled(data.vector0, Math.cos(radians0), data.vector90, Math.sin(radians0));
      const radians1 = data.sweep.fractionToRadians(1);
      const pointB1Local = data.center.plus2Scaled(data.vector0, Math.cos(radians1), data.vector90, Math.sin(radians1));
      let pointA0Local = pointA0;
      let pointA1Local = pointA1;
      if (this._worldToLocalAffine) {
        pointA0Local = this._worldToLocalAffine.multiplyPoint3d(pointA0);
        pointA1Local = this._worldToLocalAffine.multiplyPoint3d(pointA1);
      }
      const alpha = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.center, 1);
      const beta = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector0, 0);
      const gamma = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector90, 0);
      let numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians);
      const closeApproach = (0 === numRoots);
      if (closeApproach)
        numRoots = 1; // we returned the arc's closest approach as the first "root"; if within tolerance and at endpoints, we record it
      const acceptSolution = (iRoot: number, checkOnlyEndPointDistance: boolean = false): { fLine: number, fArc: number } | undefined => {
        const arcPoint = data.center.plus2Scaled(data.vector0, cosines.atUncheckedIndex(iRoot), data.vector90, sines.atUncheckedIndex(iRoot));
        let fArc = data.sweep.radiansToSignedFraction(radians.atUncheckedIndex(iRoot), extendB0);
        let fLine = SmallSystem.lineSegment3dXYClosestPointUnbounded(pointA0Local, pointA1Local, arcPoint);
        if (fLine === undefined)
          return undefined;
        if (!checkOnlyEndPointDistance && this.acceptFraction(extendA0, fLine, extendA1) && this.acceptFraction(extendB0, fArc, extendB1))
          return { fLine, fArc };
        // check for an endpoint intersection that is beyond parametric tolerance but within point tolerance
        fLine = fLine < 0.5 ? 0 : 1;
        fArc = data.sweep.fractionToSignedPeriodicFraction(fArc) < 0.5 ? 0 : 1;
        const pointALocal = fLine ? pointA1Local : pointA0Local;
        const pointBLocal = fArc ? pointB1Local : pointB0Local;
        const dist2 = pointALocal.distanceSquaredXY(pointBLocal);
        return Geometry.isDistanceWithinTol(dist2, tol2) ? { fLine, fArc } : undefined;
      };
      for (let i = 0; i < numRoots; i++) {
        const result = acceptSolution(i, closeApproach);
        if (result)
          this.recordPointWithLocalFractions(result.fLine, cpA, fractionA0, fractionA1, result.fArc, arc, 0, 1, reversed);
      }
    }
  }
  /**
   * Compute the intersection of two xy-arcs.
   * * Each matrix has [U V C] in (x,y,w) form from homogeneous projection (local to world).
   * * Arcs are ordered so that matrixA is better conditioned.
   */
  private dispatchArcArcThisOrder(
    cpA: Arc3d, // arc closer to being circular
    matrixA: Matrix3d,
    extendA0: boolean,
    extendA1: boolean,
    cpB: Arc3d,
    matrixB: Matrix3d,
    extendB0: boolean,
    extendB1: boolean,
    reversed: boolean,
  ): void {
    // inverseA transforms arcA to its local coordinates, where it is the unit xy-circle
    const inverseA = matrixA.inverse();
    if (inverseA) {
      // localB defines the arc formed by transforming arcB into the local coordinates of arcA
      const localB = inverseA.multiplyMatrixMatrix(matrixB);
      const ellipseRadians: number[] = [];
      const circleRadians: number[] = [];
      // find the intersection of the transformed arcs
      TrigPolynomial.solveUnitCircleHomogeneousEllipseIntersection(
        localB.coffs[2], localB.coffs[5], localB.coffs[8], // center xyw
        localB.coffs[0], localB.coffs[3], localB.coffs[6], // vector0 xyw
        localB.coffs[1], localB.coffs[4], localB.coffs[7], // vector90 xyw
        ellipseRadians, circleRadians,
      );
      const tol2 = this._coincidentGeometryContext.tolerance * this._coincidentGeometryContext.tolerance;
      // the intersections are transform-invariant, so the solution angles apply directly to the input arcs
      for (let i = 0; i < ellipseRadians.length; i++) {
        let fractionA = cpA.sweep.radiansToSignedFraction(circleRadians[i], extendA0);
        let fractionB = cpB.sweep.radiansToSignedFraction(ellipseRadians[i], extendB0);
        if (this.acceptFraction(extendA0, fractionA, extendA1) && this.acceptFraction(extendB0, fractionB, extendB1)) {
          this.recordPointWithLocalFractions(fractionA, cpA, 0, 1, fractionB, cpB, 0, 1, reversed);
        } else { // check for endpoint intersection beyond angular tolerance but within point tolerance
          fractionA = cpA.sweep.fractionToSignedPeriodicFraction(fractionA) < 0.5 ? 0 : 1;
          fractionB = cpB.sweep.fractionToSignedPeriodicFraction(fractionB) < 0.5 ? 0 : 1;
          const endPointA = cpA.fractionToPoint(fractionA, CurveCurveIntersectXY._workPointAA0);
          const endPointB = cpB.fractionToPoint(fractionB, CurveCurveIntersectXY._workPointBB0);
          const dist2 = endPointA.distanceSquaredXY(endPointB);
          if (Geometry.isDistanceWithinTol(dist2, tol2))
            this.recordPointWithLocalFractions(fractionA, cpA, 0, 1, fractionB, cpB, 0, 1, reversed);
        }
      }
    }
  }
  /**
   * We have 2 xy-arcs.
   * 1- We pick the arc that is closest to circular (larger condition number is closer to circular).
   * 2- Transform it to local coords, where it becomes the unit xy-circle.
   * 3- Use the same map to transform the other arc.
   * 4- Find the intersection of arc and unit circle.
   * 5- Convert intersection angles to fractions and record intersections.
   */
  private dispatchArcArc(
    cpA: Arc3d, extendA0: boolean, extendA1: boolean, cpB: Arc3d, extendB0: boolean, extendB1: boolean, reversed: boolean,
  ): void {
    // overlap handling. perspective is not handled.
    if (this._coincidentGeometryContext && !this._worldToLocalPerspective && !this._worldToLocalAffine) {
      const pairs = this._coincidentGeometryContext.coincidentArcIntersectionXY(cpA, cpB, true);
      if (pairs) {
        this.recordPairs(cpA, cpB, pairs, reversed);
        return;
      }
    }
    // look for isolated intersections
    let matrixA: Matrix3d;
    let matrixB: Matrix3d;
    if (this._worldToLocalPerspective) {
      const dataA = cpA.toTransformedPoint4d(this._worldToLocalPerspective);
      const dataB = cpB.toTransformedPoint4d(this._worldToLocalPerspective);
      matrixA = Matrix3d.createColumnsXYW(dataA.vector0, dataA.vector0.w, dataA.vector90, dataA.vector90.w, dataA.center, dataA.center.w);
      matrixB = Matrix3d.createColumnsXYW(dataB.vector0, dataB.vector0.w, dataB.vector90, dataA.vector90.w, dataB.center, dataB.center.w);
    } else {
      const dataA = cpA.toTransformedVectors(this._worldToLocalAffine);
      const dataB = cpB.toTransformedVectors(this._worldToLocalAffine);
      matrixA = Matrix3d.createColumnsXYW(dataA.vector0, 0, dataA.vector90, 0, dataA.center, 1);
      matrixB = Matrix3d.createColumnsXYW(dataB.vector0, 0, dataB.vector90, 0, dataB.center, 1);
    }
    const conditionA = matrixA.conditionNumber();
    const conditionB = matrixB.conditionNumber();
    // order the arcs so that the first one we pass in is closer to circular
    if (conditionA > conditionB)
      this.dispatchArcArcThisOrder(cpA, matrixA, extendA0, extendA1, cpB, matrixB, extendB0, extendB1, reversed);
    else
      this.dispatchArcArcThisOrder(cpB, matrixB, extendB0, extendB1, cpA, matrixA, extendA0, extendA1, !reversed);
  }

  /** Compute the intersection of an arc and a B-spline curve. */
  private dispatchArcBsplineCurve3d(
    cpA: Arc3d, extendA0: boolean, extendA1: boolean, cpB: BSplineCurve3d, extendB0: boolean, extendB1: boolean, reversed: boolean,
  ): void {
    // Arc: X = C + cU + sV
    // implicitize the arc as viewed.  This "3d" matrix is homogeneous "XYW" not "xyz"
    let matrixA: Matrix3d;
    if (this._worldToLocalPerspective) {
      const dataA = cpA.toTransformedPoint4d(this._worldToLocalPerspective);
      matrixA = Matrix3d.createColumnsXYW(
        dataA.vector0, dataA.vector0.w, dataA.vector90, dataA.vector90.w, dataA.center, dataA.center.w,
      );
    } else {
      const dataA = cpA.toTransformedVectors(this._worldToLocalAffine);
      matrixA = Matrix3d.createColumnsXYW(dataA.vector0, 0, dataA.vector90, 0, dataA.center, 1);
    }
    // The worldToLocal has moved the arc vectors into local space.
    // matrixA captures the xyw parts (ignoring z)
    const matrixAInverse = matrixA.inverse();
    if (matrixAInverse) {
      const orderF = cpB.order; // order of the beziers for simple coordinates
      const orderG = 2 * orderF - 1; // order of the (single) bezier for squared coordinates.
      const coffF = new Float64Array(orderF);
      const univariateBezierG = new UnivariateBezier(orderG);
      const axx = matrixAInverse.at(0, 0);
      const axy = matrixAInverse.at(0, 1);
      const axz = 0.0;
      const axw = matrixAInverse.at(0, 2);
      const ayx = matrixAInverse.at(1, 0);
      const ayy = matrixAInverse.at(1, 1);
      const ayz = 0.0;
      const ayw = matrixAInverse.at(1, 2);
      const awx = matrixAInverse.at(2, 0);
      const awy = matrixAInverse.at(2, 1);
      const awz = 0.0;
      const aww = matrixAInverse.at(2, 2);

      let bezier: BezierCurve3dH | undefined;
      for (let spanIndex = 0; ; spanIndex++) {
        bezier = cpB.getSaturatedBezierSpan3dH(spanIndex, bezier);
        if (!bezier)
          break;
        if (this._worldToLocalPerspective)
          bezier.tryMultiplyMatrix4dInPlace(this._worldToLocalPerspective);
        else if (this._worldToLocalAffine)
          bezier.tryTransformInPlace(this._worldToLocalAffine);
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
            const arcFraction = cpA.sweep.radiansToSignedFraction(Math.atan2(s, c), extendA0);
            if (this.acceptFraction(extendA0, arcFraction, extendA1) &&
              this.acceptFraction(extendB0, fractionB, extendB1)) {
              this.recordPointWithLocalFractions(arcFraction, cpA, 0, 1, fractionB, cpB, 0, 1, reversed);
            }
          }
        }
      }
    }
  }
  /** Apply the transformation to bezier curves. Optionally construct ranges. */
  private transformBeziers(beziers: BezierCurve3dH[]): void {
    if (this._worldToLocalAffine) {
      for (const bezier of beziers) bezier.tryTransformInPlace(this._worldToLocalAffine);
    } else if (this._worldToLocalPerspective) {
      for (const bezier of beziers) bezier.tryMultiplyMatrix4dInPlace(this._worldToLocalPerspective);
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
  private dispatchBezierBezierStrokeFirst(
    bezierA: BezierCurve3dH,
    bcurveA: BSplineCurve3dBase,
    strokeCountA: number,
    bezierB: BezierCurve3dH,
    bcurveB: BSplineCurve3dBase,
    _strokeCountB: number,
    univariateBezierB: UnivariateBezier, // caller-allocated for univariate coefficients
    reversed: boolean,
  ): void {
    if (!this._xyzwA0)
      this._xyzwA0 = Point4d.create();
    if (!this._xyzwA1)
      this._xyzwA1 = Point4d.create();
    if (!this._xyzwPlane)
      this._xyzwPlane = Point4d.create();
    if (!this._xyzwB)
      this._xyzwB = Point4d.create();
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
          this.recordPointWithLocalFractions(
            arcFraction, cpA, 0, 1, fractionB, cpB, 0, 1, reversed,
          );
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
      bezierB.poleProductsXYZW(
        univariateBezierB.coffs, this._xyzwPlane.x, this._xyzwPlane.y, this._xyzwPlane.z, this._xyzwPlane.w,
      );
      let errors = 0;
      const roots = univariateBezierB.roots(0.0, true);
      if (roots) {
        for (const r of roots) {
          let bezierBFraction = r;
          bezierB.fractionToPoint4d(bezierBFraction, this._xyzwB);
          const segmentAFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(
            this._xyzwA0, this._xyzwA1, this._xyzwB,
          );
          if (segmentAFraction !== undefined && Geometry.isIn01WithTolerance(segmentAFraction, intervalTolerance)) {
            let bezierAFraction = Geometry.interpolate(f0, segmentAFraction, f1);
            // We have a near intersection at fractions on the two beziers
            // Iterate on the curves for a true intersection
            const xyMatchingFunction = new CurveCurveIntersectionXYRRToRRD(bezierA, bezierB);
            const newtonSearcher = new Newton2dUnboundedWithDerivative(xyMatchingFunction);
            newtonSearcher.setUV(bezierAFraction, bezierBFraction);
            if (newtonSearcher.runIterations()) {
              bezierAFraction = newtonSearcher.getU();
              bezierBFraction = newtonSearcher.getV();
            }
            const bcurveAFraction = bezierA.fractionToParentFraction(bezierAFraction);
            const bcurveBFraction = bezierB.fractionToParentFraction(bezierBFraction);
            if (false) { // verify results
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
            }
            if (this.acceptFraction(false, bcurveAFraction, false) && this.acceptFraction(false, bcurveBFraction, false)) {
              this.recordPointWithLocalFractions(
                bcurveAFraction, bcurveA, 0, 1, bcurveBFraction, bcurveB, 0, 1, reversed,
              );
            }
          }
        }
      }
    }
  }
  private dispatchBSplineCurve3dBSplineCurve3d(
    bcurveA: BSplineCurve3dBase, bcurveB: BSplineCurve3dBase, reversed: boolean,
  ): void {
    const bezierSpanA = bcurveA.collectBezierSpans(true) as BezierCurve3dH[];
    const bezierSpanB = bcurveB.collectBezierSpans(true) as BezierCurve3dH[];
    const numA = bezierSpanA.length;
    const numB = bezierSpanB.length;
    this.transformBeziers(bezierSpanA);
    this.transformBeziers(bezierSpanB);
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
            this.dispatchBezierBezierStrokeFirst(
              bezierSpanA[a], bcurveA, strokeCountA, bezierSpanB[b], bcurveB, strokeCountB, univariateCoffsB, reversed,
            );
          else
            this.dispatchBezierBezierStrokeFirst(
              bezierSpanB[b], bcurveB, strokeCountB, bezierSpanA[a], bcurveA, strokeCountA, univariateCoffsA, !reversed,
            );
        }
      }
    }
  }
  /**
   * Apply the projection transform (if any) to (xyz, w).
   * @param xyz xyz parts of input point.
   * @param w weight to use for homogeneous effects.
   */
  private projectPoint(xyz: XYAndZ, w: number = 1.0): Point4d {
    if (this._worldToLocalPerspective)
      return this._worldToLocalPerspective.multiplyPoint3d(xyz, w);
    if (this._worldToLocalAffine)
      return this._worldToLocalAffine.multiplyXYZW(xyz.x, xyz.y, xyz.z, w);
    return Point4d.createFromPointAndWeight(xyz, w);
  }
  private mapNPCPlaneToWorld(npcPlane: Point4d, worldPlane: Point4d) {
    // for NPC pointY, Y^ * H = 0 is "on" plane H.  (Hat is transpose)
    // NPC Y is A*X for our transform A and worldPointX.
    // hence (A X)^ * H = 0
    // hence X^ * A^ * H = 0
    // hence K = A^ * H
    if (this._worldToLocalAffine) {
      this._worldToLocalAffine.multiplyTransposeXYZW(npcPlane.x, npcPlane.y, npcPlane.z, npcPlane.w, worldPlane);
    } else if (this._worldToLocalPerspective) {
      this._worldToLocalPerspective.multiplyTransposePoint4d(npcPlane, worldPlane);
    } else {
      npcPlane.clone(worldPlane);
    }
  }
  // Caller accesses data from segment and bsplineCurve.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion".
  // Solves the arc-arc equations.
  private dispatchSegmentBsplineCurve(
    cpA: CurvePrimitive,
    extendA0: boolean,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    extendA1: boolean,
    bcurve: BSplineCurve3d,
    extendB0: boolean,
    extendB1: boolean,
    reversed: boolean,
  ): void {
    const pointA0H = this.projectPoint(pointA0);
    const pointA1H = this.projectPoint(pointA1);
    const planeCoffs = Point4d.createPlanePointPointZ(pointA0H, pointA1H);
    this.mapNPCPlaneToWorld(planeCoffs, planeCoffs);
    // NOW .. we have a plane in world space.  Intersect it with the bspline:
    const intersections: CurveLocationDetail[] = [];
    bcurve.appendPlaneIntersectionPoints(planeCoffs, intersections);
    // intersections has WORLD points with bspline fractions.
    // (the bspline fractions are all good 0..1 fractions within the spline).
    // accept those that are within the segment range.
    for (const detail of intersections) {
      const fractionB = detail.fraction;
      const curvePoint = detail.point;
      const curvePointH = this.projectPoint(curvePoint);
      const lineFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(pointA0H, pointA1H, curvePointH);
      if (lineFraction !== undefined) {
        if (this.acceptFraction(extendA0, lineFraction, extendA1) && this.acceptFraction(extendB0, fractionB, extendB1)) {
          this.recordPointWithLocalFractions(lineFraction, cpA, fractionA0, fractionA1, fractionB, bcurve, 0, 1, reversed);
        }
      }
    }
  }
  /** Low level dispatch of linestring with (beziers of) a bspline curve. */
  public dispatchLineStringBSplineCurve(
    lsA: LineString3d, extendA0: boolean, extendA1: boolean,
    curveB: BSplineCurve3d, extendB0: boolean, extendB1: boolean, reversed: boolean,
  ): any {
    const numA = lsA.numPoints();
    if (numA > 1) {
      const dfA = 1.0 / (numA - 1);
      let fA0;
      let fA1;
      fA0 = 0.0;
      const pointA0 = CurveCurveIntersectXY._workPointA0;
      const pointA1 = CurveCurveIntersectXY._workPointA1;
      lsA.pointAt(0, pointA0);
      for (let iA = 1; iA < numA; iA++, pointA0.setFrom(pointA1), fA0 = fA1) {
        lsA.pointAt(iA, pointA1);
        fA1 = iA * dfA;
        this.dispatchSegmentBsplineCurve(
          lsA, iA === 1 && extendA0, pointA0, fA0, pointA1, fA1, (iA + 1) === numA && extendA1,
          curveB, extendB0, extendB1, reversed);
      }
    }
    return undefined;
  }
  /** Detail computation for segment intersecting linestring. */
  public computeSegmentLineString(
    lsA: LineSegment3d, extendA0: boolean, extendA1: boolean,
    lsB: LineString3d, extendB0: boolean, extendB1: boolean,
    reversed: boolean,
  ): any {
    const pointA0 = lsA.point0Ref;
    const pointA1 = lsA.point1Ref;
    const pointB0 = CurveCurveIntersectXY._workPointBB0;
    const pointB1 = CurveCurveIntersectXY._workPointBB1;
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
          lsA, extendA0, pointA0, 0.0, pointA1, 1.0, extendA1,
          lsB, ib === 1 && extendB0, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB1,
          reversed,
        );
      }
    }
    return undefined;
  }
  /** Detail computation for arc intersecting linestring. */
  public computeArcLineString(
    arcA: Arc3d, extendA0: boolean, extendA1: boolean,
    lsB: LineString3d, extendB0: boolean, extendB1: boolean,
    reversed: boolean,
  ): any {
    const pointB0 = CurveCurveIntersectXY._workPointBB0;
    const pointB1 = CurveCurveIntersectXY._workPointBB1;
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
          lsB, ib === 1 && extendB0, pointB0, fB0, pointB1, fB1,
          (ib + 1) === numB && extendB1, arcA, extendA0, extendA1, !reversed,
        );
      }
    }
    return undefined;
  }
  /** Detail computation for linestring intersecting linestring. */
  private computeLineStringLineString(
    lsA: LineString3d, extendA0: boolean, extendA1: boolean,
    lsB: LineString3d, extendB0: boolean, extendB1: boolean,
    reversed: boolean,
  ): void {
    const pointA0 = CurveCurveIntersectXY._workPointAA0;
    const pointA1 = CurveCurveIntersectXY._workPointAA1;
    const pointB0 = CurveCurveIntersectXY._workPointBB0;
    const pointB1 = CurveCurveIntersectXY._workPointBB1;
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
            lsA, ia === 1 && extendA0, pointA0, fA0, pointA1, fA1, (ia + 1) === numA && extendA1,
            lsB, ib === 1 && extendB0, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB1,
            reversed,
          );
        }
      }
    }
  }
  private static setTransformedWorkPoints(
    transform: Transform, pointA0: Point3d, pointA1: Point3d, pointB0: Point3d, pointB1: Point3d,
  ): void {
    transform.multiplyPoint3d(pointA0, this._workPointA0);
    transform.multiplyPoint3d(pointA1, this._workPointA1);
    transform.multiplyPoint3d(pointB0, this._workPointB0);
    transform.multiplyPoint3d(pointB1, this._workPointB1);
  }
  /**
   * Low level dispatch of curve collection.
   * We take care of extend variables of geometry's children here if geometry is Path or Loop.
   */
  private dispatchCurveCollection(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    const geomB = this._geometryB;
    if (!geomB || !geomB.children || !(geomB instanceof CurveCollection))
      return;
    const children = geomB.children;
    const saveExtendB0 = this._extendB0;
    const saveExtendB1 = this._extendB1;
    for (let i = 0; i < children.length; i++) {
      let extendB0 = saveExtendB0;
      let extendB1 = saveExtendB1;
      if (geomB instanceof Path && children.length > 1) {
        if (i === 0)
          extendB1 = false; // first child can only extend from start
        else if (i === children.length - 1)
          extendB0 = false; // last child can only extend from end
        else
          extendB0 = extendB1 = false; // middle children cannot extend
      } else if (geomB instanceof Loop) {
        extendB0 = extendB1 = false; // Loops cannot extend
      }
      this.resetGeometryB(children[i], extendB0, extendB1);
      geomAHandler(geomA);
    }
    this.resetGeometryB(geomB, saveExtendB0, saveExtendB1);
  }
  /**
   * Low level dispatch of CurveChainWithDistanceIndex.
   * We take care of extend variables of geometry's children here if geometry.path is Path or Loop.
   */
  private dispatchCurveChainWithDistanceIndex(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    if (!this._geometryB || !(this._geometryB instanceof CurveChainWithDistanceIndex))
      return;
    if (geomA instanceof CurveChainWithDistanceIndex) {
      assert(false, "call handleCurveChainWithDistanceIndex(geomA) instead");
    }
    const index0 = this._results.length;
    const geomB = this._geometryB; // save
    this.resetGeometryB(geomB.path);
    this.dispatchCurveCollection(geomA, geomAHandler);
    this.resetGeometryB(geomB); // restore
    this._results = CurveChainWithDistanceIndex.convertChildDetailToChainDetail(
      this._results, index0, undefined, geomB, true,
    );
  }
  /**
   * Invoke dispatch on each child of `g` as "geometryA".
   * * If `g` is a `Path` or `Loop`, adjust extension flags for geometryA accordingly.
   */
  public override handleChildren(g: GeometryQuery): any {
    const children = g.children;
    if (!children)
      return;
    const saveExtendA0 = this._extendA0;
    const saveExtendA1 = this._extendA1;
    for (let i = 0; i < children.length; i++) {
      let extendA0 = saveExtendA0;
      let extendA1 = saveExtendA1;
      if (g instanceof Path && children.length > 1) {
        if (i === 0)
          extendA1 = false; // first child can only extend from start
        else if (i === children.length - 1)
          extendA0 = false; // last child can only extend from end
        else
          extendA0 = extendA1 = false; // middle children cannot extend
      } else if (g instanceof Loop) {
        extendA0 = extendA1 = false; // Loops cannot extend
      }
      this.resetGeometryA(extendA0, extendA1);
      children[i].dispatchToGeometryHandler(this);
    }
    this.resetGeometryA(saveExtendA0, saveExtendA1);
  }
  /** Double dispatch handler for strongly typed segment. */
  public override handleLineSegment3d(segmentA: LineSegment3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      const segmentB = this._geometryB;
      this.dispatchSegmentSegment(
        segmentA, this._extendA0, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA1,
        segmentB, this._extendB0, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0, this._extendB1,
        false,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.computeSegmentLineString(
        segmentA, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchSegmentArc(
        segmentA, this._extendA0, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA1,
        this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchSegmentBsplineCurve(
        segmentA, this._extendA0, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA1,
        this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof TransitionSpiral3d) {
      this.dispatchCurveSpiral(segmentA, this._extendA0, this._extendA1, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(segmentA, this.handleLineSegment3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(segmentA, this.handleLineSegment3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed linestring. */
  public override handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineString3d) {
      const lsB = this._geometryB;
      this.computeLineStringLineString(lsA, this._extendA0, this._extendA1, lsB, this._extendB0, this._extendB1, false);
    } else if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentLineString(
        this._geometryB, this._extendB0, this._extendB1, lsA, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.computeArcLineString(
        this._geometryB, this._extendB0, this._extendB1, lsA, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchLineStringBSplineCurve(
        lsA, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof TransitionSpiral3d) {
      this.dispatchCurveSpiral(lsA, this._extendA0, this._extendA1, this._geometryB, false);
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
      this.dispatchSegmentArc(
        this._geometryB, this._extendB0, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB1,
        arcA, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.computeArcLineString(
        arcA, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcArc(arcA, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false);
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchArcBsplineCurve3d(
        arcA, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof TransitionSpiral3d) {
      this.dispatchCurveSpiral(arcA, this._extendA0, this._extendA1, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(arcA, this.handleArc3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(arcA, this.handleArc3d.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed bspline curve. */
  public override handleBSplineCurve3d(curveA: BSplineCurve3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentBsplineCurve(
        this._geometryB, this._extendB0, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB1,
        curveA, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.dispatchLineStringBSplineCurve(
        this._geometryB, this._extendB0, this._extendB1, curveA, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcBsplineCurve3d(
        this._geometryB, this._extendB0, this._extendB1, curveA, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof BSplineCurve3dBase) {
      this.dispatchBSplineCurve3dBSplineCurve3d(curveA, this._geometryB, false);
    } else if (this._geometryB instanceof TransitionSpiral3d) {
      this.dispatchCurveSpiral(curveA, this._extendA0, this._extendA1, this._geometryB, false);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(curveA, this.handleBSplineCurve3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(curveA, this.handleBSplineCurve3d.bind(this));
    }
    return undefined;
  }
  /**
   * Process tail of `this._results` for xy-intersections between the curve and spiral.
   * * If a result is not already an intersection, refine it via Newton iteration unless it doesn't converge, in which
   * case remove it.
   * @param curveA The other curve primitive. May also be a transition spiral.
   * @param spiralB The transition spiral.
   * @param index0 index of first entry in tail of `this._results` to refine.
   * @param reversed whether `spiralB` data is in `detailA` of each recorded pair, and `curveA` data in `detailB`.
   */
  private refineSpiralResultsByNewton(
    curveA: CurvePrimitive, spiralB: TransitionSpiral3d, index0: number, reversed = false,
  ): void {
    if (index0 >= this._results.length)
      return;
    // ASSUME: seeds in results tail are ordered by most accurate first, as only the first convergence within tolerance is recorded.
    const xyMatchingFunction = new CurveCurveIntersectionXYRRToRRD(curveA, spiralB);
    const maxIterations = 100; // observed 73 iterations to convergence in tangent case
    const newtonSearcher = new Newton2dUnboundedWithDerivative(xyMatchingFunction, maxIterations);
    const fractionTol = 2 * newtonSearcher.stepSizeTolerance; // relative cluster diameter for Newton convergence
    const comparePairs: OrderedComparator<CurveLocationDetailPair> = (
      a: CurveLocationDetailPair, b: CurveLocationDetailPair,
    ): number => {
      assert(() => a.detailA.curve === b.detailA.curve && a.detailB.curve === b.detailB.curve, "pairs are compatible");
      // sort on either fraction, then on the point, using appropriate tolerances for each
      if (Geometry.isAlmostEqualNumber(a.detailA.fraction, b.detailA.fraction, fractionTol))
        return 0;
      if (a.detailA.point.isAlmostEqualXY(b.detailA.point, this._coincidentGeometryContext.tolerance))
        return 0;
      return a.detailA.fraction - b.detailA.fraction;
    };
    const myResults = new SortedArray<CurveLocationDetailPair>(comparePairs, DuplicatePolicy.Retain);
    const pushToMyResults = (cpA: CurvePrimitive, fA: number, cpB: CurvePrimitive, fB: number): boolean => {
      const detailA = CurveLocationDetail.createCurveFractionPoint(cpA, fA, cpA.fractionToPoint(fA));
      const detailB = CurveLocationDetail.createCurveFractionPoint(cpB, fB, cpB.fractionToPoint(fB));
      detailA.setIntervalRole(CurveIntervalRole.isolated);
      detailB.setIntervalRole(CurveIntervalRole.isolated);
      let pushed = false;
      myResults.insert(
        new CurveLocationDetailPair(reversed ? detailB : detailA, reversed ? detailA : detailB), () => pushed = true,
      );
      return pushed;
    };
    for (let i = index0; i < this._results.length; i++) {
      const pair = this._results[i];
      const detailA = reversed ? pair.detailB : pair.detailA;
      const detailB = reversed ? pair.detailA : pair.detailB;
      assert(detailB.curve instanceof LineString3d, "Caller has discretized the spiral");
      const extendA0 = reversed ? this._extendB0 : this._extendA0;
      const extendA1 = reversed ? this._extendB1 : this._extendA1;
      newtonSearcher.setUV(detailA.fraction, detailB.fraction); // use linestring fraction as spiral param; it generally yields a closer point than fractional length!
      if (newtonSearcher.runIterations()) {
        const fractionA = newtonSearcher.getU();
        const fractionB = newtonSearcher.getV();
        if (this.acceptFraction(extendA0, fractionA, extendA1) && this.acceptFraction(false, fractionB, false))
          pushToMyResults(curveA, fractionA, spiralB, fractionB);
      } else if (newtonSearcher.numIterations < 10) {
        // if Newton failed early due to vanishing (partial) derivative, check for a root there
        const fractionA = newtonSearcher.getU();
        const fractionB = newtonSearcher.getV();
        if (curveA.fractionToPoint(fractionA).isAlmostEqualXY(spiralB.fractionToPoint(fractionB), this._coincidentGeometryContext.tolerance))
          pushToMyResults(curveA, fractionA, spiralB, fractionB);
      }
    }
    this._results.splice(index0, this._results.length - index0, ...myResults.extractArray());
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
  /** Compute an approximation to the max chord height error of the stroked spiral, and another curve if a spiral. */
  private computeMaxSpiralStrokeError(
    spiral0: TransitionSpiral3d, ls0: LineString3d, spiral1?: CurvePrimitive, ls1?: CurvePrimitive,
  ): number {
    let maxError = 0;
    if (ls0.numEdges() > 0) {
      // the max error occurs at the spiral end with higher curvature
      const k0 = spiral0.fractionToCurvature(0);
      const k1 = spiral0.fractionToCurvature(1);
      const iChord = (k0 !== undefined && k1 !== undefined && Math.abs(k0) > Math.abs(k1)) ? 0 : ls0.numEdges() - 1;
      const midPoint = Point3d.create();
      const detail = CurveLocationDetail.create();
      if (ls0.packedPoints.interpolateIndexIndex(iChord, 0.5, iChord + 1, midPoint)) {
        if (spiral0.closestPoint(midPoint, false, detail))
          maxError = detail.a;
      }
      if (spiral1 && spiral1 instanceof TransitionSpiral3d && ls1 && ls1 instanceof LineString3d) {
        const maxError1 = this.computeMaxSpiralStrokeError(spiral1, ls1);
        if (maxError1 > maxError)
          maxError = maxError1;
      }
    }
    return maxError;
  }
  /**
   * Solve the intersection problem for stroked, unextended curveB.
   * * @return the number of results appended.
   */
  private appendDiscreteIntersectionResults(
    curveA: CurvePrimitive, extendA0: boolean, extendA1: boolean, lsB: LineString3d, reversed: boolean,
  ): number {
    const i0 = this._results.length;
    // handleLineString3d requires us to swap geometries
    const geomB = this._geometryB;
    const extendB0 = this._extendB0;
    const extendB1 = this._extendB1;
    this.resetGeometryA(false, false); // lsB is never extended
    this.resetGeometryB(curveA, extendA0, extendA1);
    this.handleLineString3d(lsB); // this puts lsB data in detailA, as expected when reversed is true
    if (!reversed) { // swap lsB data to detailB
      for (let i = i0; i < this._results.length; i++)
        this._results[i].swapDetails();
    }
    this.resetGeometryA(extendA0, extendA1);
    this.resetGeometryB(geomB, extendB0, extendB1);
    return this._results.length - i0;
  }
  /**
   * Solve the close approach problem for stroked, unextended curveB.
   * * Sort the results shortest projection distance first.
   * @return the number of results appended.
   */
  private appendDiscreteCloseApproachResults(
    curveA: CurvePrimitive, lsB: LineString3d, maxDistance: number, reversed: boolean,
  ): number {
    const i0 = this._results.length;
    const closeApproachPairs = CurveCurve.closeApproachProjectedXYPairs(
      reversed ? lsB : curveA, reversed ? curveA : lsB, maxDistance,
    );
    closeApproachPairs.sort((p0: CurveLocationDetailPair, p1: CurveLocationDetailPair) => p0.detailA.a - p1.detailA.a);
    this._results.push(...closeApproachPairs);
    return this._results.length - i0;
  }
  /**
   * Compute the xy-intersection of a curve and a spiral.
   * * When `curveA` is extended, duplicate solutions may be returned.
   * @param curveA curve to intersect with spiralB. May also be a transition spiral.
   * @param extendA0 whether to compute xy-intersections with curveA extended beyond its start.
   * @param extendA1 whether to compute xy-intersections with curveA extended beyond its end.
   * @param spiralB transition spiral to intersect with curveA.
   * @param reversed whether `spiralB` data will be recorded in `detailA` of each result, and `curveA` data in `detailB`.
   */
  private dispatchCurveSpiral(
    curveA: CurvePrimitive, extendA0: boolean, extendA1: boolean, spiralB: TransitionSpiral3d, reversed: boolean,
  ): void {
    let cpA = curveA;
    if (curveA instanceof TransitionSpiral3d) {
      cpA = this.strokeCurve(curveA);
      extendA0 = extendA1 = false;
    }
    const cpB = this.strokeCurve(spiralB);
    const maxError = 1.01 * this.computeMaxSpiralStrokeError(spiralB, cpB, curveA, cpA);
    const index0 = this._results.length;
    // append seeds computed by solving discretized spiral problems, then refine the seeds via Newton
    this.appendDiscreteIntersectionResults(cpA, extendA0, extendA1, cpB, reversed); // recorded first because more accurate
    this.appendDiscreteCloseApproachResults(cpA, cpB, maxError, reversed); // seeds for finding tangent intersections
    this.refineSpiralResultsByNewton(curveA, spiralB, index0, reversed);
  }
  /** Double dispatch handler for strongly typed spiral curve. */
  public override handleTransitionSpiral(spiral: TransitionSpiral3d): any {
    if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(spiral, this.handleTransitionSpiral.bind(this));
    } else if (this._geometryB instanceof CurvePrimitive) {
      this.dispatchCurveSpiral(this._geometryB, this._extendB0, this._extendB1, spiral, true);
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(spiral, this.handleTransitionSpiral.bind(this));
    }
    return undefined;
  }
  /** Double dispatch handler for strongly typed CurveChainWithDistanceIndex. */
  public override handleCurveChainWithDistanceIndex(chain: CurveChainWithDistanceIndex): any {
    super.handleCurveChainWithDistanceIndex(chain);
    // if _geometryB is also a CurveChainWithDistanceIndex, it will already have been converted by dispatchCurveChainWithDistanceIndex
    this._results = CurveChainWithDistanceIndex.convertChildDetailToChainDetail(this._results, 0, chain, undefined, true);
  }
  /** Double dispatch handler for strongly typed homogeneous bspline curve. */
  public override handleBSplineCurve3dH(_curve: BSplineCurve3dH): any {
    /*
    // NEEDS WORK -- make "dispatch" methods tolerant of both 3d and 3dH .
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
