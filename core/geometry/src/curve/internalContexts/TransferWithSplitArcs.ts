/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Arc3d } from "../Arc3d";
import { CurveCollection } from "../CurveCollection";
import { CurvePrimitive } from "../CurvePrimitive";
import { CloneCurvesContext } from "./CloneCurvesContext";

/**
 * Algorithmic class for shallow-copying a CurveCollection with each full-sweep arc replaced by two half-sweep arcs.
 * * Often useful for building graphs from loops.
 * @internal
 */
export class TransferWithSplitArcs extends CloneCurvesContext {
  public constructor() {
    super(undefined);
  }
  protected override doClone(primitive: CurvePrimitive): CurvePrimitive | CurvePrimitive[] {
    if (primitive instanceof Arc3d && primitive.sweep.isFullCircle) // replace full arc with two half arcs
      return [primitive.clonePartialCurve(0.0, 0.5), primitive.clonePartialCurve(0.5, 1)];
    return primitive;
  }
  public static override clone(target: CurveCollection): CurveCollection {
    const context = new TransferWithSplitArcs();
    target.announceToCurveProcessor(context);
    return context._result as CurveCollection;
  }
}