/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { iComparator } from "../runtime/iComparator";

/**
 * Class AList defines a typed list of elements.
 */
/** @internal */
export class AList<T> {
  private _elements: Array<T>;

  public constructor(capacity: number = 10) {
    this._elements = [];
  }

  public size(): int32 {
    return this._elements.length;
  }

  public add(element: T): void {
    this._elements.push(element);
  }

  public addAt(index: number, element: T): void {
    this._elements.splice(index, 0, element);
  }

  public remove(index: int32): void {
    this._elements.splice(index, 1);
  }

  public get(index: int32): T {
    return this._elements[index];
  }

  public indexOf(element: T): int32 {
    for (let i: number = 0; i < this._elements.length; i++)
      if (this._elements[i] === element) return i;
    return -1;
  }

  public contains(element: T): boolean {
    return this.indexOf(element) >= 0;
  }

  public clear(): void {
    this._elements.splice(0, this._elements.length);
  }

  public sort(comparator: iComparator<T>): void {
    this._elements.sort(function (o1: T, o2: T) {
      return comparator.compare(o1, o2);
    });
  }

  public toArray(holder: any): Array<T> {
    return this._elements;
  }

  /**
   * Get an iterator to use in "for of" loops.
   */
  [Symbol.iterator]() {
    let iteratorList: Array<T> = this._elements;
    let index: number = 0;
    return {
      next(): IteratorResult<T> {
        if (index < iteratorList.length) {
          return { done: false, value: iteratorList[index++] };
        } else {
          return { done: true, value: null };
        }
      },
    };
  }
}
