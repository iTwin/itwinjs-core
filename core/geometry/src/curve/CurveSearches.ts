/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { CurvePrimitive } from "./CurvePrimitive";
import { Transform } from "../Transform";
import { RecursiveCurveProcessor, RecursiveCurveProcessorWithStack } from "./CurveProcessor";
import {CurveCollection, CurveChain, BagOfCurves} from "./CurveChain";
import { LineString3d } from "./LineString3d";
import { LineSegment3d } from "./LineSegment3d";

/** Algorithmic class: Accumulate maximum gap between adjacent primitives of CurveChain.
 */
export class GapSearchContext extends RecursiveCurveProcessorWithStack {
  public maxGap: number;
  constructor() { super(); this.maxGap = 0.0; }
  public static maxGap(target: CurveCollection): number {
    const context = new GapSearchContext();
    target.announceToCurveProcessor(context);
    return context.maxGap;
  }
  public announceCurvePrimitive(curve: CurvePrimitive, _indexInParent: number): void {
    if (this.stack.length > 0) {
      const parent = this.stack[this.stack.length - 1];
      if (parent instanceof CurveChain) {
        const chain = parent as CurveChain;
        const nextCurve = chain.cyclicCurvePrimitive(_indexInParent + 1);
        if (curve !== undefined && nextCurve !== undefined) {
          this.maxGap = Math.max(this.maxGap, curve.endPoint().distance(nextCurve.startPoint()));
        }
      }
    }
  }
}

/** Algorithmic class: Count LineSegment3d and LineString3d primitives.
 */
export class CountLinearPartsSearchContext extends RecursiveCurveProcessorWithStack {
  public numLineSegment: number;
  public numLineString: number;
  public numOther: number;
  constructor() {
    super();
    this.numLineSegment = 0;
    this.numLineString = 0;
    this.numOther = 0;
  }
  public static hasNonLinearPrimitives(target: CurveCollection): boolean {
    const context = new CountLinearPartsSearchContext();
    target.announceToCurveProcessor(context);
    return context.numOther > 0;
  }
  public announceCurvePrimitive(curve: CurvePrimitive, _indexInParent: number): void {
    if (curve instanceof LineSegment3d)
      this.numLineSegment++;
    else if (curve instanceof LineString3d)
      this.numLineString++;
    else
      this.numOther++;
  }
}

/** Algorithmic class: Transform curves in place.
 */
export class TransformInPlaceContext extends RecursiveCurveProcessor {
  public numFail: number;
  public numOK: number;
  public transform: Transform;
  constructor(transform: Transform) { super(); this.numFail = 0; this.numOK = 0; this.transform = transform; }
  public static tryTransformInPlace(target: CurveCollection, transform: Transform): boolean {
    const context = new TransformInPlaceContext(transform);
    target.announceToCurveProcessor(context);
    return context.numFail === 0;
  }
  public announceCurvePrimitive(curvePrimitive: CurvePrimitive, _indexInParent: number): void {
    if (!curvePrimitive.tryTransformInPlace(this.transform))
      this.numFail++;
    else
      this.numOK++;
  }
}
/** Algorithmic class: Sum lengths of curves */
export class SumLengthsContext extends RecursiveCurveProcessor {
  private sum: number;
  private constructor() { super(); this.sum = 0.0; }
  public static sumLengths(target: CurveCollection): number {
    const context = new SumLengthsContext();
    target.announceToCurveProcessor(context);
    return context.sum;
  }
  public announceCurvePrimitive(curvePrimitive: CurvePrimitive, _indexInParent: number): void {
    this.sum += curvePrimitive.curveLength();
  }
}
/**
 * Algorithmic class for cloning curve collections.
 * * recurse through collection nodes, building image nodes as needed and inserting clones of children.
 * * for individual primitive, invoke doClone (protected) for direct clone; insert into parent
 */
export class CloneCurvesContext extends RecursiveCurveProcessorWithStack {
  private result: CurveCollection | undefined;
  private transform: Transform | undefined;
  private constructor(transform?: Transform) {
    super();
    this.transform = transform;
    this.result = undefined;
  }
  public static clone(target: CurveCollection, transform?: Transform): CurveCollection | undefined {
    const context = new CloneCurvesContext(transform);
    target.announceToCurveProcessor(context);
    return context.result;
  }
  public enter(c: CurveCollection) {
    if (c instanceof CurveCollection)
      super.enter(c.cloneEmptyPeer());
  }
  public leave(): CurveCollection | undefined {
    const result = super.leave();
    if (result) {
      if (this.stack.length === 0) // this should only happen once !!!
        this.result = result as BagOfCurves;
      else // push this result to top of stack.
        this.stack[this.stack.length - 1].tryAddChild(result);
    }
    return result;
  }
  // specialized cloners override this (and allow announceCurvePrimitive to insert to parent)
  protected doClone(primitive: CurvePrimitive): CurvePrimitive {
    if (this.transform)
      return primitive.cloneTransformed(this.transform) as CurvePrimitive;
    return primitive.clone() as CurvePrimitive;
  }

  public announceCurvePrimitive(primitive: CurvePrimitive, _indexInParent: number): void {
    const c = this.doClone(primitive);
    if (c && this.stack.length > 0) {
      const parent = this.stack[this.stack.length - 1];
      if (parent instanceof CurveChain) {
        parent.tryAddChild(c);
      } else if (parent instanceof BagOfCurves) {
        parent.tryAddChild(c);
      }
    }
  }
}
