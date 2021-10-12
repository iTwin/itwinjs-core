/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { IndexedXYZCollection } from "./IndexedXYZCollection";

interface CollectionWithLength {
  length: number;
}
/**
 * Object describing a (contiguous) subset of indices to an IndexedXYZCollection
 * @public
 */
export class IndexedCollectionInterval<T extends CollectionWithLength> {
  /** Any collection that has a .length member or property */
  public points: T;
  /** lower limit of index range */
  public begin: number;
  /** upper limit (beyond) index range. */
  public end: number;
  protected constructor(points: T, base: number, limit: number) {
    this.points = points;
    this.begin = base;
    this.end = limit;
  }
  /** Create an interval which matches a complete indexed collection. */
  public static createComplete<T extends CollectionWithLength>(points: T): IndexedCollectionInterval<T> {
    return new this(points, 0, points.length);
  }
  /** Create an interval which matches a collection from `start <= i < end`. */
  public static createBeginEnd<T extends CollectionWithLength>(points: T, begin: number, end: number): IndexedCollectionInterval<T> {
    return new this(points, begin, end);
  }

  /** Create an interval which matches a collection from `start <= i < end`. */
  public static createBeginLength<T extends CollectionWithLength>(points: T, begin: number, length: number): IndexedCollectionInterval<T> {
    return new this(points, begin, begin + length);
  }
  /** Add one to this.begin.  Return true if the interval is still live. */
  public advanceBegin(): boolean {
    this.begin++;
    return this.begin < this.end;
  }
  /** advance this.end (but do not go beyond this.points.length)   return true if the interval is still live. */
  public advanceEnd(): boolean {
    this.end++;
    if (this.end > this.points.length)
      this.end = this.points.length;
    return this.begin < this.end;
  }
  /** Return (if possible) the parent index corresponding to `localIndex` */
  public localIndexToParentIndex(localIndex: number): number | undefined {
    if (localIndex >= 0) {
      const parentIndex = this.begin + localIndex;
      if (parentIndex < this.points.length)
        return parentIndex;
    }
    return undefined;
  }
  /** Return true if
   * * the interval is empty (the empty set is a subset of all sets!)
   * * all indices in its range are valid.
   */
  public get isValidSubset(): boolean {
    return this.length === 0
      || (this.localIndexToParentIndex(0) !== undefined
        && this.localIndexToParentIndex(this.length - 1) !== undefined);
  }
  /** restrict this.end to this.points.length */
  public restrictEnd() {
    if (this.end > this.points.length)
      this.end = this.points.length;
  }
  /** Return true if length is 1 or more */
  public get isNonEmpty(): boolean {
    return this.begin < this.end;
  }
  /** Advance this.begin to (other.end-1), i.e. catch the last member of other. */
  public advanceToTail(other: IndexedCollectionInterval<T>): boolean {
    this.begin = other.end - 1;
    return this.isNonEmpty;
  }
  /** Advance this.begin to (other.begin), i.e. catch the first member of other. */
  public advanceToHead(other: IndexedCollectionInterval<T>): boolean {
    this.begin = other.begin;
    return this.isNonEmpty;
  }

  /** Set this interval from another, with conditional replacements:
   * * Always reference the same points as other.
   * * use optional begin and end arguments if present; if not take begin and and from other.
   * * cap end at points.length.
   */
  public setFrom(other: IndexedCollectionInterval<T>, base?: number, limit?: number) {
    this.points = other.points;
    this.begin = base === undefined ? other.begin : base;
    this.end = limit === undefined ? other.end : limit;
    this.restrictEnd();
  }
  /** Return the number of steps possible with current begin and end */
  public get length(): number {
    return this.end > this.begin ? this.end - this.begin : 0;
  }
  /** Return true if the length is exactly 1 */
  public get isSingleton(): boolean {
    return this.begin + 1 === this.end;
  }
}

/**
 * Reference to an interval of the indices of an IndexedXYZCollection.
 * @public
 */
export class IndexedXYZCollectionInterval extends IndexedCollectionInterval<IndexedXYZCollection> {

}
