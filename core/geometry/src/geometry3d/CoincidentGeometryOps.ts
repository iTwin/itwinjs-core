/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Arc3d } from "../curve/Arc3d";
import { CurveLocationDetail, CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { Geometry } from "../Geometry";
import { AngleSweep } from "./AngleSweep";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Segment1d } from "./Segment1d";

/**
 * `CoincidentGeometryQuery` has methods useful in testing for overlapping geometry.
 * * Each instance carries tolerance information that can be reused over extended call sequences.
 * * These methods are expected to be called internally by CurveCurve intersection methods.
 * @internal
 */
export class CoincidentGeometryQuery {
  private _vectorU?: Vector3d;
  private _vectorV?: Vector3d;
  private _tolerance: number;
  private constructor(tolerance: number = Geometry.smallMetricDistance) {
    this._tolerance = tolerance;
  }
  public static create(tolerance: number = Geometry.smallMetricDistance): CoincidentGeometryQuery {
    return new CoincidentGeometryQuery(tolerance);
  }
  /**
   * * Assign both the fraction and fraction1 values in the detail, possibly swapped.
   * * reevaluate the points as simple interpolation between given points.
   */
  public static assignDetailInterpolatedFractionsAndPoints(detail: CurveLocationDetail, f0: number, f1: number,
    pointA: Point3d, pointB: Point3d, swap: boolean = false) {
    if (swap) {
      detail.fraction = f1;
      detail.fraction1 = f0;
    } else {
      detail.fraction = f0;
      detail.fraction1 = f1;
    }
    detail.point = pointA.interpolate(detail.fraction, pointB, detail.point);
    detail.point1 = pointA.interpolate(detail.fraction1, pointB, detail.point1);

  }

