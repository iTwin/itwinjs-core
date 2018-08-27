/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { GeometryQuery } from "./CurvePrimitive";
import { NullGeometryHandler } from "../GeometryHandler";
import { CurvePrimitive, CurveLocationDetail, CurveIntervalRole } from "./CurvePrimitive";
import { Geometry } from "../Geometry";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
// import { Arc3d } from "./Arc3d";
import { Point3d, Vector2d } from "../PointVector";
// import { LineString3d } from "./LineString3d";
import { SmallSystem, AnalyticRoots } from "../numerics/Polynomials";
import { Matrix4d, Point4d } from "../numerics/Geometry4d";
import { Transform } from "../Transform";
import { Arc3d } from "./Arc3d";
import { GrowableFloat64Array } from "../GrowableArray";
/**
 * Data bundle for a pair of arrays of CurveLocationDetail structures such as produced by CurveCurve,IntersectXY and
 * CurveCurve.ClosestApproach
 */
export class CurveLocationDetailArrayPair {
  public dataA: CurveLocationDetail[];
  public dataB: CurveLocationDetail[];
  public constructor() {
    this.dataA = [];
    this.dataB = [];
  }
}
/*
 * * Handler class for XY intersections.
 * * This is local to the file (not exported)
 * * Instances are initialized and called from CurveCurve.
 */
class CurveCurveIntersectXY extends NullGeometryHandler {
  // private geometryA: GeometryQuery;  // nb never used -- passed through handlers.
  private _extendA: boolean;
  private _geometryB: GeometryQuery;
  private _extendB: boolean;
  private _results!: CurveLocationDetailArrayPair;
  private _worldToLocalPerspective: Matrix4d | undefined;
  private _worldToLocalAffine: Transform | undefined;
  private reinitialize() {
    this._results = new CurveLocationDetailArrayPair();
  }

  public constructor(worldToLocal: Matrix4d | undefined, _geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean) {
    super();
    // this.geometryA = _geometryA;
    this._extendA = extendA;
    this._geometryB = geometryB;
    this._extendB = extendB;
    this._worldToLocalPerspective = undefined;
    this._worldToLocalAffine = undefined;
    if (worldToLocal !== undefined && !worldToLocal.isIdentity()) {
      this._worldToLocalAffine = worldToLocal.asTransform;
      if (!this._worldToLocalAffine)
        this._worldToLocalPerspective = worldToLocal.clone();
    }
    this.reinitialize();
  }
  /**
   * @param reinitialize if true, a new results structure is created for use by later calls.
   * @returns Return the results structure for the intersection calculation.
   *
   */
  public grabResults(reinitialize: boolean = false): CurveLocationDetailArrayPair {
    const result = this._results;
    if (reinitialize)
      this.reinitialize();
    return result;
  }

  private static _workVector2dA = Vector2d.create();

  private acceptFraction(extend0: boolean, fraction: number, extend1: boolean) {
    if (!extend0 && fraction < 0.0)
      return false;
    if (!extend1 && fraction > 1.0)
      return false;
    return true;
  }

