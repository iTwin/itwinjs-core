/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * Abstract class for custom data structures
 * @param list the wrapped array that this class support iteration over
 */
export abstract class Iterable<T> {
  constructor(protected list: T[]) { }
  public [Symbol.iterator]() {
    let key = 0;
    return { next: (): IteratorResult<T> => { const result = key < this.list.length ? { value: this.list[key], done: false } : { value: this.list[key - 1], done: true }; key++; return result; } };
  }
}
