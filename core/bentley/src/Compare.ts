/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/**
 * A function that returns a numerical value indicating how two objects are ordered in relation to one another.
 * Such functions are used by various collection classes throughout the library.
 * Given values `lhs` and `rhs`, the function returns:
 *  - Zero if lhs == rhs
 *  - A negative number if lhs < rhs
 *  - A positive number if lhs > rhs
 *
 * An OrderedComparator `must` implement [strict weak ordering](https://en.wikipedia.org/wiki/Weak_ordering#Strict_weak_orderings), which can be summarized by the following rules:
 *  - `compare(x, x)` returns zero.
 *  - If `compare(x, y)` returns zero, then so does `compare(y, x)` (i.e., `x == y` implies `y == x`).
 *  - If `compare(x, y)` returns non-zero, then `compare(y, x)` returns a value with an opposite sign (i.e., `x < y` implies `y > x`).
 *  - If `compare(x, y)` and `compare(y, z)` return non-zero values with the same sign, then `compare(x, z)` returns a value with the same sign (i.e., `x < y < z` implies `x < z`).
 *
 * @see SortedArray
 * @see Dictionary
 * @see IndexMap
 * @see PriorityQueue
 * @public
 */
export type OrderedComparator<T, U = T> = (lhs: T, rhs: U) => number;

/**
 * An [[OrderedComparator]] for numbers that treats two numbers as equal if the absolute value of their difference is less than a specified tolerance.
 * @public
 */
export function compareWithTolerance(a: number, b: number, tolerance = 0.1): number {
  if (a < b - tolerance)
    return -1;
  else if (a > b + tolerance)
    return 1;
  else
    return 0;
}

/** @public */
export function compareNumbers(a: number, b: number): number {
  return a - b;
}

/** @public */
export function compareBooleans(a: boolean, b: boolean): number {
  return a !== b ? (a < b ? -1 : 1) : 0;
}

/** @public */
export function compareStrings(a: string, b: string): number {
  return a === b ? 0 : (a < b ? -1 : 1);
}

/** @public */
export function comparePossiblyUndefined<T>(compareDefined: (lhs: T, rhs: T) => number, lhs?: T, rhs?: T): number {
  if (undefined === lhs)
    return undefined === rhs ? 0 : -1;
  else if (undefined === rhs)
    return 1;
  else
    return compareDefined(lhs, rhs);
}

/** @public */
export function compareStringsOrUndefined(lhs?: string, rhs?: string): number {
  return comparePossiblyUndefined(compareStrings, lhs, rhs);
}

/** @public */
export function compareNumbersOrUndefined(lhs?: number, rhs?: number): number {
  return comparePossiblyUndefined(compareNumbers, lhs, rhs);
}

/** @public */
export function compareBooleansOrUndefined(lhs?: boolean, rhs?: boolean): number {
  return comparePossiblyUndefined(compareBooleans, lhs, rhs);
}

/** Compare two possibly-undefined values for equality. If both are undefined, the comparison is performed by the supplied `areEqual` function.
 * @public
 */
export function areEqualPossiblyUndefined<T, U>(t: T | undefined, u: U | undefined, areEqual: (t: T, u: U) => boolean): boolean {
  if (undefined === t)
    return undefined === u;
  else if (undefined === u)
    return false;
  else
    return areEqual(t, u);
}

/**
 * Compare two simples types (number, string, boolean)
 * This essentially wraps the existing type-specific comparison functions
 * @beta */
export function compareSimpleTypes(lhs: number | string | boolean, rhs: number | string | boolean): number {
  let cmp = 0;

  // Make sure the types are the same
  cmp = compareStrings(typeof lhs, typeof rhs);
  if (cmp !== 0) {
     return cmp;
  }

  // Compare actual values
  switch (typeof lhs) {
    case "number":
      return compareNumbers(lhs, rhs as number);
    case "string":
      return compareStrings(lhs, rhs as string);
    case "boolean":
      return compareBooleans(lhs, rhs as boolean);
  }
  return cmp;
}
/**
 * An array of simple types (number, string, boolean)
 * @beta
 */
export type SimpleTypesArray = number[] | string[] | boolean[];

/**
 * Compare two arrays of simple types (number, string, boolean)
 * @beta
 */

export function compareSimpleArrays (lhs?: SimpleTypesArray, rhs?: SimpleTypesArray ) {
  if (undefined === lhs)
    return undefined === rhs ? 0 : -1;
  else if (undefined === rhs)
    return 1;
  else if (lhs.length === 0 && rhs.length === 0) {
    return 0;
  } else if (lhs.length !== rhs.length) {
    return lhs.length - rhs.length;
  }

  let cmp = 0;
  for (let i = 0; i < lhs.length; i++) {
    cmp = compareSimpleTypes(lhs[i], rhs[i]);
    if (cmp !== 0) {
      break;
    }
  }
  return cmp;
}

/** Compare two arrays of the same type `T` using the specified `compare` function to compare each pair of array elements.
 * @returns 0 if the arrays have the same length and `compare` returns 0 for each pair of elements, or a non-zero value if the arrays differ in length or contents.
 * @public
 */
export function compareArrays<T>(lhs: ReadonlyArray<T>, rhs: ReadonlyArray<T>, compare: (a: T, b: T) => number): number {
  let diff = compareNumbers(lhs.length, rhs.length);
  if (!diff) {
    for (let i = 0; i < lhs.length; i++) {
      diff = compare(lhs[i], rhs[i]);
      if (diff) {
        break;
      }
    }
  }

  return diff;
}
