/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Range2d } from "../../geometry3d/Range";
import { LowAndHighXY } from "../../geometry3d/XYZProps";
import { Range2dSearchInterface } from "./Range2dSearchInterface";

/**
 * * Array of Range2d
 * * user data tag attached to each range via cast as (any).userTag.
 * * Search operations are simple linear.
 * * This class can be used directly for "smallish" range sets, or as the leaf level of hierarchical structures for larger range sets.
 * *
 * @internal
 */
export class LinearSearchRange2dArray<T> implements Range2dSearchInterface<T> {
  private _rangeArray: Range2d[];
  private _isDirty: boolean;
  private _compositeRange: Range2d;
  public constructor() {
    this._rangeArray = [];
    this._isDirty = false;
    this._compositeRange = Range2d.createNull();
  }
  // TODO: build search structure
  private updateForSearch() {
    this._isDirty = false;
  }
  /** Return the overall range of all member ranges. */
  public totalRange(result?: Range2d): Range2d {
    result = result ? result : Range2d.createNull();
    return this._compositeRange.clone(result);
  }
  /** Add a range to the search set. */
  public addRange(range: LowAndHighXY, tag: T) {
    this._isDirty = true;
    const myRange = Range2d.createNull();
    (myRange as any).tag = tag;
    myRange.extendXY(range.low.x, range.low.y);
    myRange.extendXY(range.high.x, range.high.y);
    this._compositeRange.extendRange(myRange);
    this._rangeArray.push(myRange);
  }
  /**
   * * Search for ranges containing testRange
   * * Pass each range and tag to handler
   * * terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.
   * @return false if search terminated by handler.  Return true if no handler returned false.
   */
  public searchXY(x: number, y: number, handler: (range: Range2d, tag: T) => boolean): boolean {
    if (this._isDirty)
      this.updateForSearch();
    // NEEDS WORK: Linear search here -- do better!
    for (const candidate of this._rangeArray) {
      if (candidate.containsXY(x, y))
        if (!handler(candidate, (candidate as any).tag))
          return false;
    }
    return true;
  }
  /**
   * * Search for ranges overlapping testRange
   * * Pass each range and tag to handler
   * * terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.
   * @return false if search terminated by handler.  Return true if no handler returned false.
   */
  public searchRange2d(testRange: LowAndHighXY, handler: (range: Range2d, tag: T) => boolean): boolean {
    if (this._isDirty)
      this.updateForSearch();
    for (const candidate of this._rangeArray) {
      if (candidate.intersectsRange(testRange))
        if (!handler(candidate, (candidate as any).tag))
          return false;
    }
    return true;
  }
}
