/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Range2d, Range3d } from "../../geometry3d/Range";
import { LowAndHighXY } from "../../geometry3d/XYZProps";
import { LinearSearchRange2dArray } from "./LinearSearchRange2dArray";
import { Range2dSearchInterface } from "./Range2dSearchInterface";

/**
 * Type abbreviation to allow undefined as a Range2dSearchInterface parameter.
 * @internal
 */
export type OptionalRange2dSearchInterface<T> = Range2dSearchInterface<T> | undefined;

/**
 * A GriddedRaggedRange2dSet is:
 * * A doubly dimensioned array of Range2dSearchInterface.
 * * Each entry represents a block in a uniform grid within the master range.
 * * Member ranges are noted in the grid block containing the range's lower left corner.
 * * Member ranges larger than twice the grid size are rejected by the insert method.
 * * Hence a search involving a point in grid block (i,j) must examine ranges in grid blocks left and below, i.e. (i-1,j-1), (i-1,j), (i,j-1)
 * @public
 */
export class GriddedRaggedRange2dSet<T> implements Range2dSearchInterface<T> {
  private _range: Range2d;
  private _numXEdge: number;
  private _numYEdge: number;
  /** Each grid block is a simple linear search set */
  private _rangesInBlock: Array<Array<OptionalRange2dSearchInterface<T>>>;
  private static _workRange?: Range2d;
  private constructor(range: Range2d, numXEdge: number, numYEdge: number) {
    this._range = range;
    this._numXEdge = numXEdge;
    this._numYEdge = numYEdge;
    this._rangesInBlock = [];
    for (let j = 0; j < this._numYEdge; j++) {
      const thisRow: Array<OptionalRange2dSearchInterface<T>> = [];
      for (let i = 0; i < this._numXEdge; i++) {
        thisRow.push(undefined);
      }
      this._rangesInBlock.push(thisRow);
    }
  }
  /**
   * Create an (empty) set of ranges.
   * @param range master range
   * @param numXEdge size of grid in x direction
   * @param numYEdge size of grid in y direction
   */
  public static create<T>(range: Range2d, numXEdge: number, numYEdge: number): GriddedRaggedRange2dSet<T> | undefined {
    if (numXEdge < 1 || numYEdge < 1 || range.isNull || range.isSinglePoint)
      return undefined;
    return new GriddedRaggedRange2dSet(range.clone(), numXEdge, numYEdge);
  }
  private xIndex(x: number): number {
    const fraction = (x - this._range.low.x) / (this._range.high.x - this._range.low.x);
    return Math.floor(fraction * this._numXEdge);
  }
  private yIndex(y: number): number {
    const fraction = (y - this._range.low.y) / (this._range.high.y - this._range.low.y);
    return Math.floor(fraction * this._numXEdge);
  }
  private getBlock(i: number, j: number): OptionalRange2dSearchInterface<T> {
    if (i >= 0 && i < this._numXEdge && j >= 0 && j < this._numYEdge) {
      if (!this._rangesInBlock[j][i])
        this._rangesInBlock[j][i] = new LinearSearchRange2dArray();
      return this._rangesInBlock[j][i];
    }
    return undefined;
  }
  /** If possible, insert a range into the set.
   * * Decline to insert (and return false) if:
   *    * range is null
   *    * range is not completely contained in the overall range of this set
   *    * range x or y extent is larger than 2 grid blocks
   */
  public conditionalInsert(range: Range2d | Range3d | LowAndHighXY, tag: T): boolean {
    if (Range2d.isNull(range))
      return false;
    if (!this._range.containsRange(range))
      return false;
    const xIndex0 = this.xIndex(range.low.x);
    const xIndex1 = this.xIndex(range.high.x);
    const yIndex0 = this.yIndex(range.low.y);
    const yIndex1 = this.yIndex(range.high.y);
    if (!(xIndex0 === xIndex1 || xIndex0 + 1 === xIndex1))
      return false;
    if (!(yIndex0 === yIndex1 || yIndex0 + 1 === yIndex1))
      return false;
    const rangesInBlock = this.getBlock(xIndex0, yIndex0);
    if (rangesInBlock) {
      rangesInBlock.addRange(range, tag);
      return true;
    }
    return false;
  }
  /** Add a range to the search set. */
  public addRange(range: LowAndHighXY, tag: T): void {
    this.conditionalInsert(range, tag);
  }
  /**
   * * Search a single block
   * * Pass each range and tag to handler
   * * and return false if bad cell or if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.
   * @return false if search terminated by handler.  Return true if no handler returned false.
   */
  private searchXYInIndexedBlock(i: number, j: number, x: number, y: number, handler: (range: Range2d, tag: T) => boolean): boolean {
    const rangesInBlock = this.getBlock(i, j);
    if (!rangesInBlock)
      return true;
    return rangesInBlock.searchXY(x, y, handler);
  }
  /**
   * * Search a single block
   * * Pass each range and tag to handler
   * * and return false if bad cell or if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.
   * @return false if search terminated by handler.  Return true if no handler returned false.
   */
  private searchRange2dInIndexedBlock(i: number, j: number, testRange: LowAndHighXY, handler: (range: Range2d, tag: T) => boolean): boolean {
    const rangesInBlock = this.getBlock(i, j);
    if (!rangesInBlock)
      return true;
    return rangesInBlock.searchRange2d(testRange, handler);
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
    const i = this.xIndex(x);
    const j = this.yIndex(y);
    return this.searchXYInIndexedBlock(i, j, x, y, handler)
      && this.searchXYInIndexedBlock(i - 1, j, x, y, handler)
      && this.searchXYInIndexedBlock(i, j - 1, x, y, handler)
      && this.searchXYInIndexedBlock(i - 1, j - 1, x, y, handler);
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
    const xIndex0 = this.xIndex(testRange.low.x) - 1;
    const xIndex1 = this.xIndex(testRange.high.x);
    const yIndex0 = this.yIndex(testRange.low.y) - 1;
    const yIndex1 = this.yIndex(testRange.high.y);
    for (let i = xIndex0; i <= xIndex1; i++) {
      for (let j = yIndex0; j <= yIndex1; j++) {
        if (!this.searchRange2dInIndexedBlock(i, j, testRange, handler))
          return false;
      }
    }
    return true;
  }
  /** Return the overall range of all members. */
  public totalRange(result?: Range2d): Range2d {
    if (result)
      result.setNull();
    else
      result = Range2d.createNull();
    this.visitChildren(0, (_depth, child) => {
      const childRange = GriddedRaggedRange2dSet._workRange = child.totalRange(GriddedRaggedRange2dSet._workRange);
      result!.extendRange(childRange);
    });
    return result;
  }
  /** Call the handler on each defined block in the grid. */
  public visitChildren(initialDepth: number, handler: (depth: number, child: Range2dSearchInterface<T>) => void) {
    for (const row of this._rangesInBlock) {
      for (const block of row) {
        if (block)
          handler(initialDepth, block);
      }
    }
  }
}
