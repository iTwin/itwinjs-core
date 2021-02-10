/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Ids
 */

import { assert } from "./Assert";
import { CompressedId64Set } from "./CompressedId64Set";
import { Id64Array, Id64String } from "./Id";

/** A collection of **valid** [[Id64String]]s sorted in ascending order by the unsigned 64-bit integer value of the Ids.
 * This ordering is a requirement for several groups of APIs including [[CompressedId64Set]].
 * When used as input to a function, duplicate Ids are ignored; when returned as a function output, no duplicates are present.
 * @see [[CompressedId64Set]] for a compact string representation of such an ordered collection.
 * @see [[OrderedId64Iterable.compare]] for a function that compares Ids based on this criterion.
 * @beta
 */
export type OrderedId64Iterable = Iterable<Id64String>;

/** A collection of **valid** [[Id64String]]s sorted in ascending order by the unsigned 64-bit integer value of the Ids.
 * This ordering is a requirement for several groups of APIs including [[CompressedId64Set]].
 * When used as input to a function, duplicate Ids are ignored; when returned as a function output, no duplicates are present.
 * @see [[CompressedId64Set]] for a compact string representation of such an ordered collection.
 * @see [[OrderedId64Iterable.compare]] for a function that compares Ids based on this criterion.
 * @beta
 */
export namespace OrderedId64Iterable { // eslint-disable-line @typescript-eslint/no-redeclare
  /** An ordered comparison of [[Id64String]]s suitable for use with sorting routines like `Array.sort` and sorted containers
   * like [[SortedArray]] and [[Dictionary]]. The comparison compares the 64-bit numerical values of the two Ids, returning a negative number if lhs < rhs,
   * a positive number if lhs > rhs, or zero if lhs == rhs.
   * The default string comparison is fine (and more efficient) when numerical ordering is not required; use this instead if you want e.g., "0x100" to be greater than "0xf".
   * @see [[OrderedId64Iterable.sortArray]] for a convenient way to sort an array of Id64Strings.
   * @beta
   */
  export function compare(lhs: Id64String, rhs: Id64String): number {
    if (lhs.length !== rhs.length)
      return lhs.length < rhs.length ? -1 : 1;

    // This is faster than localeCompare(). Unclear why there is no string.compare() - would be generally useful in
    // array sort functions...
    if (lhs !== rhs)
      return lhs < rhs ? -1 : 1;

    return 0;
  }

  /** Sort an array of [[Id64String]]s **in-place** in ascending order by their 64-bit numerical values.
   * @see [[OrderedId64Iterable.compare]] for the comparison routine used.
   * @returns the input array.
   * @note This function returns its input for consistency with Javascript's `Array.sort` method. It **does not** create a **new** array.
   * @beta
   */
  export function sortArray(ids: Id64Array): Id64Array {
    ids.sort((x, y) => compare(x, y));
    return ids;
  }

  /** Given two ordered collections of Ids, determine whether they are identical sets. Duplicate Ids are ignored.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function areEqualSets(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable): boolean {
    const leftIter = uniqueIterator(ids1);
    const rightIter = uniqueIterator(ids2);
    let leftState = leftIter.next();
    let rightState = rightIter.next();

    while (!leftState.done && !rightState.done) {
      const left = leftState.value;
      const right = rightState.value;
      if (0 !== compare(left, right))
        return false;

      leftState = leftIter.next();
      rightState = rightIter.next();
    }

    if (leftState.done && rightState.done)
      return true;

    return false;
  }

  /** Given an ordered collection of Ids, determine if it contains any Ids.
   * @param ids A well-formed, ordered collection of zero or more valid Ids.
   * @returns true if the input represents an empty set of Ids. The result is unspecified if the input does not meet the criteria for the input type.
   * @beta
   */
  export function isEmptySet(ids: OrderedId64Iterable | CompressedId64Set): boolean {
    if (typeof ids === "string")
      return "" === ids;

    return true === ids[Symbol.iterator]().next().done;
  }

