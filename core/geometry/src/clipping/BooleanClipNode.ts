/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Arc3d } from "../curve/Arc3d";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "../curve/CurvePrimitive";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range1d } from "../geometry3d/Range";
import { GrowableXYZArrayCache } from "../geometry3d/ReusableObjectCache";
import { Range1dArray } from "../numerics/Range1dArray";
import { Clipper, ClipStepAction, ClipUtilities, PolygonClipper } from "./ClipUtils";

/** BooleanClipNode is an abstract base class for boolean actions by an array of clippers.
 * * Derived class must implement
 *   * The single point test `isPointOnOrInsideChildren`
 *   * Boolean operation on 1d intervals `combineIntervals`
 * * The `keepInside` flag controls an additional optional flip of the boolean result.
 *   * if `keepInside === true`, accept the "inside" of the clip clippers
 *   * if `keepInside === false`, accept the "outside" of the child clippers.
 * * Hence the combinations of derived classes for (OR, AND, XOR) and keepInside are
 *   * (OR, true) = simple union (OR), i.e. "in" one or more clips
 *   * (OR, false) = complement of union (NOR), i.e. "outside" all clips
 *   * (AND, true) = simple intersection (AND), i.e. "in" all clips
 *   * (AND, false) = complement of intersection (NAND), i.e. "outside" one or more clips
 *   * (XOR,true) = simple parity, i.e. "in" an odd number of clips
 *   * (XOR,false) = complement of parity ), i.e. "in" an even number of clips
 * @internal
 */
export abstract class BooleanClipNode implements Clipper {
  protected _clippers: Clipper[];
  protected _intervalsA: Range1d[];
  protected _intervalsB: Range1d[];
  protected _keepInside: boolean;

  public constructor(keepInside: boolean) {
    this._keepInside = keepInside;
    this._clippers = [];
    this._intervalsA = [];
    this._intervalsB = [];
  }
  protected abstract isPointOnOrInsideChildren(point: Point3d): boolean;
  protected abstract combineIntervals(operandA: Range1d[], operandB: Range1d[]): Range1d[];
  public abstract get operationName(): string;
  public toJSON(): any {
    const data = [];
    for (const c of this._clippers) {
      const c1 = c as any;
      if (c1.toJSON)
        data.push(c1.toJSON());
    }
    // return this.formatJSON(data);
    const s = this.operationName;
    const json: { [opType: string]: any[] } = {};
    json[s] = data;
    return json;

  }
  /** Capture a (reference to a) child node or nodes */
  public captureChild(child: Clipper | Clipper[]) {
    if (Array.isArray(child)) {
      for (const c of child) this.captureChild(c);
    } else {
      this._clippers.push(child);
    }
  }
  /** toggle the "keepInside" behavior.  Return the prior value.  */
  public toggleResult(): boolean {
    return this.selectResult(!this._keepInside);
  }
  /** Set the "keepInside" behavior  */
  public selectResult(keepInside: boolean): boolean {
    const s = this._keepInside;
    this._keepInside = keepInside;
    return s;
  }

