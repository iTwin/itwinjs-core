/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Range3d } from "../geometry3d/Range";
import { UsageSums } from "../numerics/UsageSums";

/**
 * Accumulated data for x,y,z length statistics in ranges.
 * * Usage pattern:
 *   * create a enw RangeLengthData:
 *      * `myData = new RangeLengthData ();`
 *   * announce ranges to be accumulated:
 *     * (many times)  `myData.accumulateRowableXYZArrayRange (points);
 *   * access data in public members:
 *     * `myData.range` -- the composite range.
 *     * `myData.xLength`, `myData.yLength`, `myData.zLength` -- mean, minMax, count, and standardDeviation of range lengths in x,y,z directions.
 * @public
 */
export class RangeLengthData {
  /** Overall range of all data observed by `accumulate` methods. */
  public range: Range3d;
  /** */
  public xSums: UsageSums;
  public ySums: UsageSums;
  public zSums: UsageSums;
  public constructor() {
    this.range = Range3d.createNull();
    this.xSums = new UsageSums();
    this.ySums = new UsageSums();
    this.zSums = new UsageSums();
    this._workRange = Range3d.createNull();
  }
  private _workRange: Range3d;
  /** Extend the range and length sums by the range of points in an array. */
  public accumulateGrowableXYZArrayRange(points: GrowableXYZArray) {
    points.setRange(this._workRange);
    this.range.extendRange(this._workRange);
    this.xSums.accumulate(this._workRange.xLength());
    this.ySums.accumulate(this._workRange.yLength());
    this.zSums.accumulate(this._workRange.zLength());
  }
}
