/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Geometry } from "../../Geometry";
import { Range2d } from "../../geometry3d/Range";
import { UsageSums } from "../../numerics/UsageSums";
import { RangeLengthData } from "../RangeLengthData";
import { GriddedRaggedRange2dSetWithOverflow } from "./GriddedRaggedRange2dSetWithOverflow";
import { LinearSearchRange2dArray } from "./LinearSearchRange2dArray";
import { Range2dSearchInterface } from "./Range2dSearchInterface";

/** Class with static members to work with various range searchers. */
export class RangeSearch {
  public static readonly smallCountLimit = 40;
  /** Target size for grid block size divided by representative per-entry range size. */
  public static readonly defaultRangesPerBlockEdge = 4;
  /** the "representative range size"is the mean range size plus this number of standard deviations */
  public static readonly defaultStandardDeviationAdjustment = 1.0;
  /** Based on range count and distribution, return an object which can answer 2d range queries */
  public static create2dSearcherForRangeLengthData<T>(rangeLengthData: RangeLengthData, rangesPerBlockEdge: number = RangeSearch.defaultRangesPerBlockEdge, standardDeviationAdjustment: number = RangeSearch.defaultStandardDeviationAdjustment): Range2dSearchInterface<T> | undefined {
    // for smallish sets, just linear search  . . ..
    if (rangeLengthData.xSums.count < RangeSearch.smallCountLimit)
      return new LinearSearchRange2dArray();
    const numXBlock = this.estimateGridBlockCount(rangeLengthData.range.xLength(), rangeLengthData.xSums, rangesPerBlockEdge, standardDeviationAdjustment);
    const numYBlock = this.estimateGridBlockCount(rangeLengthData.range.yLength(), rangeLengthData.ySums, rangesPerBlockEdge, standardDeviationAdjustment);
    if (numXBlock < 2 && numYBlock < 2)
      return new LinearSearchRange2dArray();
    return GriddedRaggedRange2dSetWithOverflow.create<T>(Range2d.createFrom(rangeLengthData.range), numXBlock, numYBlock);
  }
  /** Return the number of grid bocks (in one direction) for
   * * The total range length in this direction
   * * individual ranges whose count, mean and standard deviation are available in the sums.
   * @param totalRange the total range being searched (in this direction)
   * @param sums source for mean, count, and standard deviation of individual ranges
   * @param rangesPerBlockEdge target ratio of edge length in search blocks divided by representative length of individual range edges
   * @param standardDeviationAdjustment the number of standard deviations above the mean to be applied to convert mean to representative length.  Typically 0 to 1.
   * @returns number of blocks in grid.
   */
  public static estimateGridBlockCount(totalLength: number, sums: UsageSums, rangesPerBlockEdge: number = RangeSearch.defaultRangesPerBlockEdge, standardDeviationAdjustment: number = RangeSearch.defaultStandardDeviationAdjustment): number {
    if (sums.count < 1)
      return 1;
    const representativeRangeLength = rangesPerBlockEdge * (sums.mean + standardDeviationAdjustment * sums.standardDeviation);
    const gridEdgeLength = Geometry.conditionalDivideFraction(totalLength, representativeRangeLength);
    if (gridEdgeLength === undefined)
      return 1;
    return Math.ceil(gridEdgeLength);
  }
}
