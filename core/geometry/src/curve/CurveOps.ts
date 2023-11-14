/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { Range3d } from "../geometry3d/Range";
import { BagOfCurves, CurveCollection } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyChain, AnyCurve } from "./CurveTypes";
import { MultiChainCollector } from "./internalContexts/MultiChainCollector";
import { CurveChainWireOffsetContext } from "./internalContexts/PolygonOffsetContext";
import { LineString3d } from "./LineString3d";
import { Loop } from "./Loop";
import { OffsetOptions } from "./OffsetOptions";
import { Path } from "./Path";
import { StrokeOptions } from "./StrokeOptions";

/**
 * Static methods for miscellaneous curve operations.
 * @public
 */
export class CurveOps {
  /** Recursively sum curve lengths, allowing CurvePrimitive, CurveCollection, or array of such at any level. */
  public static sumLengths(curves: AnyCurve | AnyCurve[]): number {
    let mySum = 0;
    if (curves instanceof CurvePrimitive) {
      mySum += curves.curveLength();
    } else if (curves instanceof CurveCollection) {
      mySum += curves.sumLengths();
    } else if (Array.isArray(curves)) {
      for (const data1 of curves)
        mySum += this.sumLengths(data1);
    }
    return mySum;
  }
  /** Recursively extend the range by each curve's range, allowing CurvePrimitive, CurveCollection, or array of such at any level. */
  public static extendRange(range: Range3d, curves: AnyCurve | AnyCurve[]): Range3d {
    if (Array.isArray(curves)) {
      for (const data1 of curves)
        this.extendRange(range, data1);
    } else {
      curves.extendRange(range);
    }
    return range;
  }
  /**
   * Construct a separate xy-offset for each input curve.
   * * For best offset results, the inputs should be parallel to the xy-plane.
   * @param curves input curve(s), z-coordinates ignored. Only curves of type [[AnyChain]] are handled.
   * @param offset offset distance (positive to left of curve, negative to right)
   * @param result array to collect offset curves
   * @returns summed length of offset curves
   */
  public static appendXYOffsets(curves: AnyCurve | AnyCurve[] | undefined, offset: number, result: AnyCurve[]): number {
    let summedLengths = 0;
    if (curves instanceof CurvePrimitive) {
      const resultA = CurveChainWireOffsetContext.constructCurveXYOffset(Path.create(curves), offset);
      if (resultA) {
        summedLengths += this.sumLengths(resultA);
        result.push(resultA);
      }
    } else if (curves instanceof Loop || curves instanceof Path) {
      const resultA = CurveChainWireOffsetContext.constructCurveXYOffset(curves, offset);
      if (resultA) {
        summedLengths += this.sumLengths(resultA);
        result.push(resultA);
      }
    } else if (curves instanceof BagOfCurves) {
      for (const q of curves.children)
        summedLengths += this.appendXYOffsets(q, offset, result);
    } else if (Array.isArray(curves)) {
      for (const q of curves)
        summedLengths += this.appendXYOffsets(q, offset, result);
    }
    return summedLengths;
  }
  /**
   * Restructure curve fragments as Paths and Loops, and construct xy-offsets of the chains.
   * * If the inputs do not form Loop(s), the classification of offsets is suspect.
   * * For best offset results, the inputs should be parallel to the xy-plane.
   * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
   * @param fragments fragments to be chained and offset
   * @param offsetDistance offset distance, applied to both sides of each fragment to produce inside and outside xy-offset curves.
   * @param gapTolerance distance to be treated as "effectively zero" when joining head-to-tail
   * @returns object with named chains, insideOffsets, outsideOffsets
   */
  public static collectInsideAndOutsideXYOffsets(fragments: AnyCurve[], offsetDistance: number, gapTolerance: number): { insideOffsets: AnyCurve[], outsideOffsets: AnyCurve[], chains?: AnyChain } {
    const collector = new MultiChainCollector(gapTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    const chains = collector.grabResult(true);
    const myOffsetA: CurveCollection[] = [];
    const myOffsetB: CurveCollection[] = [];
    const offsetLengthA = CurveOps.appendXYOffsets(chains, offsetDistance, myOffsetA);
    const offsetLengthB = CurveOps.appendXYOffsets(chains, -offsetDistance, myOffsetB);
    if (offsetLengthA > offsetLengthB) {
      return { outsideOffsets: myOffsetA, insideOffsets: myOffsetB, chains };
    } else {
      return { insideOffsets: myOffsetA, outsideOffsets: myOffsetB, chains };
    }
  }
  /**
   * Construct curves that are offset from a Path or Loop as viewed in xy-plane (ignoring z).
   * * The construction will remove "some" local effects of features smaller than the offset distance, but will not detect self intersection among widely separated edges.
   * @param curves base curves.
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object.
   */
  public static constructCurveXYOffset(curves: Path | Loop, offsetDistanceOrOptions: number | OffsetOptions): CurveCollection | undefined {
    return CurveChainWireOffsetContext.constructCurveXYOffset(curves, offsetDistanceOrOptions);
  }
  /**
   * Create the offset of a single curve primitive as viewed in the xy-plane (ignoring z).
   * @param curve primitive to offset
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object
   */
  public static createSingleOffsetPrimitiveXY(curve: CurvePrimitive, offsetDistanceOrOptions: number | OffsetOptions): CurvePrimitive | CurvePrimitive[] | undefined {
    return CurveChainWireOffsetContext.createSingleOffsetPrimitiveXY(curve, offsetDistanceOrOptions);
  }
  /**
   * Restructure curve fragments as Paths and Loops.
   * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
   * @param fragments fragments to be chained
   * @param gapTolerance distance to be treated as "effectively zero" when assembling fragments head-to-tail
   * @param planeTolerance tolerance for considering a closed chain to be planar. If undefined, only create Path. If defined, create Loops for closed chains within tolerance of a plane.
   * @returns chains, possibly wrapped in a [[BagOfCurves]].
   */
  public static collectChains(fragments: AnyCurve[], gapTolerance: number = Geometry.smallMetricDistance, planeTolerance: number | undefined = Geometry.smallMetricDistance): AnyChain | undefined {
    const collector = new MultiChainCollector(gapTolerance, planeTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    return collector.grabResult(true);
  }
  /**
   * Restructure curve fragments as Paths and Loops, to be stroked and passed into the callback.
   * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
   * @param fragments fragments to be chained and stroked
   * @param announceChain callback to process each stroked Path and Loop
   * @param strokeOptions options for stroking the chains
   * @param gapTolerance distance to be treated as "effectively zero" when assembling fragments head-to-tail. Also used for removing duplicate points in the stroked chains.
   * @param planeTolerance tolerance for considering a closed chain to be planar. If undefined, only create Path. If defined, create Loops for closed chains within tolerance of a plane.
   */
  public static collectChainsAsLineString3d(fragments: AnyCurve[], announceChain: (chainPoints: LineString3d) => void, strokeOptions?: StrokeOptions, gapTolerance: number = Geometry.smallMetricDistance, planeTolerance: number | undefined = Geometry.smallMetricDistance) {
    const collector = new MultiChainCollector(gapTolerance, planeTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    collector.announceChainsAsLineString3d(announceChain, strokeOptions);
  }
}
