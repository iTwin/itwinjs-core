/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

import { Geometry } from "../Geometry";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { Range1d } from "../geometry3d/Range";

/**
 * A Range1d array is a set of intervals, such as occur when a line is clipped to a (nonconvex) polygon
 * @internal
 */
export class Range1dArray {
  /** Internal step: Caller supplies rangeA = interval from left operand of set difference {A - B}
   *  ib = lowest possible index of overlapping interval of {B}
   *  Output live parts of rangeA, advancing B over intervals that do not extend beyond {rangeA}
   *  iB is advanced to the first interval whose high is to the right of {rangeA.high}
   */
  private static advanceIntervalDifference(rangeA: Range1d, dataB: Range1d[], iB: number, retVal: Range1d[]) {
    const nB = dataB.length;
    let low = rangeA.low;
    let high = rangeA.high;
    while (iB < nB) {
      const rangeB = dataB[iB];
      if (rangeB.high < low) {
        iB++;
      } else if (rangeB.high <= high) {
        if (rangeB.low > low)
          retVal.push(Range1d.createXX(low, rangeB.low));
        low = rangeB.high;
        iB++;
      } else {
        // B ends beyond rangeA...
        if (rangeB.low < high)
          high = rangeB.low;
        break;
      }
    }

    if (low < high)
      retVal.push(Range1d.createXX(low, high));

    return retVal;
  }

  /** Intersect intervals in two pre-sorted sets. Output may NOT be the same as either input. */
  public static differenceSorted(dataA: Range1d[], dataB: Range1d[]): Range1d[] {
    const nA = dataA.length;
    const iB = 0;
    const retVal: Range1d[] = [];
    for (let iA = 0; iA < nA; iA++) {
      Range1dArray.advanceIntervalDifference(dataA[iA], dataB, iB, retVal);
    }

    return retVal;
  }

  /** Internal step: Caller ensures rangeA is the "lower" interval.
   *  Look rangeB to decide (a) what output interval to create and (b) which read index to advance.
   *  Returns true or false to indicate whether the value associated with rangeA or rangeB should be incremented after this function returns
   */
  private static advanceIntervalIntersection(rangeA: Range1d, rangeB: Range1d, retVal: Range1d[]): boolean {
    if (rangeB.low > rangeA.high) {
      return true;
    } else if (rangeB.high >= rangeA.high) {
      retVal.push(Range1d.createXX(rangeB.low, rangeA.high));
      return true;
    } else {
      retVal.push(Range1d.createXX(rangeB.low, rangeB.high));
      return false;
    }
  }
  /** Boolean intersection among the (presorted) input ranges */
  public static intersectSorted(dataA: Range1d[], dataB: Range1d[]): Range1d[] {
    let iA = 0;
    let iB = 0;
    const nA = dataA.length;
    const nB = dataB.length;
    const retVal: Range1d[] = [];
    while (iA < nA && iB < nB) {
      const rangeA = dataA[iA];
      const rangeB = dataB[iB];
      if (rangeA.low <= rangeB.low) {
        if (Range1dArray.advanceIntervalIntersection(rangeA, rangeB, retVal))
          iA++;
        else
          iB++;
      } else {
        if (Range1dArray.advanceIntervalIntersection(rangeB, rangeA, retVal))
          iB++;
        else
          iA++;
      }
    }

    return retVal;
  }

  /** Internal step: Read an interval from the array.
   *  If it overlaps the work interval, advance the work interval, and return true to notify caller to increment read index.
   */
  private static advanceIntervalUnion(workRange: Range1d, source: Range1d[], readIndex: number): boolean {
    if (readIndex >= source.length)
      return false;
    const candidate = source[readIndex];
    if (candidate.low > workRange.high)
      return false;
    if (candidate.high > workRange.high)
      workRange.high = candidate.high;
    return true;
  }

