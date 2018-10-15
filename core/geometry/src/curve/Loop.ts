/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */
import { Geometry } from "../Geometry";
import { StrokeOptions } from "./StrokeOptions";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { LineString3d } from "./LineString3d";
import { CurveChain } from "./CurveCollection";
import { AnyCurve } from "./CurveChain";

/**
 * A `Loop` is a curve chain that is the boundary of a closed (planar) loop.
 */
export class Loop extends CurveChain {
  public isInner: boolean = false;
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Loop; }
  public constructor() { super(); }
  /**
   * Create a loop from variable length list of CurvePrimtives
   * @param curves array of individual curve primitives
   */
  public static create(...curves: CurvePrimitive[]): Loop {
    const result = new Loop();
    for (const curve of curves) {
      result.children.push(curve);
    }
    return result;
  }
  /**
   * Create a loop from an array of curve primtiives
   * @param curves array of individual curve primitives
   */
  public static createArray(curves: CurvePrimitive[]): Loop {
    const result = new Loop();
    for (const curve of curves) {
      result.children.push(curve);
    }
    return result;
  }
  public static createPolygon(points: Point3d[]): Loop {
    const linestring = LineString3d.create(points);
    linestring.addClosurePoint();
    return Loop.create(linestring);
  }
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return Loop.create(strokes);
  }
  public dgnBoundaryType(): number { return 2; } // (2) all "Loop" become "outer"
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceLoop(this, indexInParent);
  }
  public cyclicCurvePrimitive(index: number): CurvePrimitive | undefined {
    const n = this.children.length;
    if (n >= 1) {
      index = Geometry.modulo(index, this.children.length);
      return this.children[index];
    }
    return undefined;
  }
  public cloneEmptyPeer(): Loop { return new Loop(); }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLoop(this);
  }
}
