/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { StrokeOptions } from "./StrokeOptions";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { LineString3d } from "./LineString3d";
import { AnyCurve } from "./CurveChain";
import { CurveChain } from "./CurveCollection";

/**
 * * A `Path` object is a collection of curves that join head-to-tail to form a path.
 * * A `Path` object does not bound a planar region.
 */
export class Path extends CurveChain {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Path; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announcePath(this, indexInParent);
  }
  public constructor() { super(); }
  /**
   * Create a path from a variable length list of curve primtiives
   * @param curves variable length list of individual curve primitives
   */
  public static create(...curves: CurvePrimitive[]): Path {
    const result = new Path();
    for (const curve of curves) {
      result.children.push(curve);
    }
    return result;
  }
  /**
   * Create a path from a an array of curve primtiives
   * @param curves array of individual curve primitives
   */
  public static createArray(curves: CurvePrimitive[]): Path {
    const result = new Path();
    for (const curve of curves) {
      result.children.push(curve);
    }
    return result;
  }
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return Path.create(strokes);
  }
  public dgnBoundaryType(): number { return 1; }
  public cyclicCurvePrimitive(index: number): CurvePrimitive | undefined {
    if (index >= 0 && index < this.children.length)
      return this.children[index];
    return undefined;
  }
  public cloneEmptyPeer(): Path { return new Path(); }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handlePath(this);
  }
}
