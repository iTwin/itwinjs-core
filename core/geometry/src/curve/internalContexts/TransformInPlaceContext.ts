/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { assert } from "@itwin/core-bentley";
import { Transform } from "../../geometry3d/Transform";
import { CurveCollection } from "../CurveCollection";
import { CurvePrimitive } from "../CurvePrimitive";
import { RecursiveCurveProcessor } from "../CurveProcessor";

/** Algorithmic class: Transform curves in place. Always expected to succeed.
 * @internal
 */
export class TransformInPlaceContext extends RecursiveCurveProcessor {
  public transform: Transform;
  constructor(transform: Transform) {
    super();
    this.transform = transform;
  }
  public static tryTransformInPlace(target: CurveCollection, transform: Transform): boolean {
    const context = new TransformInPlaceContext(transform);
    target.announceToCurveProcessor(context);
    return true;
  }
  public override announceCurvePrimitive(curvePrimitive: CurvePrimitive, _indexInParent: number): void {
    if (!curvePrimitive.tryTransformInPlace(this.transform))
      assert(false, "TransformInPlaceContext: unexpected failure of tryTransformInPlace");
  }
}
