/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * Abstract class for custom data structures
 * @param list the wrapped array that this class support iteration over
 */
export abstract class Iterable<T> {
  constructor(protected _list: T[] = []) { }
  public [Symbol.iterator]() {
    let key = 0;
    return { next: (): IteratorResult<T> => { const result = key < this._list.length ? { value: this._list[key], done: false } : { value: this._list[key - 1], done: true }; key++; return result; } };
  }
}