  /**
   * * Conditionally (if a1 > a0 strictly) call announce (a0, a1).
   * * Return 0 if not called, 1 if called.
   */
  protected testedAnnounceNN(a0: number, a1: number, announce?: AnnounceNumberNumber): number {
    if (a0 < a1) {
      if (announce)
        announce(a0, a1);
      return 1;
    }
    return 0;
  }
  /**
   * * Conditionally (if a1 > a0 strictly) call announce (a0, a1, cp).
   * * Return 0 if not called, 1 if called.
   */
  protected testedAnnounceNNC(a0: number, a1: number, cp: CurvePrimitive, announce?: AnnounceNumberNumberCurvePrimitive): number {
    if (a0 < a1) {
      if (announce)
        announce(a0, a1, cp);
      return 1;
    }
    return 0;
  }
  /** Swap the _intervalsA and _intervalsB */
  protected swapAB(): void {
    const q = this._intervalsA;
    this._intervalsA = this._intervalsB;
    this._intervalsB = q;
  }
  /**
   * * announce all "outside intervals" --not masked by intervals
   * * return true if any intervals announced.
   */
  protected announcePartsNN(keepInside: boolean, intervals: Range1d[], f0: number, f1: number, announce?: AnnounceNumberNumber): boolean {
    let numAnnounce = 0;
    if (!keepInside) {
      let lowFraction = f0;
      for (const interval of intervals) {
        numAnnounce += this.testedAnnounceNN(lowFraction, interval.low, announce);
        lowFraction = interval.high;
      }
      numAnnounce += this.testedAnnounceNN(lowFraction, f1, announce);
    } else {
      for (const interval of intervals) {
        // use f0..f1 ?
        numAnnounce += this.testedAnnounceNN(interval.low, interval.high, announce);
      }
    }
    return numAnnounce > 0;
  }
  /**
   * * announce all "outside intervals" --not masked by intervals
   * * return true if any intervals announced.
   */
  protected announcePartsNNC(keepInside: boolean, intervals: Range1d[], f0: number, f1: number, cp: CurvePrimitive, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    let numAnnounce = 0;
    if (!keepInside) {
      let lowFraction = f0;
      for (const interval of intervals) {
        numAnnounce += this.testedAnnounceNNC(lowFraction, interval.low, cp, announce);
        lowFraction = interval.high;
      }
      numAnnounce += this.testedAnnounceNNC(lowFraction, f1, cp, announce);
    } else {
      for (const interval of intervals) {
        // use f0..f1 ?
        numAnnounce += this.testedAnnounceNNC(interval.low, interval.high, cp, announce);
      }
    }
    return numAnnounce > 0;

  }
  /** Invoke callback to test if a point is "in" this clipper */
  public isPointOnOrInside(point: Point3d): boolean {
    const q = this.isPointOnOrInsideChildren(point);
    return this._keepInside ? q : !q;

  }

  /** Announce "in" portions of a line segment.  See `Clipper.announceClippedSegmentIntervals` */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean {
    this._intervalsA.length = 0;
    const announceIntervalB = (a0: number, a1: number) => {
      this._intervalsB.push(Range1d.createXX(a0, a1));
    };
    // Strategy:
    //  _intervalsA is the accumulated UNION of from clippers
    // _intervalsB is the current clipper.
    // announceIntervalB appends single new interval to _intervalB
    // at end, output gaps in _intervalsA
    //
    let i = 0;
    for (const c of this._clippers) {
      this._intervalsB.length = 0;
      c.announceClippedSegmentIntervals(f0, f1, pointA, pointB, announceIntervalB);
      Range1dArray.simplifySortUnion(this._intervalsB);
      if (i === 0) {
        this.swapAB();
      } else {
        this._intervalsA = this.combineIntervals(this._intervalsA, this._intervalsB);
      }
      i++;
    }
    return this.announcePartsNN(this._keepInside, this._intervalsA, f0, f1, announce);
  }
  /** Announce "in" portions of a line segment.  See `Clipper.announceClippedSegmentIntervals` */
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    this._intervalsA.length = 0;
    const announceIntervalB = (a0: number, a1: number) => {
      this._intervalsB.push(Range1d.createXX(a0, a1));
    };
    let i = 0;
    for (const c of this._clippers) {
      this._intervalsB.length = 0;
      c.announceClippedArcIntervals(arc, announceIntervalB);
      Range1dArray.simplifySortUnion(this._intervalsB);
      if (i === 0) {
        this.swapAB();
      } else {
        this._intervalsA = this.combineIntervals(this._intervalsA, this._intervalsB);
      }
      i++;
    }
    return this.announcePartsNNC(this._keepInside, this._intervalsA, 0, 1, arc, announce);
  }

}
/**
 * Implement [BooleanClipNode] virtual methods for intersection (boolean OR) among children
 * @internal
 */
