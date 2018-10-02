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
import { ParityRegion } from "./ParityRegion";
import { AnyCurve } from "./CurveChain";
/**
 * * A `UnionRegion` is a collection of other planar region types -- `Loop` and `ParityRegion`.
 * * The composite is the union of the contained regions.
 * * A point is "in" the composite if it is "in" one or more of the contained regions.
 */
export class UnionRegion extends CurveCollection {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof UnionRegion; }
  protected _children: Array<ParityRegion | Loop>;
  public get children(): Array<ParityRegion | Loop> { return this._children; }
  public constructor() { super(); this._children = []; }
  public static create(...data: Array<ParityRegion | Loop>): UnionRegion {
    const result = new UnionRegion();
    for (const child of data) {
      result.tryAddChild(child);
    }
    return result;
  }
  public dgnBoundaryType(): number { return 5; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceUnionRegion(this, indexInParent);
  }
  public cloneStroked(options?: StrokeOptions): UnionRegion {
    const clone = new UnionRegion();
    let child;
    for (child of this._children) {
      const childStrokes = child.cloneStroked(options) as ParityRegion | Loop;
      if (childStrokes)
        clone.children.push(childStrokes);
    }
    return clone;
  }
  public cloneEmptyPeer(): UnionRegion { return new UnionRegion(); }
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof ParityRegion || child instanceof Loop) {
      this._children.push(child);
      return true;
    }
    return false;
  }
  public getChild(i: number): Loop | ParityRegion | undefined {
    if (i < this._children.length)
      return this._children[i];
    return undefined;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleUnionRegion(this);
  }
}
