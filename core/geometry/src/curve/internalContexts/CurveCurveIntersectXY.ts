/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert, DuplicatePolicy, SortedArray } from "@itwin/core-bentley";
import { BezierCurve3dH } from "../../bspline/BezierCurve3dH";
import { BezierCurveBase } from "../../bspline/BezierCurveBase";
import { BSplineCurve3d, BSplineCurve3dBase } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { CoincidentGeometryQuery } from "../../geometry3d/CoincidentGeometryOps";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { GrowableFloat64Array } from "../../geometry3d/GrowableFloat64Array";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
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
/** A recorded intersection of two near-tangent arcs, and its candidate location at an endpoint of one of the arcs. */
interface NearTangentSnap {
  /** the recorded intersection */
  pair: CurveLocationDetailPair;
  /** the arc with the endpoint */
  arc: Arc3d;
  /** fraction of the endpoint of `arc` (0 or 1) */
  fraction: number;
  /** the other arc */
  other: Arc3d;
  /** fraction of the projection of the endpoint on `other` */
  otherFraction: number;
}
/** A planned change of a recorded intersection detail. */
interface NearTangentMove {
  detail: CurveLocationDetail;
  fraction: number;
  point: Point3d;
}
/** One of the two arcs of a near-tangent snap candidate, with the old and new location of the intersection on it. */
interface NearTangentSide {
  /** the arc */
  curve: Arc3d;
  /** the recorded intersection on `curve` */
  oldPoint: Point3d;
  /** fraction of the new location on `curve` */
  newFraction: number;
  /** the new location on `curve` */
  newPoint: Point3d;
  /** the other arc of the candidate */
  counterpart: Arc3d;
  /** the new location on `counterpart` */
  counterpartPoint: Point3d;
}
/** A near-tangent intersection that may be moved to an arc endpoint. */
interface NearTangentCandidate {
  snap: NearTangentSnap;
  /** the endpoint of `snap.arc` (the target) */
  endPoint: Point3d;
  /** the arc and the other arc */
  sides: NearTangentSide[];
  /** the planned moves, including intersections moved along */
  moves: NearTangentMove[];
  /** whether the candidate was found blocked when collected */
  blocked: boolean;
}
/**
 * Options for [[CurveCurveIntersectXY.allIntersectionsAmongPrimitivesXY]].
 * @internal
 */
export interface AllIntersectionsAmongPrimitivesXYOptions {
  /** Whether to apply [[CurveCurveIntersectXY.snapNearTangentIntersectionsToEndpoints]] to the results. Default `false`. */
  snapNearTangent?: boolean;
  /** Whether to keep copies of the results from before the near-tangent snap, if it moves any. Default `false`. */
  keepUnsnappedPairs?: boolean;
  /**
   * Whether coincident arcs report the part of an overlap that wraps backward across the start of an arc (see
   * [[CoincidentGeometryQuery.reportBackwardWrappedArcOverlaps]]). Default `true`.
   */
  reportBackwardWrappedArcOverlaps?: boolean;
}
/**
 * Results of [[CurveCurveIntersectXY.allIntersectionsAmongPrimitivesXY]].
 * @internal
 */