  /** Given an ordered collection of Ids possibly containing duplicates, produce an ordered collection containing no duplicates.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function unique(ids: OrderedId64Iterable): OrderedId64Iterable {
    return { [Symbol.iterator]: () => uniqueIterator(ids) };
  }

  /** Given an ordered collection of Ids possibly containing duplicates, produce an ordered iterator over the distinct Ids, eliminating duplicates.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function* uniqueIterator(ids: OrderedId64Iterable) {
    const iter = ids[Symbol.iterator]();
    let state = iter.next();
    let prev: Id64String | undefined;

    while (!state.done) {
      const id = state.value;
      state = iter.next();
      if (id !== prev) {
        prev = id;
        yield id;
      }
    }
  }

  /** Given two ordered collections of Ids, produce a collection representing their union - i.e., the Ids that are present in either or both collections.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function union(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable): OrderedId64Iterable {
    return { [Symbol.iterator]: () => unionIterator(ids1, ids2) };
  }

  /** Given two ordered collections of Ids, produce an iterator representing their intersection - i.e., the Ids that are present in both collections.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function intersection(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable): OrderedId64Iterable {
    return { [Symbol.iterator]: () => intersectionIterator(ids1, ids2) };
  }

  /** Given two ordered collections of Ids, produce an iterator representing their difference - i.e., the Ids that are present in `ids1` but not present in `ids2`.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function difference(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable): OrderedId64Iterable {
    return { [Symbol.iterator]: () => differenceIterator(ids1, ids2) };
  }

  /** Given two ordered collections of Ids, produce an iterator representing their union - i.e., the Ids that are present in either or both collections.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function* unionIterator(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable) {
    const leftIter = ids1[Symbol.iterator]();
    const rightIter = ids2[Symbol.iterator]();
    let leftState = leftIter.next();
    let rightState = rightIter.next();

    let prev: string | undefined;
    while (!leftState.done || !rightState.done) {
      const left = leftState.done ? undefined : leftState.value;
      const right = rightState.done ? undefined : rightState.value;

      assert(undefined !== left || undefined !== right);
      if (undefined === left && undefined === right)
        break;

      let next: Id64String;
      if (undefined === left) {
        assert(undefined !== right);
        next = right;
        rightState = rightIter.next();
      } else if (undefined === right) {
        next = left;
        leftState = leftIter.next();
      } else {
        const cmp = compare(left, right);
        if (cmp <= 0) {
          next = left;
          leftState = leftIter.next();
          if (0 === cmp)
            rightState = rightIter.next();
        } else {
          next = right;
          rightState = rightIter.next();
        }
      }

      if (prev === next)
        continue;

      prev = next;
      yield next;
    }
  }

  /** Given two ordered collections of Ids, produce an iterator representing their intersection - i.e., the Ids that are present in both collections.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function* intersectionIterator(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable) {
    const leftIter = ids1[Symbol.iterator]();
    const rightIter = ids2[Symbol.iterator]();
    let leftState = leftIter.next();
    let rightState = rightIter.next();

    let prev: string | undefined;
    while (!leftState.done && !rightState.done) {
      const left = leftState.value;
      leftState = leftIter.next();
      if (left === prev)
        continue;

      prev = left;

      let right = rightState.value;
      let cmp = compare(left, right);
      while (cmp > 0) {
        rightState = rightIter.next();
        if (rightState.done)
          return;

        right = rightState.value;
        cmp = compare(left, right);
      }

      if (0 === cmp)
        yield left;
    }
  }

  /** Given two ordered collections of Ids, produce an iterator representing their difference - i.e., the Ids that are present in `ids1` but not present in `ids2`.
   * @note If the inputs are not ordered as required by [[OrderedId64Iterable]], the results are unpredictable.
   * @beta
   */
  export function* differenceIterator(ids1: OrderedId64Iterable, ids2: OrderedId64Iterable) {
    const leftIter = ids1[Symbol.iterator]();
    const rightIter = ids2[Symbol.iterator]();
    let leftState = leftIter.next();
    let rightState = rightIter.next();

    let prev: string | undefined;
    while (!leftState.done) {
      const left = leftState.value;
      leftState = leftIter.next();
      if (left === prev)
        continue;
      else if (rightState.done) {
        yield prev = left;
        continue;
      }

      let right = rightState.value;
      let cmp = compare(left, right);
      while (cmp > 0 && !rightState.done) {
        rightState = rightIter.next();
        if (rightState.done) {
          yield prev = left;
          continue;
        }

        right = rightState.value;
        cmp = compare(left, right);
      }

      if (cmp < 0)
        yield prev = left;
    }
  }
}
