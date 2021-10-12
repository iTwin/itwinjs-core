/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { CurveChain, CurveCollection } from "../CurveCollection";
import { CurveCurve } from "../CurveCurve";
import { CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { Path } from "../Path";

/**
 * Data about a curve cut.
 */
class CutFractionDescriptor {
  /** Fractional position along the curve */
  public fraction: number;
  public otherCurveDetail?: CurveLocationDetail;
  public constructor(fraction: number, otherCurveDetail?: CurveLocationDetail) {
    this.fraction = fraction;
    this.otherCurveDetail = otherCurveDetail;
  }
  /** Transfer data from other to this.
   * * Optionally look at both to set `otherCurveDetail`
   *   * `other.otherCurveDetail` wins over `this.otherCurveDetail`
   */
  public setFrom(other: CutFractionDescriptor, combineCutFlag: boolean) {
    if (combineCutFlag && this.isSameFraction(other))
      this.otherCurveDetail = other.otherCurveDetail ? other.otherCurveDetail : this.otherCurveDetail;
    this.fraction = other.fraction;
  }
  /** Test if a the fractions are almost equal. */
  public isSameFraction(other: CutFractionDescriptor): boolean {
    return Geometry.isSmallAngleRadians(this.fraction - other.fraction);
  }
  /** set from direct data */
  public set(fraction: number, otherCurveDetail?: CurveLocationDetail) {
    this.fraction = fraction;
    this.otherCurveDetail = otherCurveDetail;
  }
}
/**
 * Context for splitting curves.
 * @internal
 */
export class CurveSplitContext {
  // return true if data has one or more non-endpoint intersections.
  private static hasInteriorDetailAIntersections(data: CurveLocationDetailPair[], fractionTolerance: number = Geometry.smallAngleRadians): boolean {
    if (data.length === 0)
      return false;
    for (const pair of data) {
      if (pair.detailA.fraction > fractionTolerance || pair.detailA.fraction < 1 - fractionTolerance)
        return true;
    }
    return false;
  }
  private collectFragmentAndAdvanceCut(curveToCut: CurvePrimitive, cutA: CutFractionDescriptor, cutB: CutFractionDescriptor, dest: CurvePrimitive[]) {
    if (!cutA.isSameFraction(cutB)) {
      const fragment = curveToCut.clonePartialCurve(cutA.fraction, cutB.fraction);
      if (fragment !== undefined) {
        fragment.startCut = cutA.otherCurveDetail;
        fragment.endCut = cutB.otherCurveDetail;
        dest.push(fragment);
      }
    }
    cutA.setFrom(cutB, true);
  }
  /** Collect fragments from an intersections array, with the array detailA entries all referencing to curveToCut.
   * * The `intersections` array is sorted on its detailA field.
   */
  private collectSinglePrimitiveFragments(curveToCut: CurvePrimitive, intersections: CurveLocationDetailPair[] | undefined, fragments: CurvePrimitive[]) {

    if (intersections === undefined || !CurveSplitContext.hasInteriorDetailAIntersections(intersections)) {
      const fragment = curveToCut.clone();
      if (fragment)
        fragments.push(fragment as CurvePrimitive);
      return;
    }
    intersections.sort((pairA: CurveLocationDetailPair, pairB: CurveLocationDetailPair) => (pairA.detailA.fraction - pairB.detailA.fraction));
    const cutA = new CutFractionDescriptor(0.0, undefined);
    const cutB = new CutFractionDescriptor(1.0, undefined); // but those values are immediately reset before use.
    for (const pair of intersections) {
      cutB.set(pair.detailA.fraction, pair.detailB);
      this.collectFragmentAndAdvanceCut(curveToCut, cutA, cutB, fragments);
    }
    cutB.set(1.0, undefined);
    this.collectFragmentAndAdvanceCut(curveToCut, cutA, cutB, fragments);
  }
  public static cloneCurvesWithXYSplitFlags(curvesToCut: CurvePrimitive | CurveCollection | undefined, cutterCurves: CurveCollection): CurveCollection | CurvePrimitive | undefined {
    const context = new CurveSplitContext();
    if (curvesToCut instanceof CurvePrimitive) {
      const result: CurvePrimitive[] = [];
      const intersections = CurveCurve.intersectionXYPairs(curvesToCut, false, cutterCurves, false);
      context.collectSinglePrimitiveFragments(curvesToCut, intersections, result);
      if (result.length === 1)
        return result[0];
      return Path.createArray(result);

    } else if (curvesToCut instanceof CurveChain) {
      const result: CurvePrimitive[] = [];
      for (const primitive of curvesToCut.children) {
        const intersections = CurveCurve.intersectionXYPairs(primitive, false, cutterCurves, false);
        context.collectSinglePrimitiveFragments(primitive, intersections, result);
      }
      return Path.createArray(result);
    }
    return undefined;
  }
}
