/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import {
  CurveCollection, CurvePrimitive, RecursiveCurveProcessorWithStack, LineSegment3d, LineString3d,
} from "../../curves";
/** Algorithmic class: Count LineSegment3d and LineString3d primitives.
 * @internal
 */
export class CountLinearPartsSearchContext extends RecursiveCurveProcessorWithStack {
  public numLineSegment: number;
  public numLineString: number;
  public numOther: number;
  constructor() {
    super();
    this.numLineSegment = 0;
    this.numLineString = 0;
    this.numOther = 0;
  }
  public static hasNonLinearPrimitives(target: CurveCollection): boolean {
    const context = new CountLinearPartsSearchContext();
    target.announceToCurveProcessor(context);
    return context.numOther > 0;
  }
  public override announceCurvePrimitive(curve: CurvePrimitive, _indexInParent: number): void {
    if (curve instanceof LineSegment3d)
      this.numLineSegment++;
    else if (curve instanceof LineString3d)
      this.numLineString++;
    else
      this.numOther++;
  }
}