  /** Boolean union among the (presorted) input ranges */
  public static unionSorted(dataA: Range1d[], dataB: Range1d[]): Range1d[] {
    const nA = dataA.length;
    const nB = dataB.length;
    let iA = 0;
    let iB = 0;
    const retVal: Range1d[] = [];
    while (iA < nA && iB < nB) {
      const rangeA = dataA[iA];
      const rangeB = dataB[iB];
      let workRange: Range1d;
      // Pull from the lower of rangeA and rangeB. This always advances exactly one of the indices -- progress towards getting out.
      if (rangeA.low <= rangeB.low) {
        workRange = rangeA.clone();
        iA++;
      } else {
        workRange = rangeB.clone();
        iB++;
      }

      let toLoop = true;
      do {
        const resultA = Range1dArray.advanceIntervalUnion(workRange, dataA, iA);
        const resultB = Range1dArray.advanceIntervalUnion(workRange, dataB, iB);
        if (resultA)
          iA++;
        if (resultB)
          iB++;
        if (!(resultA || resultB))
          toLoop = false;
      } while (toLoop);

      retVal.push(workRange);
    }

    while (iA < nA)
      retVal.push(dataA[iA++]);
    while (iB < nB)
      retVal.push(dataB[iB++]);

    return retVal;
  }

  /** Boolean parity among the (presorted) input ranges */
  public static paritySorted(dataA: Range1d[], dataB: Range1d[]): Range1d[] {
    // Combine the two arrays, and then perform a simplification using simplifySortParity function
    const retVal: Range1d[] = [];
    for (const range of dataA)
      retVal.push(range.clone());
    for (const range of dataB)
      retVal.push(range.clone());

    // Sort the array
    retVal.sort(compareRange1dLexicalLowHigh);

    Range1dArray.simplifySortParity(retVal, true);
    return retVal;
  }

  /** Uses the Range1d specific compare function `compareRange1dLexicalLowHigh` for sorting the array of ranges */
  public static sort(data: Range1d[]) {
    data.sort(compareRange1dLexicalLowHigh);
  }

