/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Curve */
import { CurvePrimitive } from "./CurvePrimitive";
import { Path, Loop, ParityRegion, UnionRegion, AnyCurve, BagOfCurves, CurveCollection } from "./CurveChain";
/* tslint:disable:variable-name no-empty*/

/** base class for detailed traversal of curve artifacts.  This recurses to children in the quickest way (no records of path)
 * Use the RecursiveCurveProcessorWithStack to record the path along the visit.
 */
export abstract class RecursiveCurveProcessor {
  protected constructor() {
  }

  /** process error content */
  public announceUnexpected(_data: AnyCurve, _indexInParent: number) { }
  /** process a leaf primitive. */
  public announceCurvePrimitive(_data: CurvePrimitive, _indexInParent = -1): void { }

  /** announce a path (recurse to children) */
  public announcePath(data: Path, _indexInParent: number = -1): void {
    let i = 0;
    for (const curve of data.children)
      this.announceCurvePrimitive(curve, i++);
  }
  /** announce a loop (recurse to children) */
  public announceLoop(data: Loop, _indexInParent: number = -1): void {
    let i = 0;
    for (const curve of data.children)
      this.announceCurvePrimitive(curve, i++);
  }

  /** annouce beginning or end of loops in a parity region */
  public announceParityRegion(data: ParityRegion, _indexInParent: number = -1): void {
    let i = 0;
    for (const loop of data.children)
      this.announceLoop(loop, i++);
  }
  /** annouce beginning or end of a parity region */
  public announceUnionRegion(data: UnionRegion, _indexInParent: number = -1): void {
    let i = 0;
    for (const child of data.children) {
      child.announceToCurveProcessor(this, i++);
    }
  }

  public announceBagOfCurves(data: BagOfCurves, _indexInParent: number = -1): void {
    for (const child of data.children) {
      if (child instanceof CurvePrimitive)
        this.announceCurvePrimitive(child);
      else
        child.announceToCurveProcessor(this);
    }
  }
}

/** base class for detailed traversal of curve artifacts, maintaining a stack that shows complete path to each artifact.
 * Use the QuickRecursiveCurveProcessor to visit without recording the path.
 */
export abstract class RecursiveCurveProcessorWithStack extends RecursiveCurveProcessor {
  // NOTE: parameter names begin with underbar to suppress "unused var" errors
  protected stack: CurveCollection[];
  protected constructor() {
    super();
    this.stack = [];
  }
  public enter(data: CurveCollection) { this.stack.push(data); }
  public leave(): CurveCollection | undefined { return this.stack.pop(); }

  /** process error content */
  public announceUnexpected(_data: AnyCurve, _indexInParent: number) { }
  /** process a leaf primitive. */
  public announceCurvePrimitive(_data: CurvePrimitive, _indexInParent = -1): void { }

  /** announce a path (recurse to children) */
  public announcePath(data: Path, indexInParent: number = -1): void {
    this.enter(data);
    super.announcePath(data, indexInParent);
    this.leave();
  }
  /** announce a loop (recurse to children) */
  public announceLoop(data: Loop, indexInParent: number = -1): void {
    this.enter(data);
    super.announceLoop(data, indexInParent);
    this.leave();
  }

  /** annouce beginning or end of loops in a parity region */
  public announceParityRegion(data: ParityRegion, _indexInParent: number = -1): void {
    this.enter(data);
    let i = 0;
    for (const loop of data.children)
      this.announceLoop(loop, i++);
    this.leave();
  }
  /** annouce beginning or end of a parity region */
  public announceUnionRegion(data: UnionRegion, indexInParent: number = -1): void {
    this.enter(data);
    super.announceUnionRegion(data, indexInParent);
    this.leave();
  }

  public announceBagOfCurves(data: BagOfCurves, _indexInParent: number = -1): void {
    this.enter(data);
    let i = 0;
    for (const child of data.children) {
      if (child instanceof CurvePrimitive)
        this.announceCurvePrimitive(child, i++);
      else
        child.announceToCurveProcessor(this);
    }
    this.leave();
  }
}
