/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * Basic comparison routine for numbers which treats two numbers as equal if the absolute value of their difference is less than the specified tolerance.
 * @hidden
 */
export function compareWithTolerance(a: number, b: number, tolerance = 0.1): number {
  if (a < b - tolerance)
    return -1;
  else if (a > b + tolerance)
    return 1;
  else
    return 0;
}

/** @hidden */
export function compareNumbers(a: number, b: number): number { return a - b; }

/** @hidden */
export function compareBooleans(a: boolean, b: boolean): number { return a !== b ? (a < b ? -1 : 1) : 0; }

/** @hidden */
export function compareStrings(a: string, b: string): number { return a === b ? 0 : (a < b ? -1 : 1); }

/** @hidden */
export function comparePossiblyUndefined<T>(compareDefined: (lhs: T, rhs: T) => number, lhs?: T, rhs?: T): number {
  if (undefined === lhs)
    return undefined === rhs ? 0 : -1;
  else if (undefined === rhs)
    return 1;
  else
    return compareDefined(lhs, rhs);
}

/** @hidden */
export function compareStringsOrUndefined(lhs?: string, rhs?: string): number { return comparePossiblyUndefined(compareStrings, lhs, rhs); }