export interface AllIntersectionsAmongPrimitivesXY {
  /** The intersections. */
  pairs: CurveLocationDetailPair[];
  /**
   * Copies of the intersections from before the near-tangent snap, if requested and if the snap moved any of them.
   * Undefined if no intersection was moved: then `pairs` are the intersections before the snap.
   */
  unsnappedPairs?: CurveLocationDetailPair[];
  /** Number of reported parts of arc overlaps that wrap backward across the start of an arc. */
  numBackwardWrappedArcOverlaps: number;
}
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
  /** Recorded near-tangent arc-arc intersections that may be moved to an arc endpoint. */
  private _nearTangentSnaps: NearTangentSnap[];
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
  private static _workRayA = Ray3d.createZero();
  private static _workRayB = Ray3d.createZero();
  private static _workPlaneA = Plane3dByOriginAndVectors.createXYPlane();
  private static _workPlaneB = Plane3dByOriginAndVectors.createXYPlane();
  /**
   * Sine of the xy-angle below which a curve that leaves a point counts as tangent to an arc there, and above which it
   * counts as leaving at an angle (a corner), in [[hasForeignCurveAtPoint]] and [[isCornerOfArc]].
   * * The value is a choice between two scales rather than a derived bound: curves that are tangent by construction (as
   * a fillet) meet at angles of the size of roundoff or of the near-tangency handled here, far below it, and a chord or
   * segment that leaves a corner typically meets the arc at an angle far above it.
   * * The sine is compared, so a curve that leaves almost backward along the arc (a cusp) counts as tangent too.
   */
  private static _tangentSineTolerance = 1.0e-4;
  // Thresholds of the near-tangent snap (see snapNearTangentIntersectionsToEndpoints). Factors of the distance tolerance
  // tol, below which vertices are merged, are margins below tol, chosen so that roundoff does not decide whether a moved
  // intersection is merged with a nearby vertex. They are chosen, not derived. The others follow from the local model
  // of two near-tangent arcs in snapToEndOfArc.
  /** The arc endpoint and the arc up to it must be within this factor of tol of the other arc (chosen margin). */
  private static readonly _snapToleranceFactor = 0.75;
  /**
   * The end of the overlap must be within this factor of tol of the projection of the endpoint on the other arc (chosen
   * margin, independent of _snapToleranceFactor, which bounds a distance across the arcs rather than along them).
   */
  private static readonly _overlapEndToleranceFactor = 0.7;
  /** Bound of |sine| * distance over the snap tolerance for an intersection that can pass the snap tests (derived). */
  private static readonly _separationBoundFactor = 4;
  /** Largest ratio of the sines at the endpoint and at the intersection: at least halfway to the extremum (chosen). */
  private static readonly _endSineRatioLimit = 0.5;
  /** Another intersection within this factor of the moved distance of the old location blocks the move (chosen). */
  private static readonly _nearOldLocationSpanFactor = 2;
  /** A foreign curve with an endpoint within this factor of tol of the new location counts (chosen). */
  private static readonly _foreignEndpointToleranceFactor = 2;
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
    this._nearTangentSnaps = [];
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
  ): boolean {
    if (!extend0 && fraction < 0) {
      return Geometry.isDistanceWithinTol(fraction * fraction * pointA.distanceSquaredXY(pointB), this._coincidentGeometryContext.tolerance * this._coincidentGeometryContext.tolerance);
    } else if (!extend1 && fraction > 1.0) {
      const f = fraction - 1;
      return Geometry.isDistanceWithinTol(f * f * pointA.distanceSquaredXY(pointB), this._coincidentGeometryContext.tolerance * this._coincidentGeometryContext.tolerance);
    }
    return true;
  }
  /**
   * Return the results structure for the intersection calculation, structured as an array of CurveLocationDetailPair
   * @param reinitialize if true, a new results structure is created for use by later calls.
   */
  public grabPairedResults(reinitialize: boolean = false): CurveLocationDetailPair[] {
    const result = this._results;
    if (reinitialize) {
      this._results = [];
      this._nearTangentSnaps = [];
    }
    return result;
  }
  /**
   * Record the pre-computed intersection between two curves. Record with fraction mapping.
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
   * @param fractionTol relative tolerance for comparing fractions to avoid duplicating the last intersection. Defaults
   * to [[Geometry.smallAngleRadians]].
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
    let isInterval = false;
    if (intervalDetails && intervalDetails.detailA.isInterval() && intervalDetails.detailB.isInterval()) {
      isInterval = true;
      globalFractionA = Geometry.interpolate(fractionA0, intervalDetails.detailA.fraction, fractionA1);
      globalFractionB = Geometry.interpolate(fractionB0, intervalDetails.detailB.fraction, fractionB1);
      globalFractionA1 = Geometry.interpolate(fractionA0, intervalDetails.detailA.fraction1, fractionA1);
      globalFractionB1 = Geometry.interpolate(fractionB0, intervalDetails.detailB.fraction1, fractionB1);
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
    const fractions = SmallSystem.lineSegmentXYUVIntersectionUnbounded(pointA0, aDir, pointB0, bDir, this._coincidentGeometryContext.tolerance);
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
      if (this.acceptFractionOnLine(extendA0, fractions.f0.x, extendA1, pointA0, pointA1)) {
        if (this.acceptFractionOnLine(extendB0, fractions.f0.y, extendB1, pointB0, pointB1))
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
    if (undefined === this._worldToLocalPerspective)
      return;
    const hA0 = CurveCurveIntersectXY._workPointA0H;
    const hA1 = CurveCurveIntersectXY._workPointA1H;
    const hB0 = CurveCurveIntersectXY._workPointB0H;
    const hB1 = CurveCurveIntersectXY._workPointB1H;
    this._worldToLocalPerspective.multiplyPoint3d(pointA0, 1, hA0);
    this._worldToLocalPerspective.multiplyPoint3d(pointA1, 1, hA1);
    this._worldToLocalPerspective.multiplyPoint3d(pointB0, 1, hB0);
    this._worldToLocalPerspective.multiplyPoint3d(pointB1, 1, hB1);
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

  /** Implementation of dispatchSegmentArc under affine transform. KEEP IN SYNC WITH computeSegmentArcHomogeneous. */
  private computeSegmentArc(cpA: CurvePrimitive, extendA0: boolean, pointA0: Point3d, fractionA0: number, pointA1: Point3d, fractionA1: number, extendA1: boolean, arc: Arc3d, extendB0: boolean, extendB1: boolean, reversed: boolean): void {
    const tol2 = this._coincidentGeometryContext.tolerance * this._coincidentGeometryContext.tolerance;
    const cosines = new GrowableFloat64Array(2);
    const sines = new GrowableFloat64Array(2);
    const radians = new GrowableFloat64Array(2);
    const recordIfNearIntersection = (fA: number, fB: number, d2: number): boolean => {
      if (!Geometry.isDistanceWithinTol(d2, tol2))
        return false;
      this.recordPointWithLocalFractions(fA, cpA, fractionA0, fractionA1, fB, arc, 0, 1, reversed);
      return true;
    };
    const data = arc.toTransformedVectors(this._worldToLocalAffine);
    let pointA0Local = pointA0;
    let pointA1Local = pointA1;
    const pointB0Local = arc.startPoint();
    const pointB1Local = arc.endPoint();
    if (this._worldToLocalAffine) {
      pointA0Local = this._worldToLocalAffine.multiplyPoint3d(pointA0);
      pointA1Local = this._worldToLocalAffine.multiplyPoint3d(pointA1);
      this._worldToLocalAffine.multiplyXYAndZInPlace(pointB0Local);
      this._worldToLocalAffine.multiplyXYAndZInPlace(pointB1Local);
    }
    const alpha = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.center, 1);
    const beta = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector0, 0);
    const gamma = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector90, 0);
    // note really tight tol for tangency since below we check closest approach also
    let numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians, tol2);
    const closeApproach = (0 === numRoots);
    if (closeApproach)
      numRoots = 1; // we returned the closest approach instead: first entry is the arc point, which is all we need
    const roots: { fArc: number, fArcNearest01: number, fLine: number, arcPt: Point3d, linePt: Point3d }[] = [];
    for (let i = 0; i < numRoots; i++) {
      const arcPt = data.center.plus2Scaled(data.vector0, cosines.atUncheckedIndex(i), data.vector90, sines.atUncheckedIndex(i));
      const fArc = data.sweep.radiansToSignedFraction(radians.atUncheckedIndex(i), extendB0); // exterior fraction sign based on extend flags
      const fArcNearest01 = data.sweep.fractionToSignedPeriodicFraction(fArc, undefined); // exterior fraction sign based on proximity to 0/1
      const fLine = SmallSystem.lineSegment3dXYClosestPointUnbounded(pointA0Local, pointA1Local, arcPt);
      if (fLine !== undefined) {
        const linePt = pointA0Local.interpolate(fLine, pointA1Local);
        roots.push({ fArc, fArcNearest01, fLine, arcPt, linePt });
      }
    }
    // range-test and record roots
    for (const root of roots) {
      const { fArc, fArcNearest01, fLine, arcPt, linePt } = root;
      if (closeApproach && !Geometry.isDistanceWithinTol(arcPt.distanceSquaredXY(linePt), tol2)) {
        continue;
      }
      if (this.acceptFraction(extendA0, fLine, extendA1) && this.acceptFraction(extendB0, fArc, extendB1)) {
        this.recordPointWithLocalFractions(fLine, cpA, fractionA0, fractionA1, fArc, arc, 0, 1, reversed);
        continue;
      }
      // since line-arc chains are so common, look for near-endpoint intersections using distance tol, which is often relatively looser than fraction tol
      const inArcRange = extendB0 || extendB1 || Geometry.isIn01(fArc);
      const inLineRange = (extendA0 && fLine < 0) || (extendA1 && fLine > 1) || Geometry.isIn01(fLine);
      let accepted = false;
      if (inArcRange && !inLineRange) // check tangency near line endpoint
        accepted = recordIfNearIntersection(fLine < 0 ? 0 : 1, fArc, (fLine < 0 ? pointA0Local : pointA1Local).distanceSquaredXY(arcPt));
      else if (!inArcRange && inLineRange) // check tangency near arc endpoint
        accepted = recordIfNearIntersection(fLine, fArcNearest01 < 0 ? 0 : 1, linePt.distanceSquaredXY(fArcNearest01 < 0 ? pointB0Local : pointB1Local));
      if (!accepted) // check intersection between nearest endpoints
        recordIfNearIntersection(fLine < 0.5 ? 0 : 1, fArcNearest01 < 0.5 ? 0 : 1, (fLine < 0.5 ? pointA0Local : pointA1Local).distanceSquaredXY(fArcNearest01 < 0.5 ? pointB0Local : pointB1Local));
    }
  }

  /** Implementation of dispatchSegmentArc under perspective transform. KEEP IN SYNC WITH computeSegmentArc. */
  private computeSegmentArcHomogeneous(cpA: CurvePrimitive, extendA0: boolean, pointA0: Point3d, fractionA0: number, pointA1: Point3d, fractionA1: number, extendA1: boolean, arc: Arc3d, extendB0: boolean, extendB1: boolean, reversed: boolean): void {
    if (!this._worldToLocalPerspective)
      return;
    const tol2 = this._coincidentGeometryContext.tolerance * this._coincidentGeometryContext.tolerance;
    const cosines = new GrowableFloat64Array(2);
    const sines = new GrowableFloat64Array(2);
    const radians = new GrowableFloat64Array(2);
    const recordIfNearIntersection = (fA: number, fB: number, d2?: number): boolean => {
      if (d2 === undefined || !Geometry.isDistanceWithinTol(d2, tol2))
        return false;
      this.recordPointWithLocalFractions(fA, cpA, fractionA0, fractionA1, fB, arc, 0, 1, reversed);
      return true;
    };
    const data = arc.toTransformedPoint4d(this._worldToLocalPerspective);
    const pointA0H = this._worldToLocalPerspective.multiplyPoint3d(pointA0, 1);
    const pointA1H = this._worldToLocalPerspective.multiplyPoint3d(pointA1, 1);
    const pointB0H = this._worldToLocalPerspective.multiplyPoint3d(arc.startPoint(), 1);
    const pointB1H = this._worldToLocalPerspective.multiplyPoint3d(arc.endPoint(), 1);
    const alpha = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.center);
    const beta = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.vector0);
    const gamma = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.vector90);
    // note really tight tol for tangency since below we check closest approach also
    let numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians, tol2);
    const closeApproach = (0 === numRoots);
    if (closeApproach)
      numRoots = 1; // we returned the closest approach instead: first entry is the arc point, which is all we need
    const roots: { fArc: number, fArcNearest01: number, fLine: number, arcPt: Point4d, linePt: Point4d }[] = [];
    for (let i = 0; i < numRoots; i++) {
      const arcPt = data.center.plus2Scaled(data.vector0, cosines.atUncheckedIndex(i), data.vector90, sines.atUncheckedIndex(i));
      const fArc = data.sweep.radiansToSignedFraction(radians.atUncheckedIndex(i), extendB0); // exterior fraction sign based on extend flags
      const fArcNearest01 = data.sweep.fractionToSignedPeriodicFraction(fArc, undefined); // exterior fraction sign based on proximity to 0/1
      const fLine = SmallSystem.lineSegment3dHXYClosestPointUnbounded(pointA0H, pointA1H, arcPt);
      if (fLine !== undefined) {
        const linePt = pointA0H.interpolate(fLine, pointA1H);
        roots.push({ fArc, fArcNearest01, fLine, arcPt, linePt });
      }
    }
    // range-test and record roots
    for (const root of roots) {
      const { fArc, fArcNearest01, fLine, arcPt, linePt } = root;
      if (closeApproach) {
        const dist2 = arcPt.realDistanceSquaredXY(linePt);
        if (dist2 === undefined || !Geometry.isDistanceWithinTol(dist2, tol2))
          continue;
      }
      if (this.acceptFraction(extendA0, fLine, extendA1) && this.acceptFraction(extendB0, fArc, extendB1)) {
        this.recordPointWithLocalFractions(fLine, cpA, fractionA0, fractionA1, fArc, arc, 0, 1, reversed);
        continue;
      }
      // since line-arc chains are so common, look for near-endpoint intersections using distance tol, which is often relatively looser than fraction tol
      const inArcRange = extendB0 || extendB1 || Geometry.isIn01(fArc);
      const inLineRange = (extendA0 && fLine < 0) || (extendA1 && fLine > 1) || Geometry.isIn01(fLine);
      let accepted = false;
      if (inArcRange && !inLineRange) // check tangency near line endpoint
        accepted = recordIfNearIntersection(fLine < 0 ? 0 : 1, fArc, (fLine < 0 ? pointA0H : pointA1H).realDistanceSquaredXY(arcPt));
      else if (!inArcRange && inLineRange) // check tangency near arc endpoint
        accepted = recordIfNearIntersection(fLine, fArcNearest01 < 0 ? 0 : 1, linePt.realDistanceSquaredXY(fArcNearest01 < 0 ? pointB0H : pointB1H));
      if (!accepted) // check intersection between nearest endpoints
        recordIfNearIntersection(fLine < 0.5 ? 0 : 1, fArcNearest01 < 0.5 ? 0 : 1, (fLine < 0.5 ? pointA0H : pointA1H).realDistanceSquaredXY(fArcNearest01 < 0.5 ? pointB0H : pointB1H));
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
    // Arc:  X(theta) = C + cos(theta)·U + sin(theta)·V
    // Line:  contains points A0,A1
    // Arc point X is colinear (intersects) with line if det(A0, A1, X) = 0 with homogeneous xyw points and vectors
    // This leads to
    // det(A0, A1, C) + cos(theta) det(A0, A1, U) + sin(theta) det(A0, A1, V) = 0
    // or
    // alpha + beta cos(theta) + gamma sin(theta) = 0
    // solve for theta; evaluate points; project back to line
    if (this._worldToLocalPerspective)
      this.computeSegmentArcHomogeneous(cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1, arc, extendB0, extendB1, reversed);
    else
      this.computeSegmentArc(cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1, arc, extendB0, extendB1, reversed);
  }
  /**
   * Return the sine of the xy-angle from the tangent of `arcA` at `fractionA` to the tangent of `arcB` at `fractionB`,
   * or undefined if either tangent is zero.
   */
  private static tangentSineXY(arcA: Arc3d, fractionA: number, arcB: Arc3d, fractionB: number): number | undefined {
    const tangentA = arcA.fractionToPointAndDerivative(fractionA, CurveCurveIntersectXY._workRayA).direction;
    const tangentB = arcB.fractionToPointAndDerivative(fractionB, CurveCurveIntersectXY._workRayB).direction;
    const magnitudes = tangentA.magnitudeXY() * tangentB.magnitudeXY();
    return magnitudes === 0 ? undefined : tangentA.crossProductXY(tangentB) / magnitudes;
  }
  /**
   * Whether `arcA` at `fractionA` and `arcB` at `fractionB` turn to opposite sides of the xy-tangent of `arcA`, that is,
   * whether near-tangent arcs are externally tangent there.
   */
  private static turnToOppositeSidesXY(arcA: Arc3d, fractionA: number, arcB: Arc3d, fractionB: number): boolean {
    const planeA = arcA.fractionToPointAnd2Derivatives(fractionA, CurveCurveIntersectXY._workPlaneA);
    const planeB = arcB.fractionToPointAnd2Derivatives(fractionB, CurveCurveIntersectXY._workPlaneB);
    // the sign of the cross product of the tangent with the second derivative tells to which side of the tangent an arc turns
    return planeA.vectorU.crossProductXY(planeA.vectorV) * planeA.vectorU.crossProductXY(planeB.vectorV) < 0;
  }
  /**
   * Examine an isolated intersection of `arc` and `other` near the nearest endpoint of `arc`.
   * @returns the endpoint fraction of `arc` and the fraction of its projection on `other` if the intersection is a
   * candidate to move to that endpoint, or undefined otherwise. See [[findNearTangentSnap]].
   */
  private snapToEndOfArc(
    arc: Arc3d, fraction: number, extend0: boolean, extend1: boolean, other: Arc3d, otherFraction: number,
  ): { fraction: number, otherFraction: number } | undefined {
    if (arc.sweep.isFullCircle)
      return undefined; // closed arc has no end to snap to
    const endFraction = fraction < 0.5 ? 0 : 1;
    if (endFraction === 0 ? extend0 : extend1)
      return undefined;
    const tol = this._coincidentGeometryContext.tolerance;
    // The snapped intersection is merged with nearby vertices at distance tolerance, so require a margin below it. Near
    // the tolerance, roundoff would decide whether the intersection moves.
    const snapTol = CurveCurveIntersectXY._snapToleranceFactor * tol;
    const point = arc.fractionToPoint(fraction, CurveCurveIntersectXY._workPointAA0);
    const endPoint = arc.fractionToPoint(endFraction, CurveCurveIntersectXY._workPointAA1);
    const distance = point.distanceXY(endPoint);
    if (distance <= tol)
      return undefined; // already within clustering distance of the endpoint
    const sine = CurveCurveIntersectXY.tangentSineXY(arc, fraction, other, otherFraction);
    // Locally the separation of the arcs is s(u) = sine * u + c * u * u at distance u from the intersection. If the
    // midpoint and the endpoint are within snapTol of the other arc, then |sine| * distance <= 4 * snapTol (attained
    // when the endpoint is at the other root of s), so this test quickly rejects transverse crossings without
    // rejecting any intersection that passes the tests below.
    if (sine === undefined || Math.abs(sine) * distance > CurveCurveIntersectXY._separationBoundFactor * snapTol)
      return undefined;
    // the endpoint must be near the other arc...
    const closest = other.closestPointXY(endPoint, false);
    if (!closest || closest.a > snapTol)
      return undefined;
    // ...and so must the arc between the intersection and the endpoint (check the midpoint)...
    const midPoint = arc.fractionToPoint(0.5 * (fraction + endFraction), CurveCurveIntersectXY._workPointBB0);
    const closestToMidPoint = other.closestPointXY(midPoint, false);
    if (!closestToMidPoint || closestToMidPoint.a > snapTol)
      return undefined;
    // ...and the arcs must come together toward the endpoint because they curve differently (a near tangency), not
    // separate at a nearly constant small angle (a transverse crossing of arcs of almost equal curvature). For the
    // quadratic s above, the ratio of the sines at the endpoint and at the intersection is 1 for equal curvatures, 0 at
    // the extremum of s, and -1 at the other root of s. Require the endpoint to be at least halfway from the intersection
    // to the extremum, and not past the extremum beyond roundoff: past it, the arcs cross again toward the endpoint, and
    // the endpoint is not where they touch.
    const endSine = CurveCurveIntersectXY.tangentSineXY(arc, endFraction, other, closest.fraction);
    if (endSine === undefined || endSine * sine > CurveCurveIntersectXY._endSineRatioLimit * sine * sine || endSine * sine <= -sine * sine)
      return undefined;
    if (endSine * sine < 0 && Math.abs(endSine) > Geometry.smallFraction)
      return undefined;
    // ...and the arcs must turn to opposite sides at the endpoint (externally tangent, as a fillet outside a circle). If
    // they turn to the same side (internally tangent), the moved intersection would be a vertex where the arcs leave in
    // the same direction and stay on the same side of their tangent, and their order at that vertex is unreliable.
    if (!CurveCurveIntersectXY.turnToOppositeSidesXY(arc, endFraction, other, closest.fraction))
      return undefined;
    return { fraction: endFraction, otherFraction: closest.fraction };
  }
  /**
   * Examine an isolated intersection of two near-tangent xy-arcs near an endpoint of one of the arcs.
   * * Two arcs that are tangent to within tolerance can have an isolated intersection that is a short distance (much
   * larger than tolerance) from an endpoint of one arc, yet the arcs are within tolerance of each other between the
   * intersection and the endpoint.
   * * Such an intersection is a candidate to move to the endpoint if the nearest endpoint of an arc is not extended, is
   * farther than the distance tolerance from the intersection, lies well within the distance tolerance of the other arc,
   * the arc between the intersection and that endpoint stays well within the distance tolerance of the other arc, the
   * angle between the arcs decreases toward the endpoint (the arcs are near-tangent there rather than crossing at a small
   * angle), and the arcs are externally tangent there (they turn to opposite sides). See
   * [[snapNearTangentIntersectionsToEndpoints]] for when a candidate is actually moved.
   * @returns the arc with the endpoint, the endpoint fraction, the other arc and the fraction of the endpoint's
   * projection on it, or undefined if the intersection is not a candidate.
   */
  private findNearTangentSnap(
    arcA: Arc3d, fractionA: number, extendA0: boolean, extendA1: boolean,
    arcB: Arc3d, fractionB: number, extendB0: boolean, extendB1: boolean,
  ): Omit<NearTangentSnap, "pair"> | undefined {
    const snappedB = this.snapToEndOfArc(arcB, fractionB, extendB0, extendB1, arcA, fractionA);
    if (snappedB)
      return { arc: arcB, fraction: snappedB.fraction, other: arcA, otherFraction: snappedB.otherFraction };
    const snappedA = this.snapToEndOfArc(arcA, fractionA, extendA0, extendA1, arcB, fractionB);
    if (snappedA)
      return { arc: arcA, fraction: snappedA.fraction, other: arcB, otherFraction: snappedA.otherFraction };
    return undefined;
  }
  /**
   * Whether a curve that is neither `otherArc` nor `arc`, nor coincident with `otherArc`, nor on its extension (as
   * another piece of the same ellipse) has an isolated intersection with `arc` within `tol` of `point`, or has an
   * isolated intersection with `otherArc` and an endpoint within `2 * tol` of `point` (e.g. the fillet of a neighbouring
   * shape that starts there and is itself near-tangent to `otherArc`).
   * * Only a curve that is tangent to `otherArc` at `point` (sine of the angle below [[_tangentSineTolerance]]) and
   * stays within `tol` of `otherArc` over the distance `moveDistance` from `point` counts. A curve that leaves `otherArc`
   * sooner (e.g. a line at a small angle to it) does not keep the moved intersection from being merged with the endpoint.
   */
  private hasForeignCurveAtPoint(arc: Arc3d, point: Point3d, tol: number, otherArc: Arc3d, moveDistance: number): boolean {
    let fullEllipse: Arc3d | undefined;
    for (const pair of this._results) {
      for (const [detail, partner] of [[pair.detailA, pair.detailB], [pair.detailB, pair.detailA]]) {
        const partnerCurve = partner.curve;
        if (!partnerCurve || detail.isInterval() || partnerCurve === otherArc || partnerCurve === arc)
          continue;
        if (detail.curve === arc) {
          if (detail.point.distanceXY(point) > tol)
            continue;
        } else if (detail.curve === otherArc) {
          const endTol = CurveCurveIntersectXY._foreignEndpointToleranceFactor * tol;
          if (partnerCurve.startPoint().distanceXY(point) > endTol && partnerCurve.endPoint().distanceXY(point) > endTol)
            continue;
        } else {
          continue;
        }
        if (this.hasCoincidentInterval(partnerCurve, otherArc))
          continue;
        if (!fullEllipse)
          fullEllipse = Arc3d.create(otherArc.center, otherArc.vector0, otherArc.vector90, AngleSweep.create360());
        const onExtension = fullEllipse.closestPointXY(partnerCurve.fractionToPoint(0.5), false);
        if (onExtension && onExtension.a <= tol)
          continue; // another piece of the same ellipse
        // only a curve that leaves the point tangent to the other arc (e.g. a fillet) is foreign, not a curve that
        // crosses it there or is only nearly tangent to it (e.g. a line at a small angle)
        const partnerFraction = partnerCurve.startPoint().distanceXY(point) <= partnerCurve.endPoint().distanceXY(point) ? 0 : 1;
        const partnerTangent = partnerCurve.fractionToPointAndDerivative(partnerFraction, CurveCurveIntersectXY._workRayA).direction;
        const closest = otherArc.closestPointXY(point, false);
        if (!closest)
          continue;
        const otherTangent = otherArc.fractionToPointAndDerivative(closest.fraction, CurveCurveIntersectXY._workRayB).direction;
        const magnitudes = partnerTangent.magnitudeXY() * otherTangent.magnitudeXY();
        if (magnitudes === 0 || Math.abs(partnerTangent.crossProductXY(otherTangent)) > CurveCurveIntersectXY._tangentSineTolerance * magnitudes)
          continue;
        const partnerLength = partnerCurve.curveLength();
        const step = partnerLength > 0 ? Math.min(1, moveDistance / partnerLength) : 0;
        const sample = fullEllipse.closestPointXY(partnerCurve.fractionToPoint(partnerFraction === 0 ? step : 1 - step), false);
        if (sample && sample.a <= tol)
          return true;
      }
    }
    return false;
  }
  /** Whether a coincident interval between `curveA` and `curveB` has been recorded. */
  private hasCoincidentInterval(curveA: CurvePrimitive, curveB: CurvePrimitive): boolean {
    for (const pair of this._results) {
      if (pair.detailA.isInterval() && ((pair.detailA.curve === curveA && pair.detailB.curve === curveB)
        || (pair.detailA.curve === curveB && pair.detailB.curve === curveA)))
        return true;
    }
    return false;
  }
  /**
   * Whether `point` is within `tol` of an endpoint of `otherArc` where another curve of the same region as `otherArc`
   * starts or ends and leaves at an angle to `otherArc` (sine of the angle above [[_tangentSineTolerance]]), that is,
   * whether `point` is a corner of that region, as where an arc of a loop is followed by a chord, and no curve
   * coincident with `otherArc` passes through `point`.
   * * Curves of the same region have the same `parent` (set by region booleans to the region group member). Curves
   * without `parent` are treated as one region, e.g. if [[allIntersectionsAmongPrimitivesXY]] is called with curves that
   * do not come from region booleans. Then a curve of another shape can make a corner too, which only keeps more intersections where they were
   * computed. Other curves, e.g. the bridge segments that region booleans add to connect loops, are not part of the
   * corner.
   * * Moving an intersection of `arc` with `otherArc` to such a corner makes it a vertex where `arc` and `otherArc` (and
   * the curves coincident with it, which end there too) leave in nearly the same direction, next to the curve that
   * leaves the corner, and the order of the edges at that vertex was found to be unreliable. If a coincident curve passes
   * through the corner (e.g. a circle that a sector of another region shares an arc with), the move is kept.
   * * `pairs` are the recorded pairs with a detail on `otherArc`.
   */
  private isCornerOfArc(
    otherArc: Arc3d, point: Point3d, arc: Arc3d, pairs: CurveLocationDetailPair[] | undefined, tol: number,
  ): boolean {
    if (!pairs || otherArc.sweep.isFullCircle)
      return false;
    let otherFraction: number;
    if (otherArc.startPoint(CurveCurveIntersectXY._workPointAA0).distanceXY(point) <= tol)
      otherFraction = 0;
    else if (otherArc.endPoint(CurveCurveIntersectXY._workPointAA0).distanceXY(point) <= tol)
      otherFraction = 1;
    else
      return false;
    for (const pair of pairs) {
      const partner = pair.detailA.curve === otherArc ? pair.detailB.curve : pair.detailA.curve;
      if (!(partner instanceof Arc3d) || partner === otherArc || !pair.detailA.isInterval())
        continue;
      if (partner.sweep.isFullCircle
        || (partner.startPoint(CurveCurveIntersectXY._workPointBB0).distanceXY(point) > tol && partner.endPoint(CurveCurveIntersectXY._workPointBB0).distanceXY(point) > tol)) {
        const closest = partner.closestPointXY(point, false);
        if (closest && closest.a <= tol)
          return false; // a coincident curve passes through the point
      }
    }
    const otherTangent = otherArc.fractionToPointAndDerivative(otherFraction, CurveCurveIntersectXY._workRayB).direction;
    for (const pair of pairs) {
      const partner = pair.detailA.curve === otherArc ? pair.detailB.curve : pair.detailA.curve;
      if (!partner || partner === otherArc || partner === arc || partner.parent !== otherArc.parent || pair.detailA.isInterval())
        continue;
      let partnerFraction: number;
      if (partner.startPoint(CurveCurveIntersectXY._workPointBB0).distanceXY(point) <= tol)
        partnerFraction = 0;
      else if (partner.endPoint(CurveCurveIntersectXY._workPointBB0).distanceXY(point) <= tol)
        partnerFraction = 1;
      else
        continue;
      const partnerTangent = partner.fractionToPointAndDerivative(partnerFraction, CurveCurveIntersectXY._workRayA).direction;
      const magnitudes = partnerTangent.magnitudeXY() * otherTangent.magnitudeXY();
      if (magnitudes > 0 && Math.abs(partnerTangent.crossProductXY(otherTangent)) > CurveCurveIntersectXY._tangentSineTolerance * magnitudes)
        return true;
    }
    return false;
  }
  /**
   * Return the end of a recorded coincident interval of `curve` with a curve other than `excludedCurve` that is closest
   * to `point` within `tol`, or undefined if there is none.
   */
  private closestCoincidentIntervalEnd(
    curve: CurvePrimitive, point: Point3d, tol: number, excludedCurve: CurvePrimitive,
  ): { fraction: number, point: Point3d } | undefined {
    let result: { fraction: number, point: Point3d } | undefined;
    let minDist = tol;
    for (const pair of this._results) {
      if (pair.detailA.curve === excludedCurve || pair.detailB.curve === excludedCurve)
        continue;
      const detail = pair.detailA.curve === curve ? pair.detailA : pair.detailB.curve === curve ? pair.detailB : undefined;
      if (!detail || !detail.isInterval())
        continue;
      for (const [fraction, end] of [[detail.fraction, detail.point], [detail.fraction1, detail.point1]] as const) {
        const dist = end.distanceXY(point);
        if (dist <= minDist) {
          minDist = dist;
          result = { fraction, point: end.clone() };
        }
      }
    }
    return result;
  }
  /**
   * Return xy intersections among all pairs of the input curves.
   * @param primitives input curves to intersect
   * @param tolerance distance tolerance for coincidence
   * @param options what to compute, see [[AllIntersectionsAmongPrimitivesXYOptions]]
   */
  public static allIntersectionsAmongPrimitivesXY(
    primitives: CurvePrimitive[], tolerance: number, options?: AllIntersectionsAmongPrimitivesXYOptions,
  ): AllIntersectionsAmongPrimitivesXY {
    const handler = new CurveCurveIntersectXY(undefined, false, undefined, false, tolerance);
    handler._coincidentGeometryContext.reportBackwardWrappedArcOverlaps = options?.reportBackwardWrappedArcOverlaps ?? true;
    for (let i = 0; i < primitives.length; i++) {
      const curveA = primitives[i];
      for (let j = i + 1; j < primitives.length; j++) {
        handler.resetGeometryB(primitives[j]);
        curveA.dispatchToGeometryHandler(handler);
      }
    }
    const unsnappedPairs = options?.keepUnsnappedPairs ? [] : undefined;
    const numMoved = options?.snapNearTangent ? handler.snapNearTangentIntersectionsToEndpoints(unsnappedPairs) : 0;
    return {
      pairs: handler.grabPairedResults(),
      unsnappedPairs: numMoved > 0 ? unsnappedPairs : undefined,
      numBackwardWrappedArcOverlaps: handler._coincidentGeometryContext.numBackwardWrappedArcOverlaps,
    };
  }
  /**
   * Move recorded near-tangent arc-arc intersections to the nearby arc endpoint if a coincident overlap of the other arc
   * with a third arc starts or ends there.
   * * Call this after recording the intersections among all curves that will be assembled into a planar subdivision.
   * * Typically the arc ends where the next curve of its loop starts to overlap the other arc (a cusp, as with a fillet
   * outside a circle and an arc shared with the circle). The endpoint and the nearby point on the other arc are then
   * vertices, and a near-tangent intersection a short distance from the endpoint leaves a sliver bigon whose two edges
   * are ordered at the endpoint by the (indeterminate) tangent comparison, and at the other end of the bigon by the
   * crossing, yielding an inconsistent graph. Moving the intersection to the endpoint removes the bigon. On the other
   * arc, the intersection is moved to the end of the overlap, so that both become the same vertex.
   * * Otherwise the intersection is not moved. For instance, if the next curve runs alongside the other arc but is not
   * coincident with it, moving the intersection would create a vertex from which these two curves leave in the same
   * direction, that is, it would create such a bigon instead of removing one.
   * * The intersection is not moved either if, on one of the two arcs, another intersection lies between the old and the
   * new location (measured by xy-distance, not by arc fraction), or within twice the moved distance of the old location.
   * Moving it would then reorder or merge vertices of the arc. The exception is an intersection at the old location with
   * a third arc that is coincident with the other arc and passes through its new location: this is the same crossing,
   * so it is moved along, unless the third arc would leave the new location to the other side than at the crossing (see
   * [[isVertexMisorderedXY]]).
   * * The intersection is not moved either if the new location on the other arc (or on the third arc, for an intersection
   * moved along) is a corner of the region of that arc, where it ends and another curve of the region leaves at an
   * angle (see [[isCornerOfArc]]).
   * * The intersection is not moved either if the arc would leave the new location to the other side of the other arc
   * than at the crossing (see [[isVertexMisorderedXY]]).
   * * All decisions are made before any intersection is moved.
   * * See [[findNearTangentSnap]] for the intersections that are candidates.
   * @param unsnappedResults optional array to receive copies of all results before the first intersection is moved. It
   * is not changed if no intersection is moved.
   * @returns the number of near-tangent intersections that were moved.
   */
  public snapNearTangentIntersectionsToEndpoints(unsnappedResults?: CurveLocationDetailPair[]): number {
    const tol = this._coincidentGeometryContext.tolerance;
    const candidates = this.collectNearTangentCandidates(tol);
    let numMoved = 0;
    if (candidates.length > 0) {
      const blocked = this.findBlockedNearTangentCandidates(candidates, tol);
      for (let i = 0; i < candidates.length; i++) {
        if (blocked.has(i))
          continue;
        if (numMoved++ === 0 && unsnappedResults)
          for (const pair of this._results)
            unsnappedResults.push(pair.clone());
        for (const move of candidates[i].moves)
          move.detail.setFP(move.fraction, move.point.clone());
      }
    }
    this._nearTangentSnaps = [];
    return numMoved;
  }
  /**
   * Whether the edges of `arcA` and `arcB` that leave a vertex at `vertexFractionA` and `vertexFractionB` may be ordered
   * by a planar subdivision differently than the near-tangent arcs cross at `fractionA` and `fractionB`.
   * * A planar subdivision orders the edges at a vertex by tangent angle, and by curvature only where the angles agree to
   * within its angle tolerance, which is Geometry.smallAngleRadians for region booleans. The curvature order is right for
   * externally tangent arcs, and the angle order agrees with it if `arcA` leaves the vertex to the same side of `arcB` as
   * at the crossing. So the edges are misordered if the sine of the angle between the arcs changes sign from the crossing
   * to the vertex and exceeds Geometry.smallAngleRadians at the vertex.
   * * A caller with a larger angle tolerance (e.g. RegionOps.constructAllXYRegionLoops) gets a stricter test than needed,
   * which only keeps more intersections where they were computed.
   */
  private static isVertexMisorderedXY(
    arcA: Arc3d, fractionA: number, arcB: Arc3d, fractionB: number, vertexFractionA: number, vertexFractionB: number,
  ): boolean {
    const sine = CurveCurveIntersectXY.tangentSineXY(arcA, fractionA, arcB, fractionB);
    const vertexSine = CurveCurveIntersectXY.tangentSineXY(arcA, vertexFractionA, arcB, vertexFractionB);
    return sine === undefined || vertexSine === undefined
      || (vertexSine * sine < 0 && Math.abs(vertexSine) > Geometry.smallAngleRadians);
  }
  /**
   * Return the recorded near-tangent intersections that are still recorded and whose arc endpoint is where a coincident
   * overlap of the other arc ends, with their planned moves. A candidate is marked as blocked if another curve leaves the
   * endpoint tangent to the other arc, or if the moved intersection would be a misordered vertex.
   */
  private collectNearTangentCandidates(tol: number): NearTangentCandidate[] {
    const candidates: NearTangentCandidate[] = [];
    const recorded = new Set(this._results);
    for (const snap of this._nearTangentSnaps) {
      if (!recorded.has(snap.pair))
        continue; // the pair was replaced, e.g. by conversion to a chain detail
      const endPoint = snap.arc.fractionToPoint(snap.fraction);
      const overlapEnd = this.closestCoincidentIntervalEnd(snap.other, endPoint, tol, snap.arc);
      if (!overlapEnd)
        continue;
      // Another curve that is not coincident with the other arc leaves the endpoint nearly tangent to it (e.g. the fillet
      // of a neighbouring shape that starts there): the endpoint would become a vertex of two curves tangent to the other
      // arc. Such a candidate is not moved, and it also blocks the candidates moving to the same endpoint (see
      // findBlockedNearTangentCandidates).
      const arcIsA = snap.pair.detailA.curve === snap.arc;
      const arcDetail = arcIsA ? snap.pair.detailA : snap.pair.detailB;
      const otherDetail = arcIsA ? snap.pair.detailB : snap.pair.detailA;
      const hasForeignCurve = this.hasForeignCurveAtPoint(snap.arc, endPoint, tol, snap.other, arcDetail.point.distanceXY(endPoint));
      // The overlap must end near the projection of the endpoint on the other arc. If they are almost a tolerance apart,
      // whether the moved intersection and the end of the overlap are merged into one vertex is decided by roundoff.
      if (overlapEnd.point.distanceXY(snap.other.fractionToPoint(snap.otherFraction)) > CurveCurveIntersectXY._overlapEndToleranceFactor * tol)
        continue;
      const otherFraction = overlapEnd.fraction;
      const otherPoint = overlapEnd.point;
      // At the new vertex, the arc and the other arc leave in nearly the same direction. Check their order at the vertex,
      // that is, at the end of the overlap on the other arc, not at the projection of the endpoint tested in
      // snapToEndOfArc: the two points can be a small fraction of the tolerance apart, and between them the tangent of the
      // other arc turns by their distance over its radius of curvature.
      const misordered = CurveCurveIntersectXY.isVertexMisorderedXY(
        snap.arc, arcDetail.fraction, snap.other, otherDetail.fraction, snap.fraction, otherFraction);
      candidates.push({
        snap, endPoint,
        sides: [
          { curve: snap.arc, oldPoint: arcDetail.point, newFraction: snap.fraction, newPoint: endPoint, counterpart: snap.other, counterpartPoint: otherPoint },
          { curve: snap.other, oldPoint: otherDetail.point, newFraction: otherFraction, newPoint: otherPoint, counterpart: snap.arc, counterpartPoint: endPoint },
        ],
        moves: [
          { detail: arcDetail, fraction: snap.fraction, point: endPoint },
          { detail: otherDetail, fraction: otherFraction, point: otherPoint },
        ],
        blocked: hasForeignCurve || misordered,
      });
    }
    return candidates;
  }
  /**
   * Return the indices of the candidates that must not move: blocked when collected, moving to a corner of the region of
   * the other arc, blocked by another intersection on one of their arcs (see [[isSideBlocked]]), or moving to the same
   * target as a blocked candidate. Adds the intersections that are moved along to the moves of a candidate.
   */
  private findBlockedNearTangentCandidates(candidates: NearTangentCandidate[], tol: number): Set<number> {
    // index the recorded pairs by curve, and the candidate targets by pair, so the test is linear in the number of pairs
    // on the two arcs of a candidate rather than in the number of all pairs
    const targetsByPair = new Map<CurveLocationDetailPair, Point3d[]>();
    for (const c of candidates) {
      const targets = targetsByPair.get(c.snap.pair);
      if (targets)
        targets.push(c.endPoint);
      else
        targetsByPair.set(c.snap.pair, [c.endPoint]);
    }
    const pairsByCurve = new Map<CurvePrimitive | undefined, CurveLocationDetailPair[]>();
    for (const pair of this._results) {
      for (const curve of pair.detailA.curve === pair.detailB.curve ? [pair.detailA.curve] : [pair.detailA.curve, pair.detailB.curve]) {
        const pairs = pairsByCurve.get(curve);
        if (pairs)
          pairs.push(pair);
        else
          pairsByCurve.set(curve, [pair]);
      }
    }
    const blocked = new Set<number>();
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.blocked
        || this.isCornerOfArc(candidate.snap.other, candidate.sides[1].newPoint, candidate.snap.arc, pairsByCurve.get(candidate.snap.other), tol)
        || candidate.sides.some((side) => this.isSideBlocked(candidate, side, pairsByCurve, targetsByPair, tol)))
        blocked.add(i);
    }
    // Candidates moving to the same target skip each other in isSideBlocked, so they must move together: if one of them
    // is blocked, so are the others (else, e.g., the intersection of a fillet with a circle stays while the one with an
    // arc coincident with the circle moves).
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < candidates.length; i++) {
        if (blocked.has(i))
          continue;
        for (const j of blocked) {
          if (candidates[i].endPoint.distanceXY(candidates[j].endPoint) <= tol) {
            blocked.add(i);
            changed = true;
            break;
          }
        }
      }
    }
    return blocked;
  }
  /**
   * Whether another recorded intersection on `side.curve` keeps `candidate` from moving: it lies between the old and the
   * new location on that arc, or within [[_nearOldLocationSpanFactor]] times the moved distance of the old location.
   * * Intersections of candidates moving to the same target, and intersections already at the new location, are skipped.
   * * An intersection at the old location with a third arc that is coincident with the counterpart arc and passes
   * through its new location is the same crossing: it is added to the moves of the candidate instead, unless its new
   * location is a corner of the region of the third arc, or the third arc would be misordered there with `side.curve`
   * (see [[isVertexMisorderedXY]]). The third arc can be turned to the other side than the counterpart arc by much more
   * than the angle tolerance of the planar subdivision, e.g. if its center is off by a fraction of the tolerance.
   */
  private isSideBlocked(
    candidate: NearTangentCandidate, side: NearTangentSide, pairsByCurve: Map<CurvePrimitive | undefined, CurveLocationDetailPair[]>,
    targetsByPair: Map<CurveLocationDetailPair, Point3d[]>, tol: number,
  ): boolean {
    const span = side.oldPoint.distanceXY(side.newPoint);
    for (const pair of pairsByCurve.get(side.curve) ?? []) {
      if (pair === candidate.snap.pair || (targetsByPair.get(pair)?.some((target) => target.distanceXY(candidate.endPoint) <= tol) ?? false))
        continue; // the candidate itself, or a candidate moving to the same target
      for (const [detail, otherDetail] of [[pair.detailA, pair.detailB], [pair.detailB, pair.detailA]]) {
        if (detail.curve !== side.curve)
          continue;
        const points = detail.isInterval() ? [detail.point, detail.point1] : [detail.point];
        for (const point of points) {
          if (point.distanceXY(side.newPoint) <= tol)
            continue; // already at the new location
          const distToOld = point.distanceXY(side.oldPoint);
          const atOld = distToOld <= tol;
          if (!atOld && distToOld > CurveCurveIntersectXY._nearOldLocationSpanFactor * span && distToOld + point.distanceXY(side.newPoint) > span + tol)
            continue; // neither between the old and new location nor near the old location
          const moveAlong = atOld ? this.findMoveAlong(detail, otherDetail, side, pairsByCurve, tol) : undefined;
          if (!moveAlong)
            return true;
          candidate.moves.push({ detail, fraction: side.newFraction, point: side.newPoint });
          candidate.moves.push({ detail: otherDetail, fraction: moveAlong.fraction, point: moveAlong.point });
        }
      }
    }
    return false;
  }
  /**
   * If `detail` on `side.curve` at the old location is an isolated intersection with a third arc (`otherDetail`) that is
   * coincident with the counterpart arc and passes through the new location of the counterpart, return the new location
   * on the third arc, unless that is a corner of its region or the third arc and `side.curve` would be misordered there.
   */
  private findMoveAlong(
    detail: CurveLocationDetail, otherDetail: CurveLocationDetail, side: NearTangentSide,
    pairsByCurve: Map<CurvePrimitive | undefined, CurveLocationDetailPair[]>, tol: number,
  ): { fraction: number, point: Point3d } | undefined {
    const thirdArc = otherDetail.curve;
    if (detail.isInterval() || thirdArc === side.counterpart || !(thirdArc instanceof Arc3d) || !this.hasCoincidentInterval(thirdArc, side.counterpart))
      return undefined;
    const closest = thirdArc.closestPointXY(side.counterpartPoint, false);
    if (!closest || closest.point.distanceXY(side.counterpartPoint) > tol)
      return undefined; // not the same crossing
    if (this.isCornerOfArc(thirdArc, closest.point, side.curve, pairsByCurve.get(thirdArc), tol))
      return undefined;
    if (CurveCurveIntersectXY.isVertexMisorderedXY(side.curve, detail.fraction, thirdArc, otherDetail.fraction, side.newFraction, closest.fraction))
      return undefined;
    return { fraction: closest.fraction, point: closest.point };
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
          const numResults = this._results.length;
          this.recordPointWithLocalFractions(fractionA, cpA, 0, 1, fractionB, cpB, 0, 1, reversed);
          if (this._results.length > numResults && !this._worldToLocalPerspective && !this._worldToLocalAffine) {
            const snap = this.findNearTangentSnap(cpA, fractionA, extendA0, extendA1, cpB, fractionB, extendB0, extendB1);
            if (snap)
              this._nearTangentSnaps.push({ pair: this._results[numResults], ...snap });
          }
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
      const roots = univariateBezierB.roots(0.0, true);
      if (roots) {
        const strictTolerance = this._coincidentGeometryContext.tolerance * 0.0001;
        for (const r of roots) {
          let bezierBFraction = r;
          bezierB.fractionToPoint4d(bezierBFraction, this._xyzwB);
          const segmentAFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(this._xyzwA0, this._xyzwA1, this._xyzwB);
          if (segmentAFraction !== undefined && Geometry.isIn01WithTolerance(segmentAFraction, intervalTolerance)) {
            let bezierAFraction = Geometry.interpolate(f0, segmentAFraction, f1);
            // We have a near intersection at fractions on the two beziers
            // Iterate on the curves for a true intersection
            const xyMatchingFunction = new CurveCurveIntersectionXYRRToRRD(bezierA, bezierB);
            const newtonSearcher = new Newton2dUnboundedWithDerivative(xyMatchingFunction);
            newtonSearcher.setUV(bezierAFraction, bezierBFraction);
            let converged = newtonSearcher.runIterations();
            bezierAFraction = newtonSearcher.getU();
            bezierBFraction = newtonSearcher.getV();
            const bcurveAFraction = bezierA.fractionToParentFraction(bezierAFraction);
            const bcurveBFraction = bezierB.fractionToParentFraction(bezierBFraction);
            if (this.acceptFraction(false, bcurveAFraction, false) && this.acceptFraction(false, bcurveBFraction, false)) {
              const pointA = bezierA.fractionToPoint(bezierAFraction, CurveCurveIntersectXY._workPointA0);
              const pointB = bezierB.fractionToPoint(bezierBFraction, CurveCurveIntersectXY._workPointB0);
              if (!converged) { // Newton may have found close points even if it didn't converge parametrically
                converged = pointA.isAlmostEqualXY(pointB, strictTolerance); // we can afford to be choosy
              }
              if (converged)
                this.recordPointWithLocalFractions(bcurveAFraction, bcurveA, 0, 1, bcurveBFraction, bcurveB, 0, 1, reversed);
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
   * Process tail of `this._results` for xy-intersections between the curve and spiral.
   * * Refine each result via Newton iteration. If it doesn't converge, remove it.
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
    const maxIterations = 50;
    const newtonSearcher = new Newton2dUnboundedWithDerivative(xyMatchingFunction, maxIterations);
    const fractionTol = 2 * newtonSearcher.stepSizeTolerance; // relative cluster diameter for Newton convergence
    const compare = CurveLocationDetailPair.comparePairsByFractions(fractionTol, this._coincidentGeometryContext.tolerance, true);
    const myResults = new SortedArray<CurveLocationDetailPair>(compare, DuplicatePolicy.Retain);
    const pushToMyResults = (cpA: CurvePrimitive, fA: number, pA: Point3d, cpB: CurvePrimitive, fB: number, pB: Point3d): void => {
      const detailA = CurveLocationDetail.createCurveFractionPoint(cpA, fA, pA);
      const detailB = CurveLocationDetail.createCurveFractionPoint(cpB, fB, pB);
      detailA.setIntervalRole(CurveIntervalRole.isolated);
      detailB.setIntervalRole(CurveIntervalRole.isolated);
      myResults.insert(new CurveLocationDetailPair(reversed ? detailB : detailA, reversed ? detailA : detailB));
    };
    const strictTolerance = this._coincidentGeometryContext.tolerance * 0.0001;
    for (let i = index0; i < this._results.length; i++) {
      const pair = this._results[i];
      const detailA = reversed ? pair.detailB : pair.detailA;
      const detailB = reversed ? pair.detailA : pair.detailB;
      assert(detailB.curve instanceof LineString3d, "Caller has discretized the spiral");
      const extendA0 = reversed ? this._extendB0 : this._extendA0;
      const extendA1 = reversed ? this._extendB1 : this._extendA1;
      newtonSearcher.setUV(detailA.fraction, detailB.fraction); // use linestring fraction as spiral param; it generally yields a closer point than fractional length!
      let converged = newtonSearcher.runIterations();
      const fractionA = newtonSearcher.getU();
      const fractionB = newtonSearcher.getV();
      // note looser tol for spiral, which can have high order tangency at start/end
      if (this.acceptFraction(extendA0, fractionA, extendA1) && this.acceptFraction(false, fractionB, false, Geometry.smallFraction)) {
        const pointA = curveA.fractionToPoint(fractionA, CurveCurveIntersectXY._workPointA0);
        const pointB = spiralB.fractionToPoint(fractionB, CurveCurveIntersectXY._workPointB0);
        if (!converged) // Newton may have found close points even if it didn't converge parametrically
          converged = pointA.isAlmostEqualXY(pointB, strictTolerance); // we can afford to be choosy
        if (converged)
          pushToMyResults(curveA, fractionA, pointA, spiralB, fractionB, pointB);
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
    // NEEDS WORK -- make "dispatch" methods tolerant of both 3d and 3dH .
    // "easy" if both present BezierCurve3dH span loaders
    return undefined;
  }
}
