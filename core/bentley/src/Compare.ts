/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * Basic comparison routine for numbers
 * Uses a default tolerance of 0.1 that can be overridden by supplying a third parameter
 */
export function compareWithTolerance(a: number, b: number, tolerance = 0.1): number {
  if (a < b - tolerance)
    return -1;
  else if (a > b + tolerance)
    return 1;
  else
    return 0;
}

export function compareNumbers(a: number, b: number): number { return a - b; }

export function compareBooleans(a: boolean, b: boolean): number { return a !== b ? (a < b ? -1 : 1) : 0; }

export interface Comparable<T> {
  equals(rhs: T): boolean;
  compare(rhs: T): number;
}

export function compareObj<T extends Comparable<T>>(lhs: T, rhs: T): number { return lhs.compare(rhs); }
