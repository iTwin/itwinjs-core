/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { CurveChainWithDistanceIndex } from "./CurveChainWithDistanceIndex";
import { CurveChain } from "./CurveCollection";
import { CurveExtendMode, CurveExtendOptions, VariantCurveExtendParameter } from "./CurveExtendMode";
import { CurveLocationDetail } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { GeometryQuery } from "./GeometryQuery";
import { LineString3d } from "./LineString3d";
import { StrokeOptions } from "./StrokeOptions";

/**
 * * A `Path` object is a collection of curves that join head-to-tail to form a path.
 * * A `Path` object does not bound a planar region. Use `Loop` to indicate region bounding.
 * @see [Curve Collections]($docs/learning/geometry/CurveCollection.md) learning article.
 * @public
 */
export class Path extends CurveChain {
  /** String name for schema properties */
  public readonly curveCollectionType = "path";
  /** Test if `other` is an instance of `Path` */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof Path;
  }
  /** Invoke `processor.announcePath(this, indexInParent)` */
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announcePath(this, indexInParent);
  }
  /** Construct an empty path. */
  public constructor() {
    super();
  }
  /**
   * Create a path from a variable length list of curve primitives
   * * CurvePrimitive params are captured.
   * @param curves variable length list of individual curve primitives or point arrays.
   */
  public static create(...curves: Array<CurvePrimitive | Point3d[]>): Path {
    const result = new Path();
    for (const curve of curves) {
      if (curve instanceof CurveChainWithDistanceIndex)
        result.children.push(...curve.path.children);
      else if (curve instanceof CurvePrimitive)
        result.children.push(curve);
      else if (Array.isArray(curve) && curve.length > 0 && curve[0] instanceof Point3d) {
        result.children.push(LineString3d.create(curve));
      }
    }
    return result;
  }
  /**
   * Create a path from a an array of curve primitives.
   * @param curves array of individual curve primitives.
   */
  public static createArray(curves: CurvePrimitive[]): Path {
    return this.create(...curves);
  }
  /** Return a deep copy, with leaf-level curve primitives stroked. */
  public cloneStroked(options?: StrokeOptions): Path {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return Path.create(strokes);
  }
  /**
   * Return the closest point on the contained curves.
   * @param spacePoint point in space.
   * @param extend the extend parameter.
   * @returns a `CurveLocationDetail` structure that holds the details of the close point.
   */
  public override closestPoint(spacePoint: Point3d, extend: VariantCurveExtendParameter): CurveLocationDetail | undefined {
    let detailA: CurveLocationDetail | undefined;
    if (this.children !== undefined) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        let childExtend: VariantCurveExtendParameter = extend;
        if (i === 0) { // head only extends from start
          if (extend === false)
            childExtend = false;
          else if (extend === true)
            childExtend = [CurveExtendMode.OnCurve, CurveExtendMode.None];
          else {
            const mode0 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 0);
            childExtend = [mode0, CurveExtendMode.None];
          }
        } else if (i === this.children.length - 1) { // tail only extends from end
          if (extend === false)
            childExtend = false;
          else if (extend === true)
            childExtend = [CurveExtendMode.None, CurveExtendMode.OnCurve];
          else if (Array.isArray(extend)) {
            const mode1 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 1);
            childExtend = [CurveExtendMode.None, mode1];
          } else {
            childExtend = [CurveExtendMode.None, extend];
          }
        } else { // middle children do not extend
          childExtend = false;
        }
        const detailB = child.closestPoint(spacePoint, childExtend);
        detailA = CurveLocationDetail.chooseSmallerA(detailA, detailB);
      }
    }
    return detailA;
  }
  /** Return the boundary type (1) of a corresponding MicroStation CurveVector */
  public dgnBoundaryType(): number {
    return 1;
  }
  /** Clone as a new `Path` with no primitives */
  public cloneEmptyPeer(): Path {
    return new Path();
  }
  /** Second step of double dispatch: call `handler.handlePath(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handlePath(this);
  }
}
