/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

import { defaultClone, lowerBound } from "./SortedArray";

export class IndexedValue<T> {
  public readonly value: T;
  public readonly index: number;;

  public constructor(value: T, index: number) {
    this.value = value;
    this.index = index;
  }
}

export class IndexMap<T> {
  protected array: IndexedValue<T>[] = [];
  protected readonly compareValues: (lhs: T, rhs: T) => number;
  protected readonly clone: (src: T) => T;
  protected readonly maximumSize: number;

  public constructor(compare: (lhs: T, rhs: T) => number, maximumSize: number = Number.MAX_SAFE_INTEGER, clone: (src: T) => T = defaultClone) {
    this.compareValues = compare;
    this.clone = clone;
    this.maximumSize = maximumSize;
  }

  public get length(): number { return this.array.length; }
  public get isFull(): boolean { return this.length >= this.maximumSize; }
  public get isEmpty(): boolean { return 0 === this.length; }

  public clear(): void { this.array = []; }

  public insert(value: T): number {
    const bound = this.lowerBound(value);
    if (bound.equal)
      return this.array[bound.index].index;
    else if (this.isFull)
      return -1;

    const entry = new IndexedValue<T>(this.clone(value), this.array.length);
    this.array.splice(bound.index, 0, entry);
    return entry.index;
  }

  public indexOf(value: T): number {
    const bound = this.lowerBound(value);
    return bound.equal ? this.array[bound.index].index : -1;
  }

  protected compare(lhs: T, rhs: IndexedValue<T>): number { return this.compareValues(lhs, rhs.value); }
  protected lowerBound(value: T): { index: number, equal: boolean } { return lowerBound(value, this.array, this.compare); }
}