  /** compute intersection of two line segments.
   * filter by extension rules.
   * record with fraction mapping.
   */
  private acceptPointWithLocalFractions(
    localFractionA: number,
    cpA: CurvePrimitive,
    fractionA0: number,
    fractionA1: number,
    localFractionB: number,   // Computed intersection fraction
    cpB: CurvePrimitive,
    fractionB0: number,
    fractionB1: number,
    reversed: boolean,
  ) {
    const globalFractionA = Geometry.interpolate(fractionA0, localFractionA, fractionA1);
    const globalFractionB = Geometry.interpolate(fractionB0, localFractionB, fractionB1);
    const detailA = CurveLocationDetail.createCurveFractionPoint(cpA,
      globalFractionA, cpA.fractionToPoint(globalFractionA));
    detailA.setIntervalRole(CurveIntervalRole.isolated);
    const detailB = CurveLocationDetail.createCurveFractionPoint(cpB,
      globalFractionB, cpB.fractionToPoint(globalFractionB));
    detailB.setIntervalRole(CurveIntervalRole.isolated);
    if (reversed) {
      this._results.dataA.push(detailB);
      this._results.dataB.push(detailA);
    } else {
      this._results.dataA.push(detailA);
      this._results.dataB.push(detailB);
    }
  }
  /** compute intersection of two line segments.
   * filter by extension rules.
   * record with fraction mapping.
   */
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
  ) {

    const uv = CurveCurveIntersectXY._workVector2dA;
    if (SmallSystem.lineSegment3dXYTransverseIntersectionUnbounded(
      pointA0, pointA1,
      pointB0, pointB1, uv)
      && this.acceptFraction(extendA0, uv.x, extendA1)
      && this.acceptFraction(extendB0, uv.y, extendB1)
    ) {
      this.acceptPointWithLocalFractions(uv.x, cpA, fractionA0, fractionA1, uv.y, cpB, fractionB0, fractionB1, reversed);
    }
  }
  private static _workPointA0H = Point4d.create();
  private static _workPointA1H = Point4d.create();
  private static _workPointB0H = Point4d.create();
  private static _workPointB1H = Point4d.create();
  // intersection of PROJECTED homogeneous segments ...  assumes caller knows the _worldToLocal is present
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
  ) {
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
        this.acceptPointWithLocalFractions(fractionA, cpA, fractionA0, fractionA1,
          fractionB, cpB, fractionB0, fractionB1, reversed);
      }
    }
  }
  // Caller accesses data from a linesegment and passes to here.
  // (The linesegment in question might be (a) a full linesegment or (b) a fragment within a linestring.  The fraction and extend parameters
  // allow all combinations to be passed in)
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
  ) {
    if (this._worldToLocalAffine) {
      // non-perspective projection
      CurveCurveIntersectXY.setTransformedWorkPoints(this._worldToLocalAffine, pointA0, pointA1, pointB0, pointB1);
      this.computeSegmentSegment3D(
        cpA, extendA0, CurveCurveIntersectXY._workPointA0, fractionA0, CurveCurveIntersectXY._workPointA1, fractionA1, extendA1,
        cpB, extendB0, CurveCurveIntersectXY._workPointB0, fractionB0, CurveCurveIntersectXY._workPointB1, fractionB1, extendB1,
        reversed);
    } else if (this._worldToLocalPerspective) {
      this.computeSegmentSegment3DH(
        cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1,
        cpB, extendB0, pointB0, fractionB0, pointB1, fractionB1, extendB1,
        reversed);
    } else {
      this.computeSegmentSegment3D(
        cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1,
        cpB, extendB0, pointB0, fractionB0, pointB1, fractionB1, extendB1,
        reversed);
    }
  }

  // Caller accesses data from a linestring or segment and passes it here.
  // (The linesegment in question might be (a) a full linesegment or (b) a fragment within a linestring.  The fraction and extend parameters
  // allow all combinations to be passed in)
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
  ) {
    // Arc: X = C + cU + sV
    // Line:  contains points A0,A1
    // Arc point colinear with line if det (A0, A1, X) = 0
    // with homogeneous xyw points and vectors.
    // With equational X:   det (A0, A1, C) + c det (A0, A1,U) + s det (A0, A1, V) = 0.
    // solve for theta.
    // evaluate points.
    // project back to line.
    if (this._worldToLocalPerspective) {
      const data = arc.toTransformedPoint4d(this._worldToLocalPerspective);
      const pointA0H = this._worldToLocalPerspective.multiplyPoint3d(pointA0, 1);
      const pointA1H = this._worldToLocalPerspective.multiplyPoint3d(pointA1, 1);
      const alpha = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.center);
      const beta = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.vector0);
      const gamma = Geometry.tripleProductPoint4dXYW(pointA0H, pointA1H, data.vector90);
      const cosines = new GrowableFloat64Array(2);
      const sines = new GrowableFloat64Array(2);
      const radians = new GrowableFloat64Array(2);
      const numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians);
      for (let i = 0; i < numRoots; i++) {
        const arcPoint = data.center.plus2Scaled(data.vector0, cosines.at(i), data.vector90, sines.at(i));
        const arcFraction = data.sweep.radiansToSignedPeriodicFraction(radians.at(i));
        const lineFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(pointA0H, pointA1H, arcPoint);
        if (lineFraction !== undefined && this.acceptFraction(extendA0, lineFraction, extendA1) && this.acceptFraction(extendB0, arcFraction, extendB1)) {
          this.acceptPointWithLocalFractions(lineFraction, cpA, fractionA0, fractionA1,
            arcFraction, arc, 0, 1, reversed);
        }
      }
    } else {
      const data = arc.toTransformedVectors(this._worldToLocalAffine);
      let pointA0Local = pointA0;
      let pointA1Local = pointA1;
      if (this._worldToLocalAffine) {
        pointA0Local = this._worldToLocalAffine.multiplyPoint3d(pointA0);
        pointA1Local = this._worldToLocalAffine.multiplyPoint3d(pointA1);
      }
      const alpha = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.center, 1);
      const beta = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector0, 0);
      const gamma = Geometry.tripleProductXYW(pointA0Local, 1, pointA1Local, 1, data.vector90, 0);
      const cosines = new GrowableFloat64Array(2);
      const sines = new GrowableFloat64Array(2);
      const radians = new GrowableFloat64Array(2);
      const numRoots = AnalyticRoots.appendImplicitLineUnitCircleIntersections(alpha, beta, gamma, cosines, sines, radians);
      for (let i = 0; i < numRoots; i++) {
        const arcPoint = data.center.plus2Scaled(data.vector0, cosines.at(i), data.vector90, sines.at(i));
        const arcFraction = data.sweep.radiansToSignedPeriodicFraction(radians.at(i));
        const lineFraction = SmallSystem.lineSegment3dXYClosestPointUnbounded(pointA0Local, pointA1Local, arcPoint);
        if (lineFraction !== undefined && this.acceptFraction(extendA0, lineFraction, extendA1) && this.acceptFraction(extendB0, arcFraction, extendB1)) {
          this.acceptPointWithLocalFractions(lineFraction, cpA, fractionA0, fractionA1,
            arcFraction, arc, 0, 1, reversed);
        }
      }
    }
  }

  private static _workPointAA0 = Point3d.create();
  private static _workPointAA1 = Point3d.create();
  private static _workPointBB0 = Point3d.create();
  private static _workPointBB1 = Point3d.create();

  public computeSegmentLineString(lsA: LineSegment3d, extendA: boolean, lsB: LineString3d, extendB: boolean, reversed: boolean): any {
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
      for (let ib = 1; ib < numB; ib++ , pointB0.setFrom(pointB1), fB0 = fB1) {
        lsB.pointAt(ib, pointB1);
        fB1 = ib * dfB;
        this.dispatchSegmentSegment(
          lsA, extendA, pointA0, 0.0, pointA1, 1.0, extendA,
          lsB, ib === 1 && extendB, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB,
          reversed);
      }
    }
    return undefined;
  }

  public computeArcLineString(arcA: Arc3d, extendA: boolean, lsB: LineString3d, extendB: boolean, reversed: boolean): any {
    const pointB0 = CurveCurveIntersectXY._workPointBB0;
    const pointB1 = CurveCurveIntersectXY._workPointBB1;
    const numB = lsB.numPoints();
    if (numB > 1) {
      const dfB = 1.0 / (numB - 1);
      let fB0;
      let fB1;
      fB0 = 0.0;
      lsB.pointAt(0, pointB0);
      for (let ib = 1; ib < numB; ib++ , pointB0.setFrom(pointB1), fB0 = fB1) {
        lsB.pointAt(ib, pointB1);
        fB1 = ib * dfB;
        this.dispatchSegmentArc(
          lsB, ib === 1 && extendB, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB,
          arcA, extendA, extendA,
          !reversed);
      }
    }
    return undefined;
  }

  private static _workPointA0 = Point3d.create();
  private static _workPointA1 = Point3d.create();
  private static _workPointB0 = Point3d.create();
  private static _workPointB1 = Point3d.create();
  private static setTransformedWorkPoints(transform: Transform, pointA0: Point3d, pointA1: Point3d, pointB0: Point3d, pointB1: Point3d) {
    transform.multiplyPoint3d(pointA0, this._workPointA0);
    transform.multiplyPoint3d(pointA1, this._workPointA1);
    transform.multiplyPoint3d(pointB0, this._workPointB0);
    transform.multiplyPoint3d(pointB1, this._workPointB1);
  }

  public handleLineSegment3d(segmentA: LineSegment3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      const segmentB = this._geometryB;
      this.dispatchSegmentSegment(
        segmentA, this._extendA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA,
        segmentB, this._extendB, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0, this._extendB,
        false);
    } else if (this._geometryB instanceof LineString3d) {
      this.computeSegmentLineString(segmentA, this._extendA, this._geometryB, this._extendB, false);
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchSegmentArc(
        segmentA, this._extendA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA,
        this._geometryB, this._extendB, this._extendB, false);
    }
  }

  public handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineString3d) {
      const lsB = this._geometryB as LineString3d;
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
        const extendA = this._extendA;
        const extendB = this._extendB;
        lsA.pointAt(0, pointA0);
        for (let ia = 1; ia < numA; ia++ , pointA0.setFrom(pointA1), fA0 = fA1) {
          fA1 = ia * dfA;
          fB0 = 0.0;
          lsA.pointAt(ia, pointA1);
          lsB.pointAt(0, pointB0);
          for (let ib = 1; ib < numB; ib++ , pointB0.setFrom(pointB1), fB0 = fB1) {
            lsB.pointAt(ib, pointB1);
            fB1 = ib * dfB;
            this.dispatchSegmentSegment(
              lsA, ia === 1 && extendA, pointA0, fA0, pointA1, fA1, (ia + 1) === numA && extendA,
              lsB, ib === 1 && extendB, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB,
              false);
          }
        }
      }
    } else if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentLineString(this._geometryB, this._extendB, lsA, this._extendA, true);
    } else if (this._geometryB instanceof Arc3d) {
      this.computeArcLineString(this._geometryB, this._extendB, lsA, this._extendA, true);
    }
    return undefined;
  }

  public handleArc3d(arc0: Arc3d): any {
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentArc(
        this._geometryB, this._extendB, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB,
        arc0, this._extendA, this._extendA, true);
    } else if (this._geometryB instanceof LineString3d) {
      this.computeArcLineString(arc0, this._extendA, this._geometryB, this._extendB, false);
    } else if (this._geometryB instanceof Arc3d) {
    }
    return undefined;
  }

}
export class CurveCurve {
  public static IntersectionXY(geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailArrayPair {
    const handler = new CurveCurveIntersectXY(undefined, geometryA, extendA, geometryB, extendB);
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabResults();
  }

  public static IntersectionProjectedXY(worldToLocal: Matrix4d,
    geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailArrayPair {
    const handler = new CurveCurveIntersectXY(worldToLocal, geometryA, extendA, geometryB, extendB);
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabResults();
  }

}
