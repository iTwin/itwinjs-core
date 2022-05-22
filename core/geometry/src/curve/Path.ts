/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { AnyCurve } from "./CurveChain";
import { CurveChain } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { GeometryQuery } from "./GeometryQuery";
import { LineString3d } from "./LineString3d";
import { StrokeOptions } from "./StrokeOptions";

/**
 * * A `Path` object is a collection of curves that join head-to-tail to form a path.
 * * A `Path` object does not bound a planar region.  Use `Loop` to indicate region bounding.
 * @see [Curve Collections]($docs/learning/geometry/CurveCollection.md) learning article.
 * @public
 */
export class Path extends CurveChain {
  /** String name for schema properties */
  public readonly curveCollectionType = "path";

  /** Test if `other` is an instance of `Path` */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Path; }
  /** invoke `processor.announcePath(this, indexInParent)` */
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announcePath(this, indexInParent);
  }
  /** Construct an empty path. */
  public constructor() { super(); }
  /**
   * Create a path from a variable length list of curve primitives
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
   * Create a path from a an array of curve primitives
   * @param curves array of individual curve primitives
   */
  public static createArray(curves: CurvePrimitive[]): Path {
    const result = new Path();
    for (const curve of curves) {
      result.children.push(curve);
    }
    return result;
  }
  /** Return a deep copy, with leaf-level curve primitives stroked. */
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return Path.create(strokes);
  }
  /** Return the boundary type (1) of a corresponding  MicroStation CurveVector */
  public dgnBoundaryType(): number { return 1; }
  /** Clone as a new `Path` with no primitives */
  public cloneEmptyPeer(): Path { return new Path(); }
  /** Second step of double dispatch:  call `handler.handlePath(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handlePath(this);
  }
}
