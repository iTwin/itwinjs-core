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
export function compareNumbers(a: number, b: number): number { return a - b; }

/** @public */
export function compareBooleans(a: boolean, b: boolean): number { return a !== b ? (a < b ? -1 : 1) : 0; }

/** @public */
export function compareStrings(a: string, b: string): number { return a === b ? 0 : (a < b ? -1 : 1); }

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
export function compareStringsOrUndefined(lhs?: string, rhs?: string): number { return comparePossiblyUndefined(compareStrings, lhs, rhs); }

/** @public */
export function compareNumbersOrUndefined(lhs?: number, rhs?: number): number { return comparePossiblyUndefined(compareNumbers, lhs, rhs); }

/** @public */
export function compareBooleansOrUndefined(lhs?: boolean, rhs?: boolean): number { return comparePossiblyUndefined(compareBooleans, lhs, rhs); }

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
