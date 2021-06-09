/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { OrderedComparator } from "./Compare";
import { CloneFunction, lowerBound, shallowClone } from "./SortedArray";

/** Associates a value of type T with an index representing its insertion order in an IndexMap<T>
 * @public
 */
export class IndexedValue<T> {
  public readonly value: T;
  public readonly index: number;

  public constructor(value: T, index: number) {
    this.value = value;
    this.index = index;
  }
}

/**
 * Maintains a set of unique elements in sorted order and retains the insertion order of each.
 * The uniqueness of the elements is determined by a comparison routine supplied by the user.
 * The user may also supply a maximum size, beyond which insertions will fail.
 * @public
 */
export class IndexMap<T> {
  protected _array: Array<IndexedValue<T>> = [];
  protected readonly _compareValues: OrderedComparator<T>;
  protected readonly _clone: CloneFunction<T>;
  protected readonly _maximumSize: number;

  /**
   * Construct a new IndexMap<T>.
   * @param compare The function used to compare elements within the map.
   * @param maximumSize The maximum number of elements permitted in the IndexMap. The maximum index of an element is maximumSize-1.
   * @param clone The function invoked to clone a new element for insertion into the array. The default implementation simply returns its input.
   */
  public constructor(compare: OrderedComparator<T>, maximumSize: number = Number.MAX_SAFE_INTEGER, clone: CloneFunction<T> = shallowClone) {
    this._compareValues = compare;
    this._clone = clone;
    this._maximumSize = maximumSize;
  }

  /** The number of elements in the map. */
  public get length(): number { return this._array.length; }

  /** Returns true if the maximum number of elements have been inserted. */
  public get isFull(): boolean { return this.length >= this._maximumSize; }

  /** Returns true if the map contains no elements. */
  public get isEmpty(): boolean { return 0 === this.length; }

  /** Removes all elements from the map. */
  public clear(): void { this._array = []; }

  /** Attempt to insert a new value into the map.
   * If an equivalent element already exists in the map, the corresponding index is returned.
   * If the map is full, nothing is inserted and -1 is returned.
   * Otherwise:
   *  The new element is mapped to the next-available index (that is, the length of the map prior to insertion of this new element);
   *  the value is cloned using the function supplied to the IndexMap constructor;
   *  the cloned result is inserted into the map; and
   *  the index of the new element is returned.
   * @param value The value to insert
   * @param onInsert The optional callback method to call if insertion occurs with the inserted value
   * @returns the index of the equivalent element in the map, or -1 if the map is full and no equivalent element exists.
   */
  public insert(value: T, onInsert?: (value: T) => any): number {
    const bound = this.lowerBound(value);
    if (bound.equal)
      return this._array[bound.index].index;
    else if (this.isFull)
      return -1;

    const entry = new IndexedValue<T>(this._clone(value), this._array.length);

    if (undefined !== onInsert)
      onInsert(entry.value);

    this._array.splice(bound.index, 0, entry);
    return entry.index;
  }

  /**
   * Finds the index of an element equivalent to the supplied value.
   * @param value the value to find
   * @returns the index of an equivalent element in the map, or -1 if no such element exists.
   */
  public indexOf(value: T): number {
    const bound = this.lowerBound(value);
    return bound.equal ? this._array[bound.index].index : -1;
  }

  protected lowerBound(value: T): { index: number, equal: boolean } { return lowerBound(value, this._array, (lhs: T, rhs: IndexedValue<T>) => this._compareValues(lhs, rhs.value)); }

  /** Return an array of the elements in this map in which the array index of each element corresponds to the index assigned to it by the map. */
  public toArray(): T[] {
    const array: T[] = [];
    for (const entry of this._array)
      array[entry.index] = entry.value;

    return array;
  }
}
