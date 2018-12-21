/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Collections */

import { OrderedComparator } from "./Compare";

/**
 * A function that, given a value of type T, returns a copy of that value. Such functions are used by various collection classes in the iModel.js library.
 * It is up to the function to decide how deeply or shallowly the value is cloned. For example, [[shallowClone]] simply returns the input.
 */
export type CloneFunction<T> = (value: T) => T;

/**
 * A [[CloneFunction]] that, given a value of type T, returns the same value.
 * Useful as a default argument for functions that can alternatively accept custom logic for cloning values of object type.
 * @param value The value to clone.
 * @returns the input value.
 */
export function shallowClone<T>(value: T) { return value; }

/**
 * Given a sorted array, computes the position at which the specified value should be inserted into the array so that the array remains sorted.
 * @param value The value whose position is to be computed.
 * @param list An array of U already sorted according to the comparison criterion.
 * @param compare The function used to compare the value with elements in `list`.
 * @returns an object with 'index' corresponding to the computed position and 'equal' set to true if an equivalent element already exists at that index.
 */
export function lowerBound<T, U = T>(value: T, list: U[], compare: OrderedComparator<T, U>): { index: number, equal: boolean } {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const comp = compare(value, list[mid]);
    if (0 === comp)
      return { index: mid, equal: true };
    else if (comp < 0)
      high = mid;
    else
      low = mid + 1;
  }

  return { index: low, equal: false };
}

/**
 * Maintains an array of some type T in sorted order. The ordering is specified by a function supplied
 * by the user.
 * By default, only unique elements are permitted; attempting to insert a new element that compares
 * as equal to an element already in the array will not modify the contents of the array.
 *
 * This allows a SortedArray<T> to behave like a Set<T> where T is an object and equality is determined
 * by some criterion other than object identity.
 *
 * Because the array is always sorted, querying for the presence of an element is performed using binary
 * search, which is more efficient than a linear search for reasonably large arrays.
 *
 * The user can also specify how the SortedArray takes ownership of inserted values, e.g., by cloning them.
 *
 * The comparison function must meet the following criteria, given 'lhs' and 'rhs' of type T:
 *  - If lhs is equal to rhs, returns 0
 *  - If lhs is less than rhs, returns a negative value
 *  - If lhs is greater than rhs, returns a positive value
 *  - If compare(lhs, rhs) returns 0, then compare(rhs, lhs) must also return 0
 *  - If compare(lhs, rhs) returns a negative value, then compare(rhs, lhs) must return a positive value, and vice versa.
 *
 * Modifying an element in a way that affects the comparison function will produce unpredictable results, the
 * most likely of which is that the array will cease to be sorted.
 */
export class SortedArray<T> {
  protected _array: T[] = [];
  protected readonly _compare: OrderedComparator<T>;
  protected readonly _clone: CloneFunction<T>;
  protected readonly _allowDuplicates: boolean;

  /**
   * Construct a new SortedArray<T>.
   * @param compare The function used to compare elements within the array.
   * @param allowDuplicates If true, multiple values comparing equal may exist in the array.
   * @param clone The function invoked to clone a new element for insertion into the array. The default implementation simply returns its input.
   */
  public constructor(compare: OrderedComparator<T>, allowDuplicates: boolean = false, clone: CloneFunction<T> = shallowClone) {
    this._compare = compare;
    this._clone = clone;
    this._allowDuplicates = allowDuplicates;
  }

  /** The number of elements in the array */
  public get length(): number { return this._array.length; }

  /** Returns true if the array contains no elements. */
  public get isEmpty(): boolean { return 0 === this.length; }

  /** Clears the contents of the sorted array. */
  public clear(): void { this._array.length = 0; }

  /** Extracts the sorted array as a T[] and empties the contents of this SortedArray.
   * @returns the contents of this SortedArray as a T[].
   */
  public extractArray(): T[] {
    const result = this._array;
    this.clear();
    return result;
  }

  /**
   * Attempts to insert a new value into the array at a position determined by the ordering.
   * The behavior differs based on whether or not duplicate elements are permitted.
   * If duplicates are **not** permitted, then:
   *  - If an equivalent element already exists in the array, nothing will be inserted and the index of the existing element will be returned.
   *  - Otherwise, the element is inserted and its index is returned.
   * If duplicates **are** permitted, then:
   *  - The element will be inserted in a correct position based on the sorting criterion;
   *  - The position of the element relative to other elements comparing as equal to it is unspecified; and
   *  - The actual index of the newly-inserted element is returned.
   * If the element is to be inserted, then the supplied value will be passed to the clone function supplied to the constructor and the result will be inserted into the array.
   * @param value The value to insert
   * @param onInsert The optional callback method to call if insertion occurs with the inserted value
   * @returns the index in the array of the newly-inserted value, or, if duplicates are not permitted and an equivalent value already exists, the index of the equivalent value.
   */
  public insert(value: T, onInsert?: (value: T) => any): number {
    const bound = this.lowerBound(value);

    if (!bound.equal || this._allowDuplicates)
      this._array.splice(bound.index, 0, this._clone(value));

    if (undefined !== onInsert)
      onInsert(value);

    return bound.index;
  }

  /**
   * Removes the first occurrence of a value comparing equal to the specified value from the array.
   * @param value The value of the element to delete
   * @returns the index of the deleted value, or -1 if no such element exists.
   */
  public remove(value: T): number {
    const bound = this.lowerBound(value);
    if (bound.equal) {
      this._array.splice(bound.index, 1);
      return bound.index;
    } else {
      return -1;
    }
  }

  /**
   * Looks up the index of an element comparing equal to the specified value using binary search.
   * @param value The value to search for
   * @returns the index of the first equivalent element in the array, or -1 if no such element exists.
   */
  public indexOf(value: T): number {
    const bound = this.lowerBound(value);
    return bound.equal ? bound.index : -1;
  }

  /**
   * Returns true if this array contains at least one value comparing equal to the specified value.
   * @param value The value to search for
   * @returns true if an equivalent element exists in the array.
   */
  public contains(value: T): boolean {
    return -1 !== this.indexOf(value);
  }

  /**
   * Looks up an element comparing equal to the specified value using binary search.
   * @param value The value to search for
   * @returns the first equivalent element in the array, or undefined if no such element exists.
   */
  public findEqual(value: T): T | undefined {
    const index = this.indexOf(value);
    return -1 !== index ? this._array[index] : undefined;
  }

  /**
   * Looks up an element by its index in the array.
   * @param index The array index
   * @returns the element corresponding to that position in the array, or undefined if the supplied index exceeds the length of the array.
   */
  public get(index: number): T | undefined { return index < this.length ? this._array[index] : undefined; }

  /** Apply a function to each element in the array, in sorted order.
   * @param func The function to be applied.
   */
  public forEach(func: (value: T) => void): void {
    for (let i = 0; i < this.length; i++)
      func(this._array[i]);
  }

  /**
   * Computes the position at which the specified value should be inserted to maintain sorted order.
   * @param value The value whose position is to be computed.
   * @returns an object with 'index' corresponding to the computed position and 'equal' set to true if an equivalent element already exists at that index.
   */
  protected lowerBound(value: T): { index: number, equal: boolean } { return lowerBound(value, this._array, this._compare); }
}
