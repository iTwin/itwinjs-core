/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { OrderedComparator } from "./Compare";

/**
 * A function that, given a value of type T, returns a copy of that value. Such functions are used by various collection classes in the iModel.js library.
 * It is up to the function to decide how deeply or shallowly the value is cloned. For example, [[shallowClone]] simply returns the input.
 * @public
 */
export type CloneFunction<T> = (value: T) => T;

/**
 * A [[CloneFunction]] that, given a value of type T, returns the same value.
 * Useful as a default argument for functions that can alternatively accept custom logic for cloning values of object type.
 * @param value The value to clone.
 * @returns the input value.
 * @public
 */
export function shallowClone<T>(value: T) { return value; }

/**
 * Given a sorted array, computes the position at which the specified value should be inserted into the array so that the array remains sorted.
 * @param value The value whose position is to be computed.
 * @param list An array of U already sorted according to the comparison criterion.
 * @param compare The function used to compare the value with elements in `list`.
 * @returns an object with 'index' corresponding to the computed position and 'equal' set to true if an equivalent element already exists at that index.
 * @public
 */
export function lowerBound<T, U = T>(value: T, list: U[], compare: OrderedComparator<T, U>): { index: number, equal: boolean } {
  return lowerBoundOfEquivalent(list, (element: U) => compare(value, element));
}

function lowerBoundOfEquivalent<T>(list: T[], criterion: (element: T) => number): { index: number, equal: boolean } {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const comp = criterion(list[mid]);
    if (0 === comp)
      return { index: mid, equal: true };
    else if (comp < 0)
      high = mid;
    else
      low = mid + 1;
  }

  return { index: low, equal: false };
}

/** Describes how duplicate values are handled when inserting into a [[SortedArray]].
 * A "duplicate" value is one that compares equal to a value already present in the array, per the array's comparison function.
 * @public
 */
export enum DuplicatePolicy {
  /** The array allows duplicate values to be inserted. All duplicate values will be adjacent in the array, but the ordering between duplicate values is unspecified.
   * @note In the presence of duplicate values, functions like [[SortedArray.indexOf]] and [[SortedArray.findEqual]] will return one of the values - exactly which one is unspecified.
   */
  Allow,
  /** Duplicate values are forbidden - when attempting to insert a value equivalent to one already present, the already-present value is retained. */
  Retain,
  /** Duplicate values are forbidden - when attempting to insert a value equivalent to one already present, the already-present value is replaced by the new value.
   * This can be useful when the value type carries additional data that is not evaluated by the comparison function.
   */
  Replace,
}

/**
 * A read-only view of an array of some type T sorted according to some user-supplied criterion.
 * Duplicate elements may be present, though sub-types may enforce uniqueness of elements.
 * In the absence of duplicates, a ReadonlySortedArray<T> can behave like a Set<T> where T is an object and equality is determined
 * by some criterion other than object identity.
 *
 * Because the array is always sorted, querying for the presence of an element is performed using binary
 * search, which is more efficient than a linear search for reasonably large arrays.
 *
 * The comparison function must meet the following criteria, given 'lhs' and 'rhs' of type T:
 *  - If lhs is equal to rhs, returns 0
 *  - If lhs is less than rhs, returns a negative value
 *  - If lhs is greater than rhs, returns a positive value
 *  - If compare(lhs, rhs) returns 0, then compare(rhs, lhs) must also return 0
 *  - If compare(lhs, rhs) returns a negative value, then compare(rhs, lhs) must return a positive value, and vice versa.
 *
 * Note that the array is read-only only from the perspective of its public interface. Mutation methods are defined for internal use by sub-types.
 *
 * @see [[SortedArray]] for a general-purpose mutable sorted array.
 * @public
 */
export class ReadonlySortedArray<T> implements Iterable<T> {
  protected _array: T[] = [];
  protected readonly _compare: OrderedComparator<T>;
  protected readonly _clone: CloneFunction<T>;
  protected readonly _duplicatePolicy: DuplicatePolicy;

  /**
   * Construct a new ReadonlySortedArray<T>.
   * @param compare The function used to compare elements within the array.
   * @param duplicatePolicy Policy for handling attempts to insert a value when an equivalent value already exists. If the input is a boolean, then `true` indicates [[DuplicatePolicy.Allow]], and `false` indicates [[DuplicatePolicy.Retain]].
   * @param clone The function invoked to clone a new element for insertion into the array. The default implementation simply returns its input.
   */
  protected constructor(compare: OrderedComparator<T>, duplicatePolicy: DuplicatePolicy | boolean = false, clone: CloneFunction<T> = shallowClone) {
    this._compare = compare;
    this._clone = clone;
    if (typeof duplicatePolicy === "boolean")
      duplicatePolicy = duplicatePolicy ? DuplicatePolicy.Allow : DuplicatePolicy.Retain;

    this._duplicatePolicy = duplicatePolicy;
  }

  /** The number of elements in the array */
  public get length(): number { return this._array.length; }

  /** Returns true if the array contains no elements. */
  public get isEmpty(): boolean { return 0 === this.length; }