export class BooleanClipNodeUnion extends BooleanClipNode {
  public get operationName(): string { return this._keepInside ? "OR" : "NOR"; }
  public constructor(keepInside: boolean) {
    super(keepInside);
  }
  /** return true if inside any child clipper */
  public isPointOnOrInsideChildren(point: Point3d): boolean {
    for (const clipper of this._clippers) {
      if (clipper.isPointOnOrInside(point))
        return true;
    }
    return false;
  }
  public combineIntervals(operandA: Range1d[], operandB: Range1d[]): Range1d[] {
    return Range1dArray.unionSorted(operandA, operandB);
  }
  public appendPolygonClip(
    xyz: GrowableXYZArray,
    insideFragments: GrowableXYZArray[],
    outsideFragments: GrowableXYZArray[],
    arrayCache: GrowableXYZArrayCache) {
    ClipUtilities.doPolygonClipSequence(xyz, this._clippers,
      this._keepInside ? insideFragments : outsideFragments,
      this._keepInside ? outsideFragments : insideFragments,
      undefined,
      ClipStepAction.acceptIn, ClipStepAction.passToNextStep, ClipStepAction.acceptOut, arrayCache);
    }
}

/**
 * Implement [BooleanClipNode] virtual methods for intersection (boolean OR) among children
 * @internal
 */
export class BooleanClipNodeParity extends BooleanClipNode {
  public get operationName(): string { return this._keepInside ? "XOR" : "NXOR"; }
  public constructor(keepInside: boolean) {
    super(keepInside);
  }
  /** return true if inside an odd number of clippers child clipper */
  public isPointOnOrInsideChildren(point: Point3d): boolean {
    let q = false;
    for (const clipper of this._clippers) {
      if (clipper.isPointOnOrInside(point))
        q = !q;
    }
    return q;
  }
  public combineIntervals(operandA: Range1d[], operandB: Range1d[]): Range1d[] {
    return Range1dArray.paritySorted(operandA, operandB);
  }
  public appendPolygonClip(
    xyz: GrowableXYZArray,
    insideFragments: GrowableXYZArray[],
    outsideFragments: GrowableXYZArray[],
    arrayCache: GrowableXYZArrayCache) {
    ClipUtilities.doPolygonClipParitySequence(xyz, this._clippers,
      this._keepInside ? insideFragments : outsideFragments,
      this._keepInside ? outsideFragments : insideFragments,
    arrayCache);
    }
}
/**
 * Implement [BooleanClipNode] virtual methods for intersection (boolean OR) among children
 * @internal
 */
export class BooleanClipNodeIntersection extends BooleanClipNode implements PolygonClipper{
  public get operationName(): string { return this._keepInside ? "AND" : "NAND"; }
  public constructor(keepInside: boolean) {
    super(keepInside);
  }
  /** return false if outside of any child clipper */
  public isPointOnOrInsideChildren(point: Point3d): boolean {
    for (const clipper of this._clippers) {
      if (!clipper.isPointOnOrInside(point))
        return false;
    }
    return true;
  }
  public combineIntervals(operandA: Range1d[], operandB: Range1d[]): Range1d[] {
    return Range1dArray.intersectSorted(operandA, operandB);
  }
  public appendPolygonClip(
    xyz: GrowableXYZArray,
    insideFragments: GrowableXYZArray[],
    outsideFragments: GrowableXYZArray[],
    arrayCache: GrowableXYZArrayCache) {

    ClipUtilities.doPolygonClipSequence(xyz, this._clippers,
      this._keepInside ? insideFragments : outsideFragments,
      this._keepInside ? outsideFragments : insideFragments,
      undefined,
      ClipStepAction.passToNextStep, ClipStepAction.acceptOut, ClipStepAction.acceptIn, arrayCache);
    }

}
