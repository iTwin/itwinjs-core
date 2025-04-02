/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { GeometryHandler } from "../geometry3d/GeometryHandler.js";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection.js";
import { Point3d } from "../geometry3d/Point3dVector3d.js";
import { CurveChainWithDistanceIndex } from "./CurveChainWithDistanceIndex.js";
import { CurveChain } from "./CurveCollection.js";
import { CurvePrimitive } from "./CurvePrimitive.js";
import { RecursiveCurveProcessor } from "./CurveProcessor.js";
import { GeometryQuery } from "./GeometryQuery.js";
import { LineString3d } from "./LineString3d.js";
import { StrokeOptions } from "./StrokeOptions.js";

/**
 * A `Loop` is a curve chain that is the boundary of a closed (planar) loop.
 * @see [Curve Collections]($docs/learning/geometry/CurveCollection.md) learning article.
 * @public
 */
export class Loop extends CurveChain {
  /** String name for schema properties */
  public readonly curveCollectionType = "loop";
  /** Tag value that can be set to true for user code to mark inner and outer loops. */
  public override isInner: boolean = false;
  /** Test if `other` is a `Loop` */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof Loop;
  }
  public constructor() {
    super();
  }
  /**
   * Create a loop from a variable length list of [[CurvePrimitive]]s.
   * * A significant gap between the end of one curve and the start of the next, or between chain start and end,
   * is not bridged and may cause unexpected behavior.
   * @param curves array of individual curve primitives, assumed to form a closed planar loop.
   */
  public static create(...curves: CurvePrimitive[]): Loop {
    const result = new Loop();
    for (const curve of curves) {
      if (curve instanceof CurveChainWithDistanceIndex)
        result.children.push(...curve.path.children);
      else
        result.children.push(curve);
    }
    return result;
  }
  /**
   * Create a loop from an array of [[CurvePrimitive]]s.
   * * A significant gap between the end of one curve and the start of the next, or between chain start and end,
   * is not bridged and may cause unexpected behavior.
   * @param curves array of individual curve primitives, assumed to form a closed planar loop.
   */
  public static createArray(curves: CurvePrimitive[]): Loop {
    return this.create(...curves);
  }
  /**
   * Create a loop from an array of coplanar points.
   * @param points vertices of polygon, closure point optional.
  */
  public static createPolygon(points: IndexedXYZCollection | Point3d[]): Loop {
    const linestring = LineString3d.create(points);
    linestring.addClosurePoint();
    return Loop.create(linestring);
  }
  /** Create a loop with the stroked form of this loop. */
  public cloneStroked(options?: StrokeOptions): Loop {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    // eliminate near-duplicate points between children
    strokes.removeDuplicatePoints();
    if (strokes.isPhysicallyClosed) {
      strokes.popPoint();
      strokes.addClosurePoint();
    }
    return Loop.create(strokes);
  }
  /** Return the boundary type (2) of a corresponding  MicroStation CurveVector */
  public dgnBoundaryType(): number {
    /**
     * All "Loop" become "outer". TypeScript Loop object is equivalent to a native CurveVector with
     * boundaryType = BOUNDARY_TYPE_Outer. In other words, TypeScript has no flavor of Loop that
     * carries "hole" semantics.
     */
    return 2;
  }
  /** Invoke `processor.announceLoop(this, indexInParent)` */
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceLoop(this, indexInParent);
  }
  /** Create a new `Loop` with no children */
  public cloneEmptyPeer(): Loop {
    return new Loop();
  }
  /** Second step of double dispatch:  call `handler.handleLoop(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLoop(this);
  }
}

/**
 * Structure carrying a pair of loops with curve geometry.
 * @public
 */
export class LoopCurveLoopCurve {
  /** First loop */
  public loopA?: Loop;
  /** A curve (typically an edge of loopA) */
  public curveA?: CurvePrimitive;
  /** second loop */
  public loopB?: Loop;
  /** A curve (typically an edge of loopB) */
  public curveB?: CurvePrimitive;
  /** Constructor */
  public constructor(
    loopA: Loop | undefined, curveA: CurvePrimitive | undefined, loopB: Loop | undefined, curveB: CurvePrimitive | undefined,
  ) {
    this.loopA = loopA;
    this.curveA = curveA;
    this.loopB = loopB;
    this.curveB = curveB;
  }
  /** Set the loopA and curveA members */
  public setA(loop: Loop, curve: CurvePrimitive) {
    this.loopA = loop;
    this.curveA = curve;
  }
  /** Set the loopB and curveB members */
  public setB(loop: Loop, curve: CurvePrimitive) {
    this.loopB = loop;
    this.curveB = curve;
  }
}

/**
 * Carrier object for loops characterized by area sign
 * @public
 */
export interface SignedLoops {
  /** Array of loops that have positive area sign (i.e. counterclockwise loops). */
  positiveAreaLoops: Loop[];
  /** Array of loops that have negative area sign (i.e. clockwise loops). */
  negativeAreaLoops: Loop[];
  /** Slivers where there are coincident sections of input curves. */
  slivers: Loop[];
  /** Array indicating edges between loops */
  edges?: LoopCurveLoopCurve[];
}