  /** Returns an iterator over the contents of the array in sorted order, suitable for use in `for-of` loops. */
  public [Symbol.iterator](): Iterator<T> { return this._array[Symbol.iterator](); }

  /**
   * Looks up the index of an element comparing equal to the specified value using binary search.
   * @param value The value to search for
   * @returns the index of the first equivalent element found in the array, or -1 if no such element exists.
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
   * @returns the first equivalent element found in the array, or undefined if no such element exists.
   */
  public findEqual(value: T): T | undefined {
    const index = this.indexOf(value);
    return -1 !== index ? this._array[index] : undefined;
  }

  /** Find an element that compares as equivalent based on some criterion. If multiple elements are equivalent, the specific one returned is unspecified.
   * As an example, consider a `SortedArray<ModelState>` which uses `ModelState.id` as its ordering criterion. To find a model by its Id,
   * use `sortedArray.findEquivalent((element) => compareStrings(element.id, modelId))` where `modelId` is an [[Id64String]].
   * @param criterion A function accepting an element and returning 0 if it compares as equivalent, a negative number if it compares as "less-than", or a positive value if it compares as "greater-than".
   * @returns The first element found that meets the criterion, or `undefined` if no elements meet the criterion.
   * @see [[indexOfEquivalent]].
   * @public
   */
  public findEquivalent(criterion: (element: T) => number): T | undefined {
    const index = this.indexOfEquivalent(criterion);
    return -1 !== index ? this._array[index] : undefined;
  }

  /** Find the index of an element that compares as equivalent based on some criterion. If multiple elements are equivalent, the specific one returned is unspecified.
   * As an example, consider a `SortedArray<ModelState>` which uses `ModelState.id` as its ordering criterion. To find the index of a model by its Id,
   * use `sortedArray.indexOfEquivalent((element) => compareStrings(element.id, modelId))` where `modelId` is an [[Id64String]].
   * @param criterion A function accepting an element and returning 0 if it compares as equivalent, a negative number if the element compares as "less-than", or a positive value if the element compares as "greater-than".
   * @returns The index of the first element found that meets the criterion, or -1 if no elements meet the criterion.
   * @public
   */
  public indexOfEquivalent(criterion: (element: T) => number): number {
    // NB: Must invert the ordering.
    const bound = lowerBoundOfEquivalent(this._array, (elem: T) => 0 - criterion(elem));
    return bound.equal ? bound.index : -1;
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

  /** Clears the contents of the sorted array. */
  protected _clear(): void { this._array.length = 0; }

  /** Extracts the sorted array as a T[] and empties the contents of this ReadonlySortedArray.
   * @returns the contents of this ReadonlySortedArray as a T[].
   */
  protected _extractArray(): T[] {
    const result = this._array;
    this._array = [];
    return result;
  }

  /**
   * Attempts to insert a new value into the array at a position determined by the ordering.
   * The behavior differs based on the array's [[DuplicatePolicy]]:
   * If duplicates are **not** permitted, then:
   *  - If an equivalent element already exists in the array:
   *    - [[DuplicatePolicy.Retain]]: nothing will be inserted and the index of the existing element will be returned.
   *    - [[DuplicatePolicy.Replace]]: the input value will overwrite the existing element at the same index and that index will be returned.
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
  protected _insert(value: T, onInsert?: (value: T) => any): number {
    const bound = this.lowerBound(value);

    if (bound.equal) {
      switch (this._duplicatePolicy) {
        case DuplicatePolicy.Retain:
          return bound.index;
        case DuplicatePolicy.Replace:
          this._array[bound.index] = this._clone(value);
          if (onInsert)
            onInsert(value);

          return bound.index;
      }
    }

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
  protected _remove(value: T): number {
    const bound = this.lowerBound(value);
    if (bound.equal) {
      this._array.splice(bound.index, 1);
      return bound.index;
    } else {
      return -1;
    }
  }
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
 * @public
 */
export class SortedArray<T> extends ReadonlySortedArray<T> {
  /**
   * Construct a new SortedArray<T>.
   * @param compare The function used to compare elements within the array.
   * @param duplicatePolicy Policy for handling attempts to insert a value when an equivalent value already exists. If the input is a boolean, then `true` indicates [[DuplicatePolicy.Allow]], and `false` indicates [[DuplicatePolicy.Retain]].
   * @param clone The function invoked to clone a new element for insertion into the array. The default implementation simply returns its input.
   */
  public constructor(compare: OrderedComparator<T>, duplicatePolicy: DuplicatePolicy | boolean = false, clone: CloneFunction<T> = shallowClone) {
    super(compare, duplicatePolicy, clone);
  }

  /** Clears the contents of the sorted array. */
  public clear(): void { this._clear(); }

  /** Extracts the sorted array as a T[] and empties the contents of this SortedArray.
   * @returns the contents of this SortedArray as a T[].
   */
  public extractArray(): T[] { return this._extractArray(); }

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
  public insert(value: T, onInsert?: (value: T) => any): number { return this._insert(value, onInsert); }

  /**
   * Removes the first occurrence of a value comparing equal to the specified value from the array.
   * @param value The value of the element to delete
   * @returns the index of the deleted value, or -1 if no such element exists.
   */
  public remove(value: T): number { return this._remove(value); }
}
