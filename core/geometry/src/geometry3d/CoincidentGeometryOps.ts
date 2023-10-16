/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { assert } from "@itwin/core-bentley";
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
  private _point0?: Point3d;
  private _point1?: Point3d;
  private _tolerance: number;
  public get tolerance(): number {
    return this._tolerance;
  }
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

  /** Return a curve location detail with projection of a `spacePoint` to the line segment with `pointA` and `pointB` */
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
   * Given a detail pair representing the projection of each of two colinear line segments onto the other,
   * clamp the details (in place) to the line segments' endpoints according to the given flags.
   * @param overlap segment overlap as returned by [[coincidentSegmentRangeXY]], modified on return
   * @param pointA0 start point of segment A
   * @param pointA1 end point of segment A
   * @param pointB0 start point of segment B
   * @param pointB1 end point of segment B
   * @param extendA0 whether to extend segment A beyond its start
   * @param extendA1 whether to extend segment A beyond its end
   * @param extendB0 whether to extend segment B beyond its start
   * @param extendB1 whether to extend segment B beyond its end
   * @return reference to the input clamped in place, or undefined (leaving interval untouched) if clamping would result in empty interval.
   */
  public clampCoincidentOverlapToSegmentBounds(overlap: CurveLocationDetailPair,
    pointA0: Point3d, pointA1: Point3d, pointB0: Point3d, pointB1: Point3d,
    extendA0: boolean = false, extendA1: boolean = false, extendB0: boolean = false, extendB1: boolean = false,
  ): CurveLocationDetailPair | undefined {
    const rangeA = Segment1d.create(overlap.detailA.fraction, overlap.detailA.hasFraction1 ? overlap.detailA.fraction1 : overlap.detailA.fraction);
    const rangeB = Segment1d.create(overlap.detailB.fraction, overlap.detailB.hasFraction1 ? overlap.detailB.fraction1 : overlap.detailB.fraction);
    const reversed = rangeA.signedDelta() < 0.0;

    const updateIntervalFromRangesAndInterpolatedPoints = (): CurveLocationDetailPair => {
      const a0 = rangeA.x0;
      const a1 = rangeA.x1;
      const b0 = rangeB.x0;
      const b1 = rangeB.x1;
      CoincidentGeometryQuery.assignDetailInterpolatedFractionsAndPoints(overlap.detailA, a0, a1, pointA0, pointA1, a0 > a1);
      CoincidentGeometryQuery.assignDetailInterpolatedFractionsAndPoints(overlap.detailB, b0, b1, pointB0, pointB1, b0 > b1);
      return overlap;
    };

    const haveIntervalA = rangeA.clampDirectedTo01(!extendA0, !extendA1, false);
    const haveIntervalB = rangeB.clampDirectedTo01(!extendB0, !extendB1, false);
    if (haveIntervalA && haveIntervalB) {
      if (Geometry.isAlmostEqualNumber(rangeA.absoluteDelta(), rangeB.absoluteDelta(), Geometry.smallFraction))
        return updateIntervalFromRangesAndInterpolatedPoints();  // intersection of partially clamped ranges
      else if (rangeA.clampDirectedTo01(true, true, false) && rangeB.clampDirectedTo01(true, true, false))
        return updateIntervalFromRangesAndInterpolatedPoints();  // intersection of fully clamped ranges
    }

    const collapseToSingleton = (pointA: Point3d, pointB: Point3d, atStartA: boolean, atStartB: boolean): CurveLocationDetailPair => {
      pointA.clone(overlap.detailA.point);
      pointB.clone(overlap.detailB.point);
      overlap.detailA.fraction = atStartA ? 0.0 : 1.0;
      overlap.detailB.fraction = atStartB ? 0.0 : 1.0;
      overlap.detailA.collapseToStart();
      overlap.detailB.collapseToStart();
      return overlap;
    };

    const haveSingletonA = rangeA.clampDirectedTo01(true, true, true);
    const haveSingletonB = rangeB.clampDirectedTo01(true, true, true);
    if (haveSingletonA && haveSingletonB) { // intersection is a single point
      const point1 = overlap.detailA.point1 ?? overlap.detailA.point;
      if (reversed) {
        if (overlap.detailA.point.isAlmostEqual(pointA0, this.tolerance))
          return collapseToSingleton(pointA0, pointB0, true, true);
        else if (point1.isAlmostEqual(pointA1, this.tolerance))
          return collapseToSingleton(pointA1, pointB1, false, false);
      } else {
        if (point1.isAlmostEqual(pointA0, this.tolerance))
          return collapseToSingleton(pointA0, pointB1, true, false);
        else if (overlap.detailA.point.isAlmostEqual(pointA1, this.tolerance))
          return collapseToSingleton(pointA1, pointB0, false, true);
      }
    }
    return undefined; // no intersection
  }
  /**
   * Compute whether two line segments have a coincident overlap in xy.
   * * Project `pointA0` and `pointA1` onto the line formed by `pointB0` and `pointB1` and vice versa
   * * If all projection distances are sufficiently small, return a detail pair recording the coincident interval, optionally clipped to segment bounds.
   * @param pointA0 start point of segment A
   * @param pointA1 end point of segment A
   * @param pointB0 start point of segment B
   * @param pointB1 end point of segment B
   * @param restrictToBounds whether to clip the coincident segment details to the segment bounds
   * @return detail pair for the coincident interval (`detailA` has fractions along segment A, and `detailB` has fractions along segment B), or undefined if no coincidence
   */
  public coincidentSegmentRangeXY(pointA0: Point3d, pointA1: Point3d, pointB0: Point3d, pointB1: Point3d, restrictToBounds: boolean = true): CurveLocationDetailPair | undefined {
    const detailA0OnB = this.projectPointToSegmentXY(pointA0, pointB0, pointB1);
    if (pointA0.distanceXY(detailA0OnB.point) > this._tolerance)
      return undefined;
    const detailA1OnB = this.projectPointToSegmentXY(pointA1, pointB0, pointB1);
    if (pointA1.distanceXY(detailA1OnB.point) > this._tolerance)
      return undefined;

    const detailB0OnA = this.projectPointToSegmentXY(pointB0, pointA0, pointA1);
    if (pointB0.distanceXY(detailB0OnA.point) > this._tolerance)
      return undefined;
    const detailB1OnA = this.projectPointToSegmentXY(pointB1, pointA0, pointA1);
    if (pointB1.distanceXY(detailB1OnA.point) > this._tolerance)
      return undefined;

    detailA0OnB.fraction1 = detailA1OnB.fraction;
    detailA0OnB.point1 = detailA1OnB.point;  // capture -- detailA1OnB is not reused.
    detailB0OnA.fraction1 = detailB1OnA.fraction;
    detailB0OnA.point1 = detailB1OnA.point;
    const interval = CurveLocationDetailPair.createCapture(detailB0OnA, detailA0OnB);

    return restrictToBounds ? this.clampCoincidentOverlapToSegmentBounds(interval, pointA0, pointA1, pointB0, pointB1) : interval;
  }
  /**
   * Create a CurveLocationDetailPair for a coincident interval of two overlapping curves
   * @param cpA curveA
   * @param cpB curveB
   * @param fractionsOnA coincident interval of curveB in fraction space of curveA
   * @param fractionB0 curveB start in fraction space of curveA
   * @param fractionB1 curveB end in fraction space of curveA
   * @param reverse whether curveB and curveA have opposite direction
   */
  private createDetailPair(cpA: CurvePrimitive, cpB: CurvePrimitive, fractionsOnA: Segment1d, fractionB0: number, fractionB1: number, reverse: boolean): CurveLocationDetailPair | undefined {
    const deltaB = fractionB1 - fractionB0;
    const g0 = Geometry.conditionalDivideFraction(fractionsOnA.x0 - fractionB0, deltaB);
    const g1 = Geometry.conditionalDivideFraction(fractionsOnA.x1 - fractionB0, deltaB);
    if (g0 !== undefined && g1 !== undefined) {
      const detailA = CurveLocationDetail.createCurveEvaluatedFractionFraction(cpA, fractionsOnA.x0, fractionsOnA.x1);
      const detailB = CurveLocationDetail.createCurveEvaluatedFractionFraction(cpB, g0, g1);
      if (reverse)
        detailA.swapFractionsAndPoints();
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
   * @return 0, 1, or 2 overlap points/intervals
   */
  public coincidentArcIntersectionXY(arcA: Arc3d, arcB: Arc3d, _restrictToBounds: boolean = true): CurveLocationDetailPair[] | undefined {
    let result: CurveLocationDetailPair[] | undefined;
    if (arcA.center.isAlmostEqual(arcB.center, this.tolerance)) {
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
          const alphaB0Radians = Math.atan2(uy, ux);        // angular position of arcB 0 point in arcA sweep
          const sweepDirection = cross > 0 ? 1.0 : -1.0;    // 1 if arcB parameter space sweeps in same direction as arcA, -1 if opposite
          const betaStartRadians = alphaB0Radians + sweepDirection * arcB.sweep.startRadians;   // arcB start in arcA parameter space
          const betaEndRadians = alphaB0Radians + sweepDirection * arcB.sweep.endRadians;       // arcB end in arcA parameter space
          const fractionSpacesReversed = (sweepDirection * arcA.sweep.sweepRadians * arcB.sweep.sweepRadians) < 0;
          const sweepB = AngleSweep.createStartEndRadians(betaStartRadians, betaEndRadians);
          const sweepA = arcA.sweep;
          const fractionPeriodA = sweepA.fractionPeriod();
          const fractionB0 = sweepA.radiansToPositivePeriodicFraction(sweepB.startRadians);   // arcB start in arcA fraction space
          assert(fractionB0 >= 0.0);
          const fractionSweep = sweepB.sweepRadians / sweepA.sweepRadians;                    // arcB sweep in arcA fraction space
          const fractionB1 = fractionB0 + fractionSweep;                                      // arcB end in arcA fraction space
          const fractionSweepB = Segment1d.create(fractionB0, fractionB1);

          /** lambda to add a coincident interval or isolated intersection, given inputs in arcA fraction space
           * @param arcBInArcAFractionSpace span of arcB in arcA fraction space. On return, clamped to [0,1] if nontrivial.
           * @param testStartOfArcA if no nontrivial coincident interval was found, look for an isolated intersection at the start (true) or end (false) of arcA
           * @returns whether a detail pair was appended to result
           */
          const appendCoincidentIntersection = (arcBInArcAFractionSpace: Segment1d, testStartOfArcA: boolean): boolean => {
            const size = result ? result.length : 0;
            const arcBStart = arcBInArcAFractionSpace.x0;
            const arcBEnd = arcBInArcAFractionSpace.x1;
            if (arcBInArcAFractionSpace.clampDirectedTo01() && !Geometry.isSmallRelative(arcBInArcAFractionSpace.absoluteDelta())) {
              result = this.appendDetailPair(result, this.createDetailPair(arcA, arcB, arcBInArcAFractionSpace, arcBStart, arcBEnd, fractionSpacesReversed));
            } else {  // test isolated intersection
              const testStartOfArcB = fractionSpacesReversed ? testStartOfArcA : !testStartOfArcA;
              const arcAPt = this._point0 = testStartOfArcA ? arcA.startPoint(this._point0) : arcA.endPoint(this._point0);
              const arcBPt = this._point1 = testStartOfArcB ? arcB.startPoint(this._point1) : arcB.endPoint(this._point1);
              if (arcAPt.isAlmostEqual(arcBPt, this.tolerance)) {
                const detailA = CurveLocationDetail.createCurveFractionPoint(arcA, testStartOfArcA ? 0 : 1, arcAPt);
                const detailB = CurveLocationDetail.createCurveFractionPoint(arcB, testStartOfArcB ? 0 : 1, arcBPt);
                result = this.appendDetailPair(result, CurveLocationDetailPair.createCapture(detailA, detailB));
              }
            }
            return result !== undefined && result.length > size;
          };

          appendCoincidentIntersection(fractionSweepB, false);  // compute overlap in strict interior, or at end of arcA

          // check overlap at start of arcA with a periodic shift of fractionSweepB
          if (fractionB1 >= fractionPeriodA)
            appendCoincidentIntersection(Segment1d.create(fractionB0 - fractionPeriodA, fractionB1 - fractionPeriodA), true);
          else if (fractionB0 === 0.0)
            appendCoincidentIntersection(Segment1d.create(fractionB0 + fractionPeriodA, fractionB1 + fractionPeriodA), true);
        }
      }
    }
    return result;
  }
}
