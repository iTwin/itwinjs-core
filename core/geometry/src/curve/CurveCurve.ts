/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { CurveCollection } from "./CurveCollection";
import { CurveCurveCloseApproachXY } from "./internalContexts/CurveCurveCloseApproachXY";
import { CurveCurveIntersectXY } from "./internalContexts/CurveCurveIntersectXY";
import { CurveCurveIntersectXYZ } from "./internalContexts/CurveCurveIntersectXYZ";
import { CurveLocationDetailArrayPair, CurveLocationDetailPair } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyCurve } from "./CurveTypes";

/**
 * `CurveCurve` has static method for various computations that work on a pair of curves or curve collections.
 * @public
 */
export class CurveCurve {
  /**
   * Return xy intersections of 2 curves.
   * @param curveA first curve
   * @param extendA true to allow curveA to extend
   * @param curveB second curve
   * @param extendB true to allow curveB to extend
   * @param tolerance optional distance tolerance for coincidence
   */
  public static intersectionXYPairs(
    curveA: AnyCurve,
    extendA: boolean,
    curveB: AnyCurve,
    extendB: boolean,
    tolerance: number = Geometry.smallMetricDistance,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(undefined, extendA, curveB, extendB, tolerance);
    if (curveB instanceof CurvePrimitive) {
      curveA.dispatchToGeometryHandler(handler);
    } else if (curveB instanceof CurveCollection) {
      const allCurves = curveB.collectCurvePrimitives();
      for (const child of allCurves) {
        handler.resetGeometry(false, child, false);
        curveA.dispatchToGeometryHandler(handler);
      }
    }
    return handler.grabPairedResults();
  }
  /**
   * Return xy intersections of 2 projected curves.
   * @param curveA first curve
   * @param extendA true to allow curveA to extend
   * @param curveB second curve
   * @param extendB true to allow curveB to extend
   * @param tolerance optional distance tolerance for coincidence
   */
  public static intersectionProjectedXYPairs(
    worldToLocal: Matrix4d,
    curveA: AnyCurve,
    extendA: boolean,
    curveB: AnyCurve,
    extendB: boolean,
    tolerance: number = Geometry.smallMetricDistance,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(worldToLocal, extendA, curveB, extendB, tolerance);
    curveA.dispatchToGeometryHandler(handler);
    return handler.grabPairedResults();
  }
  /**
   * Return full 3d xyz intersections of 2 curves.
   *  * Implemented for combinations of LineSegment3d, LineString3d, Arc3d.
   *  * Not Implemented for bspline and bezier curves.
   * @beta
   * @param curveA first curve
   * @param extendA true to allow curveA to extend
   * @param curveB second curve
   * @param extendB true to allow curveB to extend
   */
  public static intersectionXYZ(
    curveA: AnyCurve, extendA: boolean, curveB: AnyCurve, extendB: boolean,
  ): CurveLocationDetailArrayPair {
    const handler = new CurveCurveIntersectXYZ(extendA, curveB, extendB);
    curveA.dispatchToGeometryHandler(handler);
    return handler.grabResults();
  }
  /**
   * Return xy intersections of input curves.
   * @param primitives input curves to intersect
   * @param tolerance optional distance tolerance for coincidence
   */
  public static allIntersectionsAmongPrimitivesXY(
    primitives: CurvePrimitive[], tolerance: number = Geometry.smallMetricDistance,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(undefined, false, undefined, false, tolerance);
    for (let i = 0; i < primitives.length; i++) {
      const curveA = primitives[i];
      for (let j = i + 1; j < primitives.length; j++) {
        handler.resetGeometry(false, primitives[j], false);
        curveA.dispatchToGeometryHandler(handler);
      }
    }
    return handler.grabPairedResults();
  }
  /**
   * Return at least one XY close approach between 2 curves.
   * * Close approach xy-distances are measured without regard to z. This is equivalent to their separation distance
   * as seen in the top view, or as measured between their projections onto the xy-plane.
   * * If more than one approach is returned, one of them is the closest approach.
   * * If an input curve is a `CurveCollection`, then close approaches are computed to each `CurvePrimitive` child.
   * This can lead to many returned pairs, especially when both inputs are `CurveCollection`s. If an input curve is
   * an `AnyRegion` then close approaches are computed only to the boundary curves, not to the interior.
   * @param curveA first curve
   * @param curveB second curve
   * @param maxDistance maximum xy-distance to consider between the curves.
   * Close approaches further than this xy-distance are not returned.
   */
  public static closeApproachProjectedXYPairs(
    curveA: AnyCurve, curveB: AnyCurve, maxDistance: number,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveCloseApproachXY(curveB);
    handler.maxDistanceToAccept = maxDistance;
    curveA.dispatchToGeometryHandler(handler);
    return handler.grabPairedResults();
  }
  /**
   * Convenience method that calls [[closeApproachProjectedXYPairs]] with a large `maxDistance`
   * and returns a detail pair representing the closest xy-approach between the curves.
   * * There may be many detail pairs that represent "closest" xy-approach, including coincident interval pairs,
   * isolated intersections, or close approaches within tolerance of each other. This method makes no attempt to
   * distinguish among them, and returns a pair whose `detail.point` values are separated by the smallest xy distance
   * found among the pairs.
   * @param curveA first curve
   * @param curveB second curve
   * @return detail pair of closest xy-approach, undefined if not found
   */
  public static closestApproachProjectedXYPair(curveA: AnyCurve, curveB: AnyCurve): CurveLocationDetailPair | undefined {
    const range = curveA.range();
    range.extendRange(curveB.range());
    const maxDistance = range.low.distanceXY(range.high);
    const closeApproaches = this.closeApproachProjectedXYPairs(curveA, curveB, maxDistance);
    if (!closeApproaches.length)
      return undefined;
    let iMin = 0;
    let minDistXY = 2 * maxDistance;
    for (let i = 0; i < closeApproaches.length; ++i) {
      const distXY = closeApproaches[i].detailA.point.distanceXY(closeApproaches[i].detailB.point);
      if (distXY < minDistXY) {
        iMin = i;
        minDistXY = distXY;
      }
    }
    return closeApproaches[iMin];
  }
}