  /** Cleans up the array, compressing any overlapping ranges. If removeZeroLengthRanges is set to true, will also remove any Ranges in the form (x, x) */
  public static simplifySortUnion(data: Range1d[], removeZeroLengthRanges: boolean = false) {
    if (data.length < 2)
      return;

    data.sort(compareRange1dLexicalLowHigh);

    let currentIndex = 0;   // last accepted interval
    for (let i = 1; i < data.length; i++) {
      if (data[i].low <= data[currentIndex].high) {
        // extend the current range
        if (data[i].high > data[currentIndex].high)
          data[currentIndex].high = data[i].high;
      } else {
        // data[i] is a new entry.
        currentIndex++;
        data[currentIndex].setFrom(data[i]);
      }
    }

    data.length = currentIndex + 1;
    if (removeZeroLengthRanges) {
      currentIndex = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i].low < data[i].high) {
          if (currentIndex < i)
            data[++currentIndex].setFrom(data[i]);
        }
      }
    }
  }

  /** Apply parity logic among ranges which are not pre-sorted. */
  public static simplifySortParity(data: Range1d[], removeZeroLengthRanges: boolean = false) {
    const numData: number[] = [];
    for (const range of data) {
      if (range.low !== range.high) {
        numData.push(range.low);
        numData.push(range.high);
      }
    }
    const n = numData.length;
    numData.sort((a: number, b: number): number => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    let currIdx = 0;
    let x0;
    let x1;
    for (let i = 0; i < n; i += 2) {
      x0 = numData[i];
      x1 = numData[i + 1];
      if (!removeZeroLengthRanges) {
        Range1d.createXX(x0, x1, data[currIdx++]);
      } else {
        // coalesce intervals that share end and start:
        while (i + 2 < n && numData[i + 2] === x1) {
          i += 2;
          x1 = numData[i + 1];
        }
        if (x1 > x0)
          Range1d.createXX(x0, x1, data[currIdx++]);
      }
    }

    data.length = currIdx;
  }

  /** test if value is "in" by union rules.
   * * This considers all intervals-- i.e. does not expect or take advantage of sorting.
   */
  public static testUnion(data: Range1d[], value: number): boolean {
    return this.countContainingRanges(data, value) > 0;
  }
  /** test if value is "in" by parity rules.
   * * This considers all intervals-- i.e. does not expect or take advantage of sorting.
   */
  public static testParity(data: Range1d[], value: number): boolean {
    let inside = false;
    for (const range of data) {
      if (range.containsX(value))
        inside = !inside;
    }
    return inside;
  }

  /** linear search to count number of intervals which contain `value`.
   */
  public static countContainingRanges(data: Range1d[], value: number): number {
    let n = 0;
    for (const range of data) {
      if (range.containsX(value))
        n++;
    }
    return n;
  }

  /** return an array with all the low and high values of all the ranges.
   * @param data array of ranges.
   * @param sort optionally request immediate sort.
   * @param compress optionally request removal of duplicates.
   */
  public static getBreaks(data: Range1d[], result?: GrowableFloat64Array, sort: boolean = false, compress: boolean = false, clear: boolean = true): GrowableFloat64Array {
    if (!result) result = new GrowableFloat64Array(2 * data.length);
    if (clear) result.clear();
    for (const range of data) {
      result.push(range.low);
      result.push(range.high);
    }
    if (sort)
      result.sort();
    if (compress)
      result.compressAdjacentDuplicates();

    return result;
  }

  /**  evaluate a point at an array of given fraction values
   * @param data array of ranges.
   * @param initialRangeFraction fraction coordinate applied only to first range. (typically negative)
   * @param rangeFraction fraction within each range.
   * @param includeDegenerateRange if false, skip rangeFraction for 0-length ranges.
   * @param gapFraction fraction within interval from each range high to successor low
   * @param includeDegenerateGap if false, skip rangeFraction for 0-length gaps.
   * @param finalRangeFraction fraction coordinate applied only to last range (typically an extrapolation above)
   * @param result array to receive values
   */
  public static appendFractionalPoints(data: Range1d[], initialRangeFraction: number | undefined, rangeFraction: number | undefined, includeDegenerateRange: boolean,
    gapFraction: number | undefined, includeDegenerateGap: boolean,
    finalRangeFraction: number | undefined, result: GrowableFloat64Array | number[]): GrowableFloat64Array | number[] {
    const numRange = data.length;
    if (numRange > 0) {
      if (undefined !== initialRangeFraction)
        result.push(data[0].fractionToPoint(initialRangeFraction));
      for (let i = 0; i < numRange; i++) {
        if (rangeFraction !== undefined && (includeDegenerateRange || data[i].low !== data[i].high))
          result.push(data[i].fractionToPoint(rangeFraction));
        if (i > 1 && gapFraction !== undefined && (includeDegenerateGap || data[i].low !== data[i].high))
          result.push(Geometry.interpolate(data[i - 1].high, gapFraction, data[i].low));
      }
      if (undefined !== finalRangeFraction)
        result.push(data[numRange - 1].fractionToPoint(finalRangeFraction));
    }
    return result;
  }

  /** Return a single range constructed with the low of range 0 and high of final range in the set.  */
  public static firstLowToLastHigh(data: Range1d[]): Range1d {
    if (data.length === 0)
      return Range1d.createNull();
    return Range1d.createXX(data[0].low, data[data.length - 1].high);
  }
  /** sum the lengths of all ranges */
  public static sumLengths(data: Range1d[]): number {
    let sum = 0.0;
    for (const range of data) {
      sum += range.length();
    }
    return sum;
  }

  /**
   * Test if the low,high values are sorted with no overlap.
   * @param data array of ranges.
   * @param strict if true, consider exact high-to-low match as overlap.
   */
  public static isSorted(data: Range1d[], strict: boolean = true): boolean {
    const n = data.length;
    if (strict) {
      for (let i = 0; i + 1 < n; i++) {
        if (data[i].high >= data[i + 1].low)
          return false;
      }
    } else {
      for (let i = 0; i + 1 < n; i++) {
        if (data[i].high > data[i + 1].low)
          return false;
      }
    }
    return true;
  }
}

/** Checks low's first, then high's
 * @internal
 */
export function compareRange1dLexicalLowHigh(a: Range1d, b: Range1d): number {
  if (a.low < b.low) return -1;
  if (a.low > b.low) return 1;
  if (a.high < b.high) return -1;
  if (a.high > b.high) return 1;
  return 0;
}
