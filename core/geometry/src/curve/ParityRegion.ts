/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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
 */
export class ParityRegion extends CurveCollection {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof ParityRegion; }
  protected _children: Loop[];
  public get children(): Loop[] { return this._children; }
  public constructor() { super(); this._children = []; }
  public static create(...data: Loop[]): ParityRegion {
    const result = new ParityRegion();
    for (const child of data) {
      result.children.push(child);
    }
    return result;
  }
  public dgnBoundaryType(): number { return 4; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceParityRegion(this, indexInParent);
  }
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
  public cloneEmptyPeer(): ParityRegion { return new ParityRegion(); }
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof Loop) {
      this._children.push(child);
      return true;
    }
    return false;
  }
  public getChild(i: number): Loop | undefined {
    if (i < this._children.length)
      return this._children[i];
    return undefined;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleParityRegion(this);
  }
}
