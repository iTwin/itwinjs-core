/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { StrokeOptions } from "./StrokeOptions";
import { GeometryQuery } from "./GeometryQuery";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { CurveCollection } from "./CurveCollection";
import { Loop } from "./Loop";
import { AnyCurve } from "./CurveChain";
/**
 * * A `ParityRegion` is a collection of `Loop` objects.
 * * The loops collectively define a planar region.
 * * A point is "in" the composite region if it is "in" an odd number of the loops.
 * @public
 */
export class ParityRegion extends CurveCollection {
  /** Test if `other` is an instance of `ParityRegion` */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof ParityRegion; }
  /** Array of loops in this parity region. */
  protected _children: Loop[];
  /** Return the array of loops in this parity region. */
  public get children(): Loop[] { return this._children; }
  /** Construct parity region with empty loop array */
  public constructor() { super(); this._children = []; }
  /** Create a parity region with given loops */
  public static create(...data: Loop[]): ParityRegion {
    const result = new ParityRegion();
    for (const child of data) {
      result.children.push(child);
    }
    return result;
  }
  /** Return the boundary type (4) of a corresponding  Microstation CurveVector */
  public dgnBoundaryType(): number { return 4; }
  /** invoke `processor.announceParityRegion(this, indexInParent)` */
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceParityRegion(this, indexInParent);
  }
  /** Return a deep copy. */
  public clone(): ParityRegion {
    const clone = new ParityRegion();
    let child;
    for (child of this.children) {
      const childClone = child.clone();
      if (childClone instanceof Loop)
        clone.children.push(childClone);
    }
    return clone;
  }
  /** Stroke these curves into a new ParityRegion. */
  public cloneStroked(options?: StrokeOptions): ParityRegion {
    const clone = new ParityRegion();
    let child;
    for (child of this.children) {
      const childStrokes = child.cloneStroked(options) as Loop;
      if (childStrokes)
        clone.children.push(childStrokes);
    }
    return clone;
  }
  /** Create a new empty parity region. */
  public cloneEmptyPeer(): ParityRegion { return new ParityRegion(); }
  /** Add `child` to this parity region.
   * * any child type other than `Loop` is ignored.
   */
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof Loop) {
      this._children.push(child);
      return true;
    }
    return false;
  }
  /** Get child `i` by index. */
  public getChild(i: number): Loop | undefined {
    if (i < this._children.length)
      return this._children[i];
    return undefined;
  }
  /** Second step of double dispatch:  call `handler.handleRegion(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleParityRegion(this);
  }
}
