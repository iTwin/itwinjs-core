/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Matrix4d } from "../geometry4d/Matrix4d";
import { CurveCollection } from "./CurveCollection";
import { CurveCurveIntersectXY, CurveLocationDetailArrayPair } from "./CurveCurveIntersectXY";
import { CurveCurveIntersectXYZ } from "./CurveCurveIntersectXYZ";
import { CurveLocationDetailPair } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { CurveCurveCloseApproachXY } from "./CurveCurveCloseApproachXY";

/**
 * `CurveCurve` has static method for various computations that work on a pair of curves or curve collections.
 * @public
 */
export class CurveCurve {
  /**
   * Return xy intersections of 2 curves.
   * @param geometryA second geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   */
  public static intersectionXYPairs(geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(undefined, geometryA, extendA, geometryB, extendB);
    if (geometryB instanceof CurvePrimitive) {
      geometryA.dispatchToGeometryHandler(handler);
    } else if (geometryB instanceof CurveCollection) {
      const allCurves = geometryB.collectCurvePrimitives();
      for (const child of allCurves) {
        handler.resetGeometry(geometryA, false, child, false);
        geometryA.dispatchToGeometryHandler(handler);
      }
    }
    return handler.grabPairedResults();
  }
  /**
   * Return xy intersections of 2 projected curves
   * @param geometryA second geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   */
  public static intersectionProjectedXYPairs(worldToLocal: Matrix4d, geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(worldToLocal, geometryA, extendA, geometryB, extendB);
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabPairedResults();
  }
  /**
   * Return full 3d xyz intersections of 2 curves.
   *  * Implemented for combinations of LineSegment3d, LineString3d, Arc3d.
   *  * Not Implemented for bspline and bezier curves.
   * @beta
   * @param geometryA second geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   */
  public static intersectionXYZ(geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailArrayPair {
    const handler = new CurveCurveIntersectXYZ(geometryA, extendA, geometryB, extendB);
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabResults();
  }
  /**
   * Return xy intersections of 2 curves.
   * @param geometryA second geometry
   * @param extendA true to allow geometryA to extend
   * @param geometryB second geometry
   * @param extendB true to allow geometryB to extend
   */
  public static allIntersectionsAmongPrimitivesXY(primitives: CurvePrimitive[]): CurveLocationDetailPair[] {
    const handler = new CurveCurveIntersectXY(undefined, undefined, false, undefined, false);
    for (let i = 0; i < primitives.length; i++) {
      const geometryA = primitives[i];
      for (let j = i + 1; j < primitives.length; j++) {
        handler.resetGeometry(geometryA, false, primitives[j], false);
        geometryA.dispatchToGeometryHandler(handler);
      }
    }
    return handler.grabPairedResults();
  }
  /**
   * Return xy close approaches of 2 projected curves
   * @param geometryA second geometry
   * @param geometryB second geometry
   */
  public static closeApproachProjectedXYPairs(
    geometryA: GeometryQuery, geometryB: GeometryQuery, maxDistance: number): CurveLocationDetailPair[] {
    const handler = new CurveCurveCloseApproachXY(geometryA, geometryB);
    handler.maxDistanceToAccept = maxDistance;
    geometryA.dispatchToGeometryHandler(handler);
    return handler.grabPairedResults();
  }

}
