/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { RecursiveCurveProcessor } from "../CurveProcessor";
import { CurvePrimitive } from "../CurvePrimitive";
import { CurveCollection } from "../CurveCollection";
/**
 * Algorithmic class: Sum lengths of curves
 * @internal
 */
export class SumLengthsContext extends RecursiveCurveProcessor {
  private _sum: number;
  private constructor() { super(); this._sum = 0.0; }
  public static sumLengths(target: CurveCollection): number {
    const context = new SumLengthsContext();
    target.announceToCurveProcessor(context);
    return context._sum;
  }
  public announceCurvePrimitive(curvePrimitive: CurvePrimitive, _indexInParent: number): void {
    this._sum += curvePrimitive.curveLength();
  }
}
