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
import { CurveCurveCloseApproachXY } from "./CurveCurveCloseApproachXY";
import { CurveCurveIntersectXY, CurveLocationDetailArrayPair } from "./CurveCurveIntersectXY";
import { CurveCurveIntersectXYZ } from "./CurveCurveIntersectXYZ";
import { CurveLocationDetailPair } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";

/**
 * `CurveCurve` has static method for various computations that work on a pair of curves or curve collections.
 * @public
 */
export class CurveCurve {
  /**
   * Return xy intersections of 2 curves.
   * * **NOTE:** GeometryQuery inputs should really be AnyCurve.
   * @param geometryA first geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   * @param tolerance optional distance tolerance for coincidence
   */
  public static intersectionXYPairs(
    geometryA: GeometryQuery,
    extendA: boolean,
    geometryB: GeometryQuery,
    extendB: boolean,
    tolerance: number = Geometry.smallMetricDistance,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(undefined, extendA, geometryB, extendB, tolerance);
    if (geometryB instanceof CurvePrimitive) {
      geometryA.dispatchToGeometryHandler(handler);
    } else if (geometryB instanceof CurveCollection) {
      const allCurves = geometryB.collectCurvePrimitives();
      for (const child of allCurves) {
        handler.resetGeometry(false, child, false);
        geometryA.dispatchToGeometryHandler(handler);
      }
    }
    return handler.grabPairedResults();
  }
  /**
   * Return xy intersections of 2 projected curves.
   * * **NOTE:** GeometryQuery inputs should really be AnyCurve.
   * @param geometryA first geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   * @param tolerance optional distance tolerance for coincidence
   */
  public static intersectionProjectedXYPairs(
    worldToLocal: Matrix4d,
    geometryA: GeometryQuery,
    extendA: boolean,
    geometryB: GeometryQuery,
    extendB: boolean,
    tolerance: number = Geometry.smallMetricDistance,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(worldToLocal, extendA, geometryB, extendB, tolerance);
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabPairedResults();
  }
  /**
   * Return full 3d xyz intersections of 2 curves.
   *  * Implemented for combinations of LineSegment3d, LineString3d, Arc3d.
   *  * Not Implemented for bspline and bezier curves.
   * * **NOTE:** GeometryQuery inputs should really be AnyCurve.
   * @beta
   * @param geometryA first geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   */
  public static intersectionXYZ(
    geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean,
  ): CurveLocationDetailArrayPair {
    const handler = new CurveCurveIntersectXYZ(extendA, geometryB, extendB);
    geometryA.dispatchToGeometryHandler(handler);
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
      const geometryA = primitives[i];
      for (let j = i + 1; j < primitives.length; j++) {
        handler.resetGeometry(false, primitives[j], false);
        geometryA.dispatchToGeometryHandler(handler);
      }
    }
    return handler.grabPairedResults();
  }
  /**
   * Return xy close approaches of 2 projected curves.
   * * **NOTE:** GeometryQuery inputs should really be AnyCurve.
   * @param geometryA first geometry
   * @param geometryB second geometry
   * @param maxDistance maximum allowed approach length
   */
  public static closeApproachProjectedXYPairs(
    geometryA: GeometryQuery, geometryB: GeometryQuery, maxDistance: number,
  ): CurveLocationDetailPair[] {
    const handler = new CurveCurveCloseApproachXY(geometryB);
    handler.maxDistanceToAccept = maxDistance;
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabPairedResults();
  }
}
