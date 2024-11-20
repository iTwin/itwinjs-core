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
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Vector2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { TrigPolynomial } from "../../numerics/Polynomials";
import { SmallSystem } from "../../numerics/SmallSystem";
import { Arc3d } from "../Arc3d";
import { CurveChainWithDistanceIndex } from "../CurveChainWithDistanceIndex";
import { CurveCollection } from "../CurveCollection";
import { CurveIntervalRole, CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { AnyCurve } from "../CurveTypes";
import { GeometryQuery } from "../GeometryQuery";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop } from "../Loop";
import { Path } from "../Path";

// cspell:word XYRR

/**
 * Handler class for XYZ intersections between _geometryB and another geometry.
 * * Instances are initialized and called from CurveCurve.
 * * geometryB is saved for later reference.
 * @internal
 */
export class CurveCurveIntersectXYZ extends RecurseToCurvesGeometryHandler {
  private _extendA0: boolean;
  private _extendA1: boolean;
  private _geometryB: AnyCurve;
  private _extendB0: boolean;
  private _extendB1: boolean;
  private _results: CurveLocationDetailPair[];
  private static _workVector2dA = Vector2d.create();
  private static _workPointAA0 = Point3d.create();
  private static _workPointAA1 = Point3d.create();
  private static _workPointBB0 = Point3d.create();
  private static _workPointBB1 = Point3d.create();
  /**
   * @param extendA flag to enable using extension of the other geometry.
   * @param geometryB second curve for intersection.  Saved for reference by specific handler methods.
   * @param extendB flag for extension of geometryB.
   */
  public constructor(extendA: boolean, geometryB: AnyCurve, extendB: boolean) {
    super();
    this._extendA0 = extendA;
    this._extendA1 = extendA;
    this._geometryB = geometryB;
    this._extendB0 = extendB;
    this._extendB1 = extendB;
    this._results = [];
  }
  /** Reset the geometry, leaving all other parts unchanged (and preserving accumulated intersections). */
  public resetGeometry(geometryB: AnyCurve): void {
    this._geometryB = geometryB;
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
  /** Accept the fraction if it falls inside (possibly extended) fraction range. */
  private acceptFraction(extend0: boolean, fraction: number, extend1: boolean, fractionTol: number = 1.0e-12): boolean {
    // Note that default tol is tighter than Geometry.smallFraction. We aggressively toss intersections past endpoints.
    if (!extend0 && fraction < -fractionTol)
      return false;
    if (!extend1 && fraction > 1.0 + fractionTol)
      return false;
    return true;
  }
  /**
   * Compute intersection of two line segments.
   * Filter by extension rules.
   * Reject if evaluated points do not match coordinates (e.g. close approach point).
   * Record with fraction mapping.
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
  ): void {
    const globalFractionA = Geometry.interpolate(fractionA0, localFractionA, fractionA1);
    const globalFractionB = Geometry.interpolate(fractionB0, localFractionB, fractionB1);
    // ignore duplicate of most recent point
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
    const pointA = cpA.fractionToPoint(globalFractionA);
    const pointB = cpB.fractionToPoint(globalFractionB);
    if (!pointA.isAlmostEqualMetric(pointB))
      return;
    const detailA = CurveLocationDetail.createCurveFractionPoint(cpA, globalFractionA, pointA);
    detailA.setIntervalRole(CurveIntervalRole.isolated);
    const detailB = CurveLocationDetail.createCurveFractionPoint(cpB, globalFractionB, pointB);
    detailB.setIntervalRole(CurveIntervalRole.isolated);
    if (reversed) {
      const pair = new CurveLocationDetailPair(detailB, detailA);
      this._results.push(pair);
    } else {
      const pair = new CurveLocationDetailPair(detailA, detailB);
      this._results.push(pair);
    }
  }
  /**
   * Compute intersection of two line segments.
   * Filter by extension rules.
   * Record with fraction mapping.
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
  ): void {
    const uv = CurveCurveIntersectXYZ._workVector2dA;
    if (SmallSystem.lineSegment3dClosestApproachUnbounded(pointA0, pointA1, pointB0, pointB1, uv) &&
      this.acceptFraction(extendA0, uv.x, extendA1) && this.acceptFraction(extendB0, uv.y, extendB1)) {
      this.recordPointWithLocalFractions(uv.x, cpA, fractionA0, fractionA1, uv.y, cpB, fractionB0, fractionB1, reversed);
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
    this.computeSegmentSegment3D(
      cpA, extendA0, pointA0, fractionA0, pointA1, fractionA1, extendA1,
      cpB, extendB0, pointB0, fractionB0, pointB1, fractionB1, extendB1,
      reversed,
    );
  }
  /**
   * Create a plane whose normal is the "better" cross product: `vectorA.crossProduct(vectorB)` or
   * `vectorA.crossProduct(vectorC)`
   * * The heuristic for "better" is:
   *   * first choice is cross product with `vectorB`, if `vectorA` and `vectorB` are sufficiently far from parallel
   * (or anti-parallel).
   *   * otherwise use vectorC
   * @param origin plane origin
   * @param vectorA vector which must be in the plane.
   * @param cosineValue largest cosine of the angle theta between vectorA and vectorB to prefer their cross product, e.g.
   * passing 0.94 ~ cos(20deg) will switch to using vectorC in the cross product if theta < ~20deg or theta > ~160deg.
   * @param vectorB first candidate for additional in-plane vector
   * @param vectorC second candidate for additional in-plane vector
   */
  public createPlaneWithPreferredPerpendicular(
    origin: Point3d, vectorA: Vector3d, cosineValue: number, vectorB: Vector3d, vectorC: Vector3d,
  ): Plane3dByOriginAndUnitNormal | undefined {
    cosineValue = Geometry.restrictToInterval(Math.abs(cosineValue), 0.0, 1.0 - Geometry.smallFraction);
    const dotAA = vectorA.magnitudeSquared();
    const dotBB = vectorB.magnitudeSquared();
    const dotAB = Math.abs(vectorA.dotProduct(vectorB));
    const cross = vectorA.unitCrossProduct(
      dotAB * dotAB <= cosineValue * cosineValue * dotAA * dotBB ? vectorB : vectorC,
    );
    if (cross)
      return Plane3dByOriginAndUnitNormal.create(origin, cross);
    return undefined;
  }
  // Caller accesses data from a linestring or segment and passes it here.
  // The line in question might be (a) a full line segment or (b) a fragment within a linestring.
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
    const lineVector = Vector3d.createStartEnd(pointA0, pointA1);
    const cosValue = 0.94; // cosine of 20 degrees
    const plane = this.createPlaneWithPreferredPerpendicular(
      pointA0, lineVector, cosValue, arc.perpendicularVector, arc.vector0,
    );
    if (plane !== undefined) {
      const candidates: CurveLocationDetail[] = [];
      arc.appendPlaneIntersectionPoints(plane, candidates);
      let lineFraction;
      let linePoint: Point3d | undefined;
      for (const c of candidates) {
        const arcFraction = arc.sweep.fractionToSignedPeriodicFraction(c.fraction, extendB0);
        if (this.acceptFraction(extendB0, arcFraction, extendB1)) {
          lineFraction = SmallSystem.lineSegment3dClosestPointUnbounded(pointA0, pointA1, c.point);
          if (lineFraction !== undefined) {
            linePoint = pointA0.interpolate(lineFraction, pointA1, linePoint);
            if (linePoint.isAlmostEqualMetric(c.point) && this.acceptFraction(extendA0, lineFraction, extendA1)) {
              this.recordPointWithLocalFractions(
                lineFraction, cpA, fractionA0, fractionA1, arcFraction, arc, 0, 1, reversed,
              );
            }
          }
        }
      }
    }
  }
  // Caller promises arcs are coplanar.
  // Passes "other" as {center, vector0, vector90} in local xy space of cpA
  // Solves the arc-arc equations for that local ellipse with unit circle.
  // Solution fractions map directly to original arcs.
  private dispatchArcArcInPlane(
    cpA: Arc3d, extendA0: boolean, extendA1: boolean, cpB: Arc3d, extendB0: boolean, extendB1: boolean, reversed: boolean,
  ): void {
    const otherVectors = cpA.otherArcAsLocalVectors(cpB);
    if (otherVectors !== undefined) {
      const ellipseRadians: number[] = [];
      const circleRadians: number[] = [];
      TrigPolynomial.solveUnitCircleHomogeneousEllipseIntersection(
        otherVectors.center.x, otherVectors.center.y, 1.0,
        otherVectors.vector0.x, otherVectors.vector0.y, 0.0,
        otherVectors.vector90.x, otherVectors.vector90.y, 0.0,
        ellipseRadians, circleRadians,
      );
      for (let i = 0; i < ellipseRadians.length; i++) {
        const fractionA = cpA.sweep.radiansToSignedFraction(circleRadians[i], extendA0);
        const fractionB = cpB.sweep.radiansToSignedFraction(ellipseRadians[i], extendB0);
        // hm .. do we really need to check the fractions?  We know they are internal to the beziers
        if (this.acceptFraction(extendA0, fractionA, extendA1) && this.acceptFraction(extendB0, fractionB, extendB1)) {
          this.recordPointWithLocalFractions(fractionA, cpA, 0, 1, fractionB, cpB, 0, 1, reversed);
        }
      }
    }
  }
  // Caller accesses data from two arcs.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion".
  // Solves the arc-arc equations.
  private dispatchArcArc(
    cpA: Arc3d, extendA0: boolean, extendA1: boolean, cpB: Arc3d, extendB0: boolean, extendB1: boolean, reversed: boolean,
  ): void {
    // If arcs are in different planes:
    // 1) Intersect each plane with the other arc (quadratic)
    // 2) accept points that appear in both intersection sets.
    // If arcs are in parallel planes -- no intersections.
    // If arcs are in the same plane -- xy intersection in that plane.
    const planeA = Plane3dByOriginAndUnitNormal.create(cpA.center, cpA.perpendicularVector);
    const planeB = Plane3dByOriginAndUnitNormal.create(cpB.center, cpB.perpendicularVector);
    if (planeA === undefined || planeB === undefined)
      return;
    if (planeA.getNormalRef().isParallelTo(planeB.getNormalRef())) {
      if (planeA.isPointInPlane(planeB.getOriginRef()) && planeB.isPointInPlane(planeA.getOriginRef()))
        this.dispatchArcArcInPlane(cpA, extendA0, extendA1, cpB, extendB0, extendB1, reversed);
    } else {
      const arcBPoints: CurveLocationDetail[] = [];
      cpB.appendPlaneIntersectionPoints(planeA, arcBPoints);
      const arcAPoints: CurveLocationDetail[] = [];
      cpA.appendPlaneIntersectionPoints(planeB, arcAPoints);
      for (const detailB of arcBPoints) {
        for (const detailA of arcAPoints) {
          if (detailA.point.isAlmostEqual(detailB.point)) {
            const arcFractionA = cpA.sweep.fractionToSignedPeriodicFraction(detailA.fraction, extendA0);
            const arcFractionB = cpB.sweep.fractionToSignedPeriodicFraction(detailB.fraction, extendB0);
            if (this.acceptFraction(extendA0, arcFractionA, extendA1)
              && this.acceptFraction(extendB0, arcFractionB, extendB1)) {
              this.recordPointWithLocalFractions(arcFractionA, cpA, 0, 1, arcFractionB, cpB, 0, 1, reversed);
            }
          }
        }
      }
    }
  }
  // Caller accesses data from two arcs.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion".
  // Solves the arc-arc equations.
  private dispatchArcBsplineCurve3d(
    _arc: Arc3d,
    _extendA0: boolean,
    _extendA1: boolean,
    _cpB: BSplineCurve3d,
    _extendB0: boolean,
    _extendB1: boolean,
    _reversed: boolean,
  ): void {
    // TODO: B-spline XYZ intersection implementation
    /*
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
    // for any point in world space,
    // THIS CODE ONLY WORKS FOR
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

      if (matrixAInverse) {
        let bezier: BezierCurve3dH | undefined;
        for (let spanIndex = 0; ; spanIndex++) {
          bezier = cpB.getSaturatedBezierSpan3dH(spanIndex, bezier);
          if (!bezier) break;
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
              const arcFraction = cpA.sweep.radiansToSignedFraction(Math.atan2(s, c), _extendA0);
              if (this.acceptFraction(_extendA0, arcFraction, _extendA1) &&
                this.acceptFraction(_extendB0, fractionB, _extendB1)) {
                this.recordPointWithLocalFractions(
                  arcFraction, cpA, 0, 1, fractionB, cpB, 0, 1, reversed,
                );
              }
            }
          }
        }
      }
    }
    */
  }
  // TODO: Bezier XYZ intersection implementation
  /*
  // Apply the transformation to bezier curves. Optionally construct ranges.
  private transformBeziers(beziers: BezierCurve3dH[]): void {
    if (this._worldToLocalAffine) {
      for (const bezier of beziers) bezier.tryTransformInPlace(this._worldToLocalAffine);
    } else if (this._worldToLocalPerspective) {
      for (const bezier of beziers) bezier.tryMultiplyMatrix4dInPlace(this._worldToLocalPerspective);
    }
  }
  */
  /*
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
    univariateBezierB: UnivariateBezier,  // caller-allocated for univariate coefficients.
    reversed: boolean,
  ) {
    if (!this._xyzwA0)
      this._xyzwA0 = Point4d.create();
    if (!this._xyzwA1)
      this._xyzwA1 = Point4d.create();
    if (!this._xyzwPlane)
      this._xyzwPlane = Point4d.create();
    if (!this._xyzwB)
      this._xyzwB = Point4d.create();
    const roots = univariateBezierG.roots(0.0, true);
    if (roots) {
      for (const root of roots) {
        const fractionB = bezier.fractionToParentFraction(root);
        // The univariate bezier (which has been transformed by the view transform) evaluates into xyw space
        const bcurvePoint4d = bezier.fractionToPoint4d(root);
        const c = bcurvePoint4d.dotProductXYZW(axx, axy, axz, axw);
        const s = bcurvePoint4d.dotProductXYZW(ayx, ayy, ayz, ayw);
        const arcFraction = cpA.sweep.radiansToSignedFraction(Math.atan2(s, c), extendA0);
        if (this.acceptFraction(extendA0, arcFraction, extendA1) && this.acceptFraction(extendB0, fractionB, extendB1)) {
          this.recordPointWithLocalFractions(
            arcFraction, cpA, 0, 1, fractionB, cpB, 0, 1, reversed,
          );
        }
      }
    bezierA.fractionToPoint4d(0.0, this._xyzwA0);
    let f0 = 0.0;
    let f1 = 1.0;
    const intervalTolerance = 1.0e-5;
    const df = 1.0 / strokeCountA;
    for (let i = 1; i <= strokeCountA; i++ , f0 = f1, this._xyzwA0.setFrom(this._xyzwA1)) {
      f1 = i * df;
      bezierA.fractionToPoint4d(f1, this._xyzwA1);
      Point4d.createPlanePointPointZ(this._xyzwA0, this._xyzwA1, this._xyzwPlane);
      bezierB.poleProductsXYZW(
        univariateBezierB.coffs, this._xyzwPlane.x, this._xyzwPlane.y, this._xyzwPlane.z, this._xyzwPlane.w,
      );
      let errors = 0;
      const roots = univariateBezierB.roots(0.0, true);
      if (roots)
        for (const r of roots) {
          const bezierBFraction = r;
          bezierB.fractionToPoint4d(bezierBFraction, this._xyzwB);
          const segmentAFraction = SmallSystem.lineSegment3dHXYClosestPointUnbounded(this._xyzwA0, this._xyzwA1, this._xyzwB);
          if (segmentAFraction && Geometry.isIn01WithTolerance(segmentAFraction, intervalTolerance)) {
            const bezierAFraction = Geometry.interpolate(f0, segmentAFraction, f1);
            // TODO implement newton search
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
            if (this.acceptFraction(false, bcurveAFraction, false) &&
              this.acceptFraction(false, bcurveBFraction, false)) {
              this.recordPointWithLocalFractions(
                bcurveAFraction, bcurveA, 0, 1, bcurveBFraction, bcurveB, 0, 1, reversed,
              );
            }
          }
        }
    }
  }
  */
  // Caller accesses data from two arcs.
  // Selects the best conditioned arc (in xy parts) as "circle after inversion".
  // Solves the arc-arc equations.
  private dispatchBSplineCurve3dBSplineCurve3d(
    _bcurveA: BSplineCurve3dBase, _bcurveB: BSplineCurve3dBase, _reversed: boolean,
  ): void {
    // TODO: B-spline XYZ intersection implementation
    /*
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
              bezierSpanA[a], bcurveA, strokeCountA, bezierSpanB[b], bcurveB, strokeCountB, univariateCoffsB, _reversed,
            );
          else
            this.dispatchBezierBezierStrokeFirst(
              bezierSpanB[b], bcurveB, strokeCountB, bezierSpanA[a], bcurveA, strokeCountA, univariateCoffsA, !_reversed,
            );
        }
      }
    }
    */
  }
  /*
  /**
   * Apply the projection transform (if any) to (xyz, w).
   * @param xyz xyz parts of input point.
   * @param w weight to use for homogeneous effects.
   */
  /*
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
  */
  // Caller accesses data from segment and bsplineCurve
  // Selects the best conditioned arc (in xy parts) as "circle after inversion"
  // Solves the arc-arc equations
  private dispatchSegmentBsplineCurve(
    _cpA: CurvePrimitive,
    _extendA0: boolean,
    _pointA0: Point3d,
    _fractionA0: number,
    _pointA1: Point3d,
    _fractionA1: number,
    _extendA1: boolean,
    _bcurve: BSplineCurve3d,
    _extendB0: boolean,
    _extendB1: boolean,
    _reversed: boolean,
  ): void {
    // TODO: B-spline XYZ intersection implementation
    /*
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
      if (lineFraction !== undefined && this.acceptFraction(_extendA0, lineFraction, _extendA1) &&
        this.acceptFraction(_extendB0, fractionB, _extendB1)) {
        this.recordPointWithLocalFractions(
          lineFraction, cpA, fractionA0, fractionA1, fractionB, bcurve, 0, 1, reversed,
        );
      }
    }
    */
  }
  /** Low level dispatch of linestring with (beziers of) a bspline curve */
  public dispatchLineStringBSplineCurve(
    _lsA: LineString3d,
    _extendA0: boolean,
    _extendA1: boolean,
    _curveB: BSplineCurve3d,
    _extendB0: boolean,
    _extendB1: boolean,
    _reversed: boolean,
  ): any {
    // TODO: B-spline XYZ intersection implementation
    /*
    const numA = lsA.numPoints();
    if (numA > 1) {
      const dfA = 1.0 / (numA - 1);
      let fA0;
      let fA1;
      fA0 = 0.0;
      const pointA0 = CurveCurveIntersectXYZ._workPointA0;
      const pointA1 = CurveCurveIntersectXYZ._workPointA1;
      lsA.pointAt(0, pointA0);
      for (let iA = 1; iA < numA; iA++, pointA0.setFrom(pointA1), fA0 = fA1) {
        lsA.pointAt(iA, pointA1);
        fA1 = iA * dfA;
        this.dispatchSegmentBsplineCurve(
          lsA, iA === 1 && _extendA0, pointA0, fA0, pointA1, fA1, (iA + 1) === numA && _extendA1,
          curveB, _extendB0, _extendB1 reversed);
      }
    }
    return undefined;
    */
  }
  /** Detail computation for segment intersecting linestring. */
  public computeSegmentLineString(
    lsA: LineSegment3d,
    extendA0: boolean,
    extendA1: boolean,
    lsB: LineString3d,
    extendB0: boolean,
    extendB1: boolean,
    reversed: boolean,
  ): any {
    const pointA0 = lsA.point0Ref;
    const pointA1 = lsA.point1Ref;
    const pointB0 = CurveCurveIntersectXYZ._workPointBB0;
    const pointB1 = CurveCurveIntersectXYZ._workPointBB1;
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
    arcA: Arc3d,
    extendA0: boolean,
    extendA1: boolean,
    lsB: LineString3d,
    extendB0: boolean,
    extendB1: boolean,
    reversed: boolean,
  ): any {
    const pointB0 = CurveCurveIntersectXYZ._workPointBB0;
    const pointB1 = CurveCurveIntersectXYZ._workPointBB1;
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
  private computeLineStringLineString(lsA: LineString3d, lsB: LineString3d, reversed: boolean): void {
    const pointA0 = CurveCurveIntersectXYZ._workPointAA0;
    const pointA1 = CurveCurveIntersectXYZ._workPointAA1;
    const pointB0 = CurveCurveIntersectXYZ._workPointBB0;
    const pointB1 = CurveCurveIntersectXYZ._workPointBB1;
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
            lsA, ia === 1 && this._extendA0, pointA0, fA0, pointA1, fA1, (ia + 1) === numA && this._extendA1,
            lsB, ib === 1 && this._extendB0, pointB0, fB0, pointB1, fB1, (ib + 1) === numB && this._extendB1,
            reversed,
          );
        }
      }
    }
  }
  /**
   * Low level dispatch of curve collection.
   * We take care of extend variables of geometry's children here if geometry is Path or Loop.
   */
  private dispatchCurveCollection(geomA: AnyCurve, geomAHandler: (geomA: any) => any): void {
    const geomB = this._geometryB; // save
    if (!geomB || !geomB.children || !(geomB instanceof CurveCollection))
      return;
    const children = geomB.children;
    const extendB0 = this._extendB0; // save
    const extendB1 = this._extendB1; // save
    for (let i = 0; i < children.length; i++) {
      this.resetGeometry(children[i]);
      if (geomB instanceof Path && children.length > 1) {
        if (i === 0)
          this._extendB1 = false; // first child can only extend from start
        else if (i === children.length - 1)
          this._extendB0 = false; // last child can only extend from end
        else
          this._extendB0 = this._extendB1 = false; // middle children cannot extend
      } else if (geomB instanceof Loop) {
        this._extendB0 = this._extendB1 = false; // Loops cannot extend
      }
      geomAHandler(geomA);
      this._extendB0 = extendB0; // restore
      this._extendB1 = extendB1; // restore
    }
    this.resetGeometry(geomB); // restore
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
    this.resetGeometry(geomB.path);
    this.dispatchCurveCollection(geomA, geomAHandler);
    this.resetGeometry(geomB); // restore
    this._results = CurveChainWithDistanceIndex.convertChildDetailToChainDetail(
      this._results, index0, undefined, geomB, true,
    );
  }
  /**
 * Invoke `child.dispatchToGeometryHandler(this)` for each child in the array returned by the query `g.children`.
 * We take care of extend variables of geometry's children here if geometry is Path or Loop.
 */
  public override handleChildren(g: GeometryQuery): any {
    const children = g.children;
    const extendA0 = this._extendA0; // save
    const extendA1 = this._extendA1; // save
    if (children)
      for (let i = 0; i < children.length; i++) {
        if (g instanceof Path && children.length > 1) {
          if (i === 0)
            this._extendA1 = false; // first child can only extend from start
          else if (i === children.length - 1)
            this._extendA0 = false; // last child can only extend from end
          else
            this._extendA0 = this._extendA1 = false; // middle children cannot extend
        } else if (g instanceof Loop) {
          this._extendA0 = this._extendA1 = false; // Loops cannot extend
        }
        children[i].dispatchToGeometryHandler(this);
        this._extendA0 = extendA0; // restore
        this._extendA1 = extendA1; // restore
      }
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
    } else if (this._geometryB instanceof CurveCollection) {
      this.dispatchCurveCollection(segmentA, this.handleLineSegment3d.bind(this));
    } else if (this._geometryB instanceof CurveChainWithDistanceIndex) {
      this.dispatchCurveChainWithDistanceIndex(segmentA, this.handleLineSegment3d.bind(this));
    }
    return undefined;
  }
  /** double dispatch handler for strongly typed linestring. */
  public override handleLineString3d(lsA: LineString3d): any {
    if (this._geometryB instanceof LineString3d) {
      const lsB = this._geometryB;
      this.computeLineStringLineString(lsA, lsB, false);
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
        this._geometryB, this._extendB0, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB1,
        arc0, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.computeArcLineString(
        arc0, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcArc(
        arc0, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
    } else if (this._geometryB instanceof BSplineCurve3d) {
      this.dispatchArcBsplineCurve3d(
        arc0, this._extendA0, this._extendA1, this._geometryB, this._extendB0, this._extendB1, false,
      );
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
      this.dispatchSegmentBsplineCurve(
        this._geometryB, this._extendB0, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB1,
        curve, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.dispatchLineStringBSplineCurve(
        this._geometryB, this._extendB0, this._extendB1, curve, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcBsplineCurve3d(
        this._geometryB, this._extendB0, this._extendB1, curve, this._extendA0, this._extendA1, true,

      );
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
  /** Double dispatch handler for strongly typed homogeneous bspline curve. */
  public override handleBSplineCurve3dH(_curve: BSplineCurve3dH): any {
    /*
    // NEEDS WORK -- make "dispatch" methods tolerant of both 3d and 3dH
    // "easy" if both present BezierCurve3dH span loaders
    if (this._geometryB instanceof LineSegment3d) {
      this.dispatchSegmentBsplineCurve(
        this._geometryB, this._extendB0, this._geometryB.point0Ref, 0.0, this._geometryB.point1Ref, 1.0, this._extendB1,
        curve, this._extendA0, this.extendA1, true,
      );
    } else if (this._geometryB instanceof LineString3d) {
      this.dispatchLineStringBSplineCurve(
        this._geometryB, this._extendB0, this._extendB1, curve, this._extendA0, this._extendA1, true,
      );
    } else if (this._geometryB instanceof Arc3d) {
      this.dispatchArcBsplineCurve3d(
        this._geometryB, this._extendB0, this._extendB1, curve, this._extendA0, this._extendA1, true,
      );
    }
    */
    return undefined;
  }
}