  /** Return a curve location detail with projection of a `spacePoint` to the line segment with `pointA` and `pointB`
   *
   */
  public projectPointToSegmentXY(spacePoint: Point3d, pointA: Point3d, pointB: Point3d): CurveLocationDetail {
    this._vectorU = Vector3d.createStartEnd(pointA, pointB, this._vectorU);
    this._vectorV = Vector3d.createStartEnd(pointA, spacePoint, this._vectorV);
    const uDotU = this._vectorU.dotProductXY(this._vectorU);
    const uDotV = this._vectorU.dotProductXY(this._vectorV);
    const fraction = Geometry.safeDivideFraction(uDotV, uDotU, 0.0);
    return CurveLocationDetail.createCurveFractionPoint(undefined, fraction,
      pointA.interpolate(fraction, pointB));
  }
  /**
   * * project `pointA0` and `pointA1` onto the segment with `pointB0` and `pointB1`
   * * In the returned detail pair, the `detailA` has fractions along segmentA, and `detailB` has fractions along segment B
   * @param pointA0 start point of segment A
   * @param pointA1 end point of segment A
   * @param pointB0 start point of segment B
   * @param pointB1 end point of segment B
   */
  public coincidentSegmentRangeXY(pointA0: Point3d, pointA1: Point3d, pointB0: Point3d, pointB1: Point3d, restrictToBounds: boolean = true): CurveLocationDetailPair | undefined {
    const detailAOnB = this.projectPointToSegmentXY(pointA0, pointB0, pointB1);
    if (pointA0.distanceXY(detailAOnB.point) > this._tolerance)
      return undefined;
    const detailA1OnB = this.projectPointToSegmentXY(pointA1, pointB0, pointB1);
    if (pointA1.distanceXY(detailA1OnB.point) > this._tolerance)
      return undefined;

    const detailBOnA = this.projectPointToSegmentXY(pointB0, pointA0, pointA1);
    if (pointB0.distanceXY(detailBOnA.point) > this._tolerance)
      return undefined;
    const detailB1OnA = this.projectPointToSegmentXY(pointB1, pointA0, pointA1);
    if (pointB1.distanceXY(detailB1OnA.point) > this._tolerance)
      return undefined;

    detailAOnB.fraction1 = detailA1OnB.fraction;
    detailAOnB.point1 = detailA1OnB.point;  // capture -- detailB0OnA is not reused.
    detailBOnA.fraction1 = detailB1OnA.fraction;
    detailBOnA.point1 = detailB1OnA.point;
    if (!restrictToBounds)
      return CurveLocationDetailPair.createCapture(detailBOnA, detailAOnB);

    const segment = Segment1d.create(detailBOnA.fraction, detailBOnA.fraction1);
    if (segment.clampDirectedTo01()) {
      segment.reverseIfNeededForDeltaSign(1.0);
      const f0 = segment.x0;
      const f1 = segment.x1;
      const h0 = detailBOnA.inverseInterpolateFraction(f0);
      const h1 = detailBOnA.inverseInterpolateFraction(f1);
      // recompute fractions and points..
      CoincidentGeometryQuery.assignDetailInterpolatedFractionsAndPoints(detailBOnA, f0, f1, pointA0, pointA1);
      CoincidentGeometryQuery.assignDetailInterpolatedFractionsAndPoints(detailAOnB, h0, h1, pointB0, pointB1);
      return CurveLocationDetailPair.createCapture(detailBOnA, detailAOnB);
    } else {
      if (segment.signedDelta() < 0.0) {
        if (detailBOnA.point.isAlmostEqual(pointA0)) {
          detailBOnA.collapseToStart();
          detailAOnB.collapseToStart();
          return CurveLocationDetailPair.createCapture(detailBOnA, detailAOnB);
        }
        if (detailBOnA.point1.isAlmostEqual(pointA1)) {
          detailBOnA.collapseToEnd();
          detailAOnB.collapseToEnd();
          return CurveLocationDetailPair.createCapture(detailBOnA, detailAOnB);
        }
      } else {
        if (detailBOnA.point.isAlmostEqual(pointA1)) {
          detailBOnA.collapseToStart();
          detailAOnB.collapseToEnd();
          return CurveLocationDetailPair.createCapture(detailBOnA, detailAOnB);
        }
        if (detailBOnA.point1.isAlmostEqual(pointA0)) {
          detailBOnA.collapseToEnd();
          detailAOnB.collapseToStart();
          return CurveLocationDetailPair.createCapture(detailBOnA, detailAOnB);
        }
      }
    }
    return undefined;
  }
  /**
   * Create a CurveLocationDetailPair from . . .
   * @param cpA curveA
   * @param cpB curve B
   * @param fractionsOnA fractions of an active section of curveA
   * @param fractionB0 fraction of an original containing B interval
   * @param fractionB1 end fraction of an original containing B interval
   */
  private createDetailPair(cpA: CurvePrimitive, cpB: CurvePrimitive, fractionsOnA: Segment1d, fractionB0: number, fractionB1: number, reverse: boolean): CurveLocationDetailPair | undefined {
    const deltaB = fractionB1 - fractionB0;
    const g0 = Geometry.conditionalDivideFraction(fractionsOnA.x0 - fractionB0, deltaB);
    const g1 = Geometry.conditionalDivideFraction(fractionsOnA.x1 - fractionB0, deltaB);
    if (g0 !== undefined && g1 !== undefined) {
      const detailA = CurveLocationDetail.createCurveEvaluatedFractionFraction(cpA, fractionsOnA.x0, fractionsOnA.x1);
      const detailB = CurveLocationDetail.createCurveEvaluatedFractionFraction(cpB, g0, g1);
      if (reverse) {
        detailA.swapFractionsAndPoints();
        detailB.swapFractionsAndPoints();
      }
      return CurveLocationDetailPair.createCapture(detailA, detailB);
    }
    return undefined;
  }
  private appendDetailPair(result: CurveLocationDetailPair[] | undefined, pair: CurveLocationDetailPair | undefined): CurveLocationDetailPair[] | undefined {
    if (pair === undefined)
      return result;
    if (result === undefined)
      return [pair];
    result.push(pair);
    return result;
  }
  /**
   * Test if 2 arcs have coinciding portions.
   * @param arcA
   * @param arcB
   * @param _restrictToBounds
   * @return 0, 1, or 2 overlap intervals.
   */
  public coincidentArcIntersectionXY(arcA: Arc3d, arcB: Arc3d, _restrictToBounds: boolean = true): CurveLocationDetailPair[] | undefined {
    let result: CurveLocationDetailPair[] | undefined;
    if (arcA.center.isAlmostEqual(arcB.center)) {
      const matrixBToA = arcA.matrixRef.multiplyMatrixInverseMatrix(arcB.matrixRef);
      if (matrixBToA) {
        const ux = matrixBToA.at(0, 0); const uy = matrixBToA.at(1, 0);
        const vx = matrixBToA.at(0, 1); const vy = matrixBToA.at(1, 1);
        const ru = Geometry.hypotenuseXY(ux, uy);
        const rv = Geometry.hypotenuseXY(vx, vy);
        const dot = Geometry.dotProductXYXY(ux, uy, vx, vy);
        const cross = Geometry.crossProductXYXY(ux, uy, vx, vy);
        if (Geometry.isAlmostEqualNumber(ru, 1.0)
          && Geometry.isAlmostEqualNumber(rv, 1.0)
          && Geometry.isAlmostEqualNumber(0, dot)) {
          const alphaB0Radians = Math.atan2(uy, ux);       // angular position of arcB 0 point in A sweep
          const sweepDirection = cross > 0 ? 1.0 : -1.0;   // 1 if arcB's parameter space sweeps forward, -1 if reverse
          const betaStartRadians = alphaB0Radians + sweepDirection * arcB.sweep.startRadians;
          const betaEndRadians = alphaB0Radians + sweepDirection * arcB.sweep.endRadians;
          const fractionSpacesReversed = (sweepDirection * arcA.sweep.sweepRadians * arcB.sweep.sweepRadians) < 0;
          const sweepB = AngleSweep.createStartEndRadians(betaStartRadians, betaEndRadians);
          const sweepA = arcA.sweep;
          const fractionPeriodA = sweepA.fractionPeriod();
          const fractionB0 = sweepA.radiansToPositivePeriodicFraction(sweepB.startRadians);
          const fractionSweep = sweepB.sweepRadians / sweepA.sweepRadians;
          const fractionB1 = fractionB0 + fractionSweep;
          const fractionSweepB = Segment1d.create(fractionB0, fractionB1);
          if (fractionSweepB.clampDirectedTo01())
            result = this.appendDetailPair(result, this.createDetailPair(arcA, arcB, fractionSweepB, fractionB0, fractionB1, fractionSpacesReversed));
          if (fractionB1 > fractionPeriodA) {
            const fractionSweepBWrap = Segment1d.create(fractionB0 - fractionPeriodA, fractionB1 - fractionPeriodA);
            if (fractionSweepBWrap.clampDirectedTo01())
              result = this.appendDetailPair(result, this.createDetailPair(arcA, arcB, fractionSweepBWrap, fractionB0, fractionB1, fractionSpacesReversed));
          }
        }
      }
    }
    return result;
  }
}
