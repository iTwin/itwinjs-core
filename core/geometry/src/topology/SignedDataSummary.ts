/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */
/**
 * Class to accumulate statistics about a stream of signed numbers with tag items.
 * * All sums, counts, extrema, and item values are initialized to zero in the constructor.
 * * Each call to `announceItem(item, value)` updates the various sums, counts, and extrema.
 */
export class SignedDataSummary<T> {
  /** Sum of all positive area items. */
  public positiveSum: number;
  /** Number of positive area items. */
  public numPositive: number;
  /** Sum of negative area items. */
  public negativeSum: number;
  /** Number of negative area items. */
  public numNegative: number;
  /** Number of zero area items. */
  public numZero: number;
  /** The tag item item with the largest positive data. */
  public largestPositiveItem?: T;
  /** The tag item item with the most negative data. */
  public largestNegativeItem?: T;
  public largestPositiveValue: number;
  public largestNegativeValue: number;
  /** Array of all negative area items. */
  public negativeItemArray?: T[];
  /** Array of zero area items. */
  public zeroItemArray?: T[];
  /** Array of positive area items. */
  public positiveItemArray?: T[];
  /** Setup with zero sums and optional arrays. */
  public constructor(createArrays: boolean) {
    this.positiveSum = this.negativeSum = 0.0;
    this.numPositive = this.numNegative = this.numZero = 0.0;
    this.largestPositiveValue = this.largestNegativeValue = 0.0;
    if (createArrays) {
      this.negativeItemArray = [];
      this.positiveItemArray = [];
      this.zeroItemArray = [];
    }
  }
  /** Update with an item and its data value. */
  public announceItem(item: T, data: number) {
    if (data < 0) {
      this.numNegative++;
      this.negativeSum += data;
      if (this.negativeItemArray)
        this.negativeItemArray.push(item);
      if (data < this.largestNegativeValue) {
        this.largestNegativeValue = data;
        this.largestNegativeItem = item;
      }
    } else if (data > 0) {
      this.numPositive++;
      this.positiveSum += data;
      if (this.positiveItemArray)
        this.positiveItemArray.push(item);
      if (data > this.largestPositiveValue) {
        this.largestPositiveValue = data;
        this.largestPositiveItem = item;
      }
    } else {
      this.numZero++;
      if (this.zeroItemArray)
        this.zeroItemArray.push(item);
    }
  }
}
