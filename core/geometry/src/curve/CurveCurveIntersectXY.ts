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
import { SmallSystem } from "../numerics/Polynomials";
import { Matrix4d, Point4d } from "../numerics/Geometry4d";
import { Transform } from "../Transform";
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
    if (worldToLocal !== undefined) {
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
  private acceptLineSegmentPoint(
    localFractionA: number,
    cpA: CurvePrimitive,
    pointA0: Point3d,
    fractionA0: number,
    pointA1: Point3d,
    fractionA1: number,
    localFractionB: number,   // Computed intersection fraction
    cpB: CurvePrimitive,
    pointB0: Point3d,
    fractionB0: number,
    pointB1: Point3d,
    fractionB1: number,
    reversed: boolean,
  ) {
    const detailA = CurveLocationDetail.createCurveFractionPoint(cpA,
      Geometry.interpolate(fractionA0, localFractionA, fractionA1),
      pointA0.interpolate(localFractionA, pointA1));
    detailA.setIntervalRole(CurveIntervalRole.isolated);
    const detailB = CurveLocationDetail.createCurveFractionPoint(cpB,
      Geometry.interpolate(fractionB0, localFractionB, fractionB1),
      pointB0.interpolate(localFractionB, pointB1));
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
      this.acceptLineSegmentPoint(uv.x, cpA, pointA0, fractionA0, pointA1, fractionA1,
        uv.y, cpB, pointB0, fractionB0, pointB1, fractionB1, reversed);
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
    // Considering only x,y,w parts....
    // Point Q along B is (in full homogeneous)  `(1-lambda) B0 + lambda 1`
    // PointQ is colinear with A0,A1 when the determinat det (A0,A1,Q) is zero.  (Each column takes xyw parts)
    const alpha0 = Geometry.tripleProduct(
      hA0.x, hA1.x, hB0.x,
      hA0.y, hA1.y, hB0.y,
      hA0.w, hA1.w, hB0.w);
    const alpha1 = Geometry.tripleProduct(
      hA0.x, hA1.x, hB1.x,
      hA0.y, hA1.y, hB1.y,
      hA0.w, hA1.w, hB1.w);
    const fractionB = Geometry.conditionalDivideFraction(alpha1 - alpha0, alpha0);
    if (fractionB !== undefined && this.acceptFraction(extendB0, fractionB, extendB1)) {
      const beta0 = Geometry.tripleProduct(
        hB0.x, hB1.x, hA0.x,
        hB0.y, hB1.y, hA0.y,
        hB0.w, hB1.w, hA0.w);
      const beta1 = Geometry.tripleProduct(
        hB0.x, hB1.x, hA1.x,
        hB0.y, hB1.y, hA1.y,
        hB0.w, hB1.w, hA1.w);
      const fractionA = Geometry.conditionalDivideFraction(beta1 - beta0, beta0);
      if (fractionA !== undefined && this.acceptFraction(extendA0, fractionA, extendA1)) {
        // final fraction acceptance uses original world points, with perspective-aware fractions
        this.acceptLineSegmentPoint(fractionA, cpA, pointA0, fractionA0, pointA1, fractionA1,
          fractionB, cpB, pointB0, fractionB0, pointB1, fractionB1, reversed);
      }
    }
  }

  public computeSegmentLineString(lsA: LineSegment3d, extendA: boolean, lsB: LineString3d, extendB: boolean, reversed: boolean): any {
    const pointA0 = lsA.point0Ref;
    const pointA1 = lsA.point1Ref;
    const pointB0 = CurveCurveIntersectXY._workPointB0;
    const pointB1 = CurveCurveIntersectXY._workPointB1;
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
        this.computeSegmentSegment3D(
          lsA, extendA, pointA0, 0.0, pointA1, 1.0, extendA,
          lsB, ib === 1 && extendB, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB,
          reversed);
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
      if (this._worldToLocalAffine) {
        // non-perspective projection
        CurveCurveIntersectXY.setTransformedWorkPoints(this._worldToLocalAffine, segmentA.point0Ref, segmentA.point1Ref, segmentB.point0Ref, segmentB.point1Ref);
        this.computeSegmentSegment3D(
          segmentA, this._extendA, CurveCurveIntersectXY._workPointA0, 0.0, CurveCurveIntersectXY._workPointA1, 1.0, this._extendA,
          segmentB, this._extendB, CurveCurveIntersectXY._workPointB0, 0.0, CurveCurveIntersectXY._workPointB1, 1.0, this._extendB,
          false);
      } else if (this._worldToLocalPerspective) {
        this.computeSegmentSegment3DH(
          segmentA, this._extendA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA,
          segmentB, this._extendB, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0, this._extendB,
          false);
      } else {
        this.computeSegmentSegment3D(
          segmentA, this._extendA, segmentA.point0Ref, 0.0, segmentA.point1Ref, 1.0, this._extendA,
          segmentB, this._extendB, segmentB.point0Ref, 0.0, segmentB.point1Ref, 1.0, this._extendB,
          false);
      }
    } else if (this._geometryB instanceof LineString3d) {
      this.computeSegmentLineString(segmentA, this._extendA, this._geometryB, this._extendB, false);
    }
  }

  public handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineString3d) {
      const lsB = this._geometryB as LineString3d;
      const pointA0 = CurveCurveIntersectXY._workPointA0;
      const pointA1 = CurveCurveIntersectXY._workPointA1;
      const pointB0 = CurveCurveIntersectXY._workPointB0;
      const pointB1 = CurveCurveIntersectXY._workPointB1;
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
            this.computeSegmentSegment3D(
              lsA, ia === 1 && extendA, pointA0, fA0, pointA1, fA1, (ia + 1) === numA && extendA,
              lsB, ib === 1 && extendB, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && extendB,
              false);
          }
        }
      }
    } else if (this._geometryB instanceof LineSegment3d) {
      this.computeSegmentLineString(this._geometryB, this._extendB, lsA, this._extendA, true);
    }
    return undefined;
    /*  public handleArc3d(arc0: Arc3d): any {
        if (this.geometryB instanceof Arc3d) {
        }
        return undefined;
      }
      */
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
