/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Range2d, Range3d } from "../../geometry3d/Range";
import { LowAndHighXY } from "../../geometry3d/XYZProps";
import { GriddedRaggedRange2dSet } from "./GriddedRaggedRange2dSet";
import { LinearSearchRange2dArray } from "./LinearSearchRange2dArray";

/**
 * Use GriddedRaggedRange2dSetWithOverflow for searching among many ranges for which
 * * Most ranges are of somewhat consistent size.
 * * A modest number of oversizes.
 * * Maintain the smallish ones in a GriddedRaggedRange2dSet.
 * * Maintain the overflows in a LinearSearchRange2dArray
 * @internal
 */
export class GriddedRaggedRange2dSetWithOverflow<T> {
  private _gridSet: GriddedRaggedRange2dSet<T>;
  private _overflowSet: LinearSearchRange2dArray<T>;
  private constructor(gridSet: GriddedRaggedRange2dSet<T>, overflowSet: LinearSearchRange2dArray<T>) {
    this._gridSet = gridSet;
    this._overflowSet = overflowSet;
  }
  /**
   * Create an (empty) set of ranges.
   * @param range
   * @param numXEdge
   * @param numYEdge
   */
  public static create<T>(range: Range2d, numXEdge: number, numYEdge: number): GriddedRaggedRange2dSetWithOverflow<T> | undefined {
    const grids = GriddedRaggedRange2dSet.create<T>(range.clone(), numXEdge, numYEdge);
    if (grids)
      return new GriddedRaggedRange2dSetWithOverflow<T>(grids, new LinearSearchRange2dArray<T>());
    return undefined;
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
    return this._gridSet.searchXY(x, y, handler) && this._overflowSet.searchXY(x, y, handler);
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
    return this._gridSet.searchRange2d(testRange, handler) && this._overflowSet.searchRange2d(testRange, handler);
  }
  /** If possible, insert a range into the set.
   * * Decline to insert (and return false) if
   *   * range is null
   *   * range is not completely contained in the overall range of this set.
   *   * range x or y extent is larger than 2 grid blocks.
   */
  public addRange(range: Range2d | Range3d, tag: T): void {
    if (!range.isNull) {
      if (!this._gridSet.conditionalInsert(range, tag))
        this._overflowSet.addRange(range, tag);
    }
  }
  public visitChildren(initialDepth: number, handler: (depth: number, child: LinearSearchRange2dArray<T>) => void) {
    handler(initialDepth, this._overflowSet);
    this._gridSet.visitChildren(initialDepth + 1, handler);
  }
}
