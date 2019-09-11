/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

import { Range2d } from "../../geometry3d/Range";
import { LowAndHighXY } from "../../geometry3d/XYZProps";

/**
 * * Searchable collection of 2d ranges.
 * * user data tag attached to each range via cast as (any).userTag.
 * * Implementation manages ranges privately.
 * *
 * @internal
 */
export class SearchableSetOfRange2d<T> {
  private _rangeArray: Range2d[];
  private _isDirty: boolean;
  public constructor() {
    this._rangeArray = [];
    this._isDirty = false;
  }
  // TODO: build search structure
  private updateForSearch() {

  }
  public addRange(range: LowAndHighXY, tag: T) {
    this._isDirty = true;
    const myRange = Range2d.createNull();
    (myRange as any).tag = tag;
    myRange.extendXY(range.low.x, range.low.y);
    myRange.extendXY(range.high.x, range.high.y);
    this._rangeArray.push(myRange);
  }
  /**
   * * Search for ranges containing testRange
   * * Pass each range and tag to handler
   * * terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.
   */
  public searchXY(x: number, y: number, handler: (range: Range2d, tag: T) => boolean): void {
    if (this._isDirty)
      this.updateForSearch();
    // NEEDS WORK: Linear search here -- do better!
    for (const candidate of this._rangeArray) {
      if (candidate.containsXY(x, y))
        if (!handler(candidate, (candidate as any).tag))
          return;
    }
  }
  /**
   * * Search for ranges overlapping testRange
   * * Pass each range and tag to handler
   * * terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.
   */
  public searchRange2d(testRange: LowAndHighXY, handler: (range: Range2d, tag: T) => boolean): void {
    if (this._isDirty)
      this.updateForSearch();
    for (const candidate of this._rangeArray) {
      if (candidate.intersectsRange(testRange))
        if (!handler(candidate, (candidate as any).tag))
          return;
    }
  }
}
