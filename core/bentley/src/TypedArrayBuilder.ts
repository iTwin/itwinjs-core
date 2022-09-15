/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { Constructor } from "./UtilityTypes";
import { assert } from "./Assert";

export interface TypedArrayBuilderOptions {
  growthFactor?: number;
  initialCapacity?: number;
}

/** Incrementally builds an array of unsigned 8-, 16-, or 32-bit integers.
 * ###TODO move to core-bentley package?
 */
export class TypedArrayBuilder<T extends Uint8Array | Uint16Array | Uint32Array> {
  protected readonly _constructor: Constructor<T>;
  protected _data: T;
  protected _length: number;
  protected readonly _growthFactor: number;

  protected constructor(constructor: Constructor<T>, options?: TypedArrayBuilderOptions) {
    this._constructor = constructor;
    this._data = new constructor(options?.initialCapacity ?? 0);
    this._growthFactor = Math.max(1.0, options?.growthFactor ?? 1.5);
    this._length = 0;
  }

  /** The number of integer values currently in the array. */
  public get length(): number {
    return this._length;
  }

  /** The number of integers that can fit in the memory currently allocated for the array. */
  public get capacity(): number {
    return this._data.length;
  }

  /** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/at */
  public at(index: number): number {
    if (index < 0)
      index = this.length - index;

    const value = this._data[index];
    assert(value !== undefined, "index out of bounds");
    return value;
  }

  /** Ensure that [[capacity]] is at least equal to `newCapacity`. */
  public ensureCapacity(newCapacity: number): number {
    if (this.capacity >= newCapacity)
      return this.capacity;

    assert(this._growthFactor >= 1.0);
    newCapacity = Math.ceil(newCapacity * this._growthFactor);
    const prevData = this._data;
    this._data = new this._constructor(newCapacity);
    this._data.set(prevData, 0);

    assert(this.capacity === newCapacity);
    return this.capacity;
  }

  /** Append an integer, resizing if necessary. */
  public push(value: number): void {
    this.ensureCapacity(this.length + 1);
    this._data[this.length] = value;
    ++this._length;
  }

  /** Append an array of values, resizing (at most once) if necessary. */
  public append(values: T): void {
    const newLength = this.length + values.length;
    this.ensureCapacity(newLength);
    this._data.set(values, this.length);
    this._length = newLength;
  }

  /** Obtain the finished array. Note: this may return a direct reference to the underlying typed array, or a copy.
   * If `includeUnusedCapacity` is true then additional memory that was allocated but not used will be included.
   */
  public toTypedArray(includeUnusedCapacity = false): T {
    if (includeUnusedCapacity)
      return this._data;

    const subarray = this._data.subarray(0, this.length);
    assert(subarray instanceof this._constructor);
    assert(subarray.buffer === this._data.buffer);
    return subarray;
  }
}

export class Uint8ArrayBuilder extends TypedArrayBuilder<Uint8Array> {
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint8Array, options);
  }
}

export class Uint16ArrayBuilder extends TypedArrayBuilder<Uint16Array> {
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint16Array, options);
  }
}

export class Uint32ArrayBuilder extends TypedArrayBuilder<Uint32Array> {
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint32Array, options);
  }

  public toUint8Array(includeUnusedCapacity = false): Uint8Array {
    if (includeUnusedCapacity)
      return new Uint8Array(this._data.buffer);

    return new Uint8Array(this._data.buffer, 0, this.length * 4);
  }
}


