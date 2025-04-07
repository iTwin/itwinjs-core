/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { CurveCollection } from "../CurveCollection.js";
import { CurvePrimitive } from "../CurvePrimitive.js";
import { LineSegment3d } from "../LineSegment3d.js";
import { LineString3d } from "../LineString3d.js";
import { CloneCurvesContext } from "./CloneCurvesContext.js";

/**
 * Algorithmic class for cloning with linestrings expanded to line segments
 * @internal
 */
export class CloneWithExpandedLineStrings extends CloneCurvesContext {
  public constructor() {
    // we have no transform ....
    super(undefined);
  }
  // We know we have no transform !!!
  protected override doClone(primitive: CurvePrimitive): CurvePrimitive | CurvePrimitive[] {
    if (primitive instanceof LineString3d && primitive.numPoints() > 1) {
      const packedPoints = primitive.packedPoints;
      const n = packedPoints.length;
      const segments = [];
      for (let i = 0; i + 1 < n; i++) {
        segments.push(LineSegment3d.createCapture(packedPoints.getPoint3dAtUncheckedPointIndex(i), packedPoints.getPoint3dAtUncheckedPointIndex(i + 1)));
      }
      return segments;
    }
    return primitive.clone();
  }
  public static override clone(target: CurveCollection): CurveCollection {
    const context = new CloneWithExpandedLineStrings();
    target.announceToCurveProcessor(context);
    return context._result as CurveCollection;
  }
}
