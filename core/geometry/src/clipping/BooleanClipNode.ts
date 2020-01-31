/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range1d } from "../geometry3d/Range";
import { Arc3d } from "../curve/Arc3d";
import { Clipper } from "./ClipUtils";
import { AnnounceNumberNumberCurvePrimitive, AnnounceNumberNumber, CurvePrimitive } from "../curve/CurvePrimitive";
import { Range1dArray } from "../numerics/Range1dArray";

type ClipNodeSortedRange1dBoolean = (operandA: Range1d[], operandB: Range1d[]) => Range1d[];
type ClipNodePointBoolean = (point: Point3d, clippers: Clipper[]) => boolean;

/** BooleanClipNode carries an array of `Clipper` objects and function pointers to implement `Clipper` methods
 * * This is class is the implementor for the (static) methods in `BooleanClipFactory`
 * * These function pointers are usually (always?) chosen from the statics in offered by this class:
 * * The pointer to implement `isPointOnOrInside` is one of
 *   * isPointOnOrInsideOR implements union over children
 *   * isPointOnOrInsideAND implements intersection over children
 *   * isPointOnOrInsideXOR implements exclusive OR (i.e. parity)
 * * The pointer to a `combiner` function is usually (always) one of the corresponding Range1dArray static functions
 *    * Range1dArray.unionSorted
 *    * Range1dArray.intersectSorted
 *    * Range1dArray.paritySorted
 * * The `keepInside` flag controls an additional optional flip of the boolean result.
 *   * if `keepInside === true`, accept the "inside" of the clip clippers
 *   * if `keepInside === false`, accept the "outside" of the child clippers.
 * * Hence the combinations of (OR, AND, XOR) and keepInside are
 *   * (OR, true) = simple union (OR), i.e. "in" one or more clips
 *   * (OR, false) = complement of union (NOR), i.e. "outside" all clips
 *   * (AND, true) = simple intersection (AND), i.e. "in" all clips
 *   * (AND, false) = complement of intersection (NAND), i.e. "outside" one or more clips
 *   * (XOR,true) = simple parity, i.e. "in" an odd number of clips
 *   * (XOR,false) = complement of parity ), i.e. "in" an even number of clips
 * @internal
 */
export class BooleanClipNode implements Clipper {
  protected _clippers: Clipper[];
  protected _intervalsA: Range1d[];
  protected _intervalsB: Range1d[];
  private _keepInside: boolean;
  private _combiner: ClipNodeSortedRange1dBoolean;
  private _isPointOnOrInside: ClipNodePointBoolean;
  public constructor(isPointOnOrInside: ClipNodePointBoolean, combiner: ClipNodeSortedRange1dBoolean, keepInside: boolean) {
    this._keepInside = keepInside;
    this._combiner = combiner;
    this._isPointOnOrInside = isPointOnOrInside;
    this._clippers = [];
    this._intervalsA = [];
    this._intervalsB = [];
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
  /** Function pointer for "OR" (union) */
  public static isPointOnOrInsideOR(point: Point3d, clippers: Clipper[]): boolean {
    for (const clipper of clippers) {
      if (clipper.isPointOnOrInside(point))
        return true;
    }
    return false;
  }
  /** Function pointer for "AND" (intersection) */
  public static isPointOnOrInsideAND(point: Point3d, clippers: Clipper[]): boolean {
    for (const clipper of clippers) {
      if (!clipper.isPointOnOrInside(point))
        return false;
    }
    return true;
  }
  /** Function pointer for "XOR" (parity) */
  public static isPointOnOrInsideXOR(point: Point3d, clippers: Clipper[]): boolean {
    let q = false;
    for (const clipper of clippers) {
      if (clipper.isPointOnOrInside(point))
        q = !q;
    }
    return q;
  }
  /** test if a point is "in" this clipper, i.e. outside all of its children. */
  public isPointOnOrInside(point: Point3d): boolean {
    const q = this._isPointOnOrInside(point, this._clippers);
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
        this._intervalsA = this._combiner(this._intervalsA, this._intervalsB);
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
        this._intervalsA = this._combiner(this._intervalsA, this._intervalsB);
      }
      i++;
    }
    return this.announcePartsNNC(this._keepInside, this._intervalsA, 0, 1, arc, announce);
  }

}
