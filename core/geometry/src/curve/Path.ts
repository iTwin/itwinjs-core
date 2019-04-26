/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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
import { Geometry } from "../Geometry";
import { Point3d } from "../geometry3d/Point3dVector3d";

/**
 * * A `Path` object is a collection of curves that join head-to-tail to form a path.
 * * A `Path` object does not bound a planar region.  Use `Loop` to indicate region bounding.
 * @public
 */
export class Path extends CurveChain {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Path; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announcePath(this, indexInParent);
  }
  public constructor() { super(); }
  /**
   * Create a path from a variable length list of curve primtiives
   * * CurvePrimitive params are captured !!!
   * @param curves variable length list of individual curve primitives or point arrays.
   */
  public static create(...curves: Array<CurvePrimitive | Point3d[]>): Path {
    const result = new Path();
    for (const curve of curves) {
      if (curve instanceof CurvePrimitive)
        result.children.push(curve);
      else if (Array.isArray(curve) && curve.length > 0 && curve[0] instanceof Point3d) {
        result.children.push(LineString3d.create(curve));
      }
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
  /** Return the boundary type (1) of a corresponding  Microstation CurveVector */
  public dgnBoundaryType(): number { return 1; }
  /**
   * Return the `[index]` curve primitive, using `modulo` to map`index` to the cyclic indexing.
   * * In particular, `-1` is the final curve.
   * @param index cyclid index
   */
  public cyclicCurvePrimitive(index: number): CurvePrimitive | undefined {
    const n = this.children.length;
    if (n === 0)
      return undefined;

    const index2 = Geometry.modulo(index, n);
    return this.children[index2];
  }
  public cloneEmptyPeer(): Path { return new Path(); }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handlePath(this);
  }
}
