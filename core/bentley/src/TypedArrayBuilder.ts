/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { Constructor } from "./UtilityTypes";
import { assert } from "./Assert";

/** Options used to construct a [[TypedArrayBuilder]].
 * @public
 */
export interface TypedArrayBuilderOptions {
  /** Controls how much additional memory is allocated when the TypedArray needs to be resized to accomodate more elements.
   * [[TypedArrayBuilder.ensureCapacity]] multiplies the required capacity by this factor to determine the new capacity.
   * Default: 1.5
   * Minimum: 1.0, which causes the TypedArray to allocate exactly the space it needs each time it is resized.
   */
  growthFactor?: number;
  /** The number of elements to allocate memory for in the TypedArray when creating the builder.
   * If you know the minimum number of elements you intend to add to the builder, you should specify that as the
   * initial capacity to avoid reallocations when populating the array.
   * Default: 0.
   * Minimum: 0.
   */
  initialCapacity?: number;
}

/** Incrementally builds a [TypedArray] of unsigned 8-, 16-, or 32-bit integers.
 * Sometimes you wish to populate a `TypedArray`, but you don't know how many elements you will need.
 * `TypedArray` requires you to specify the size upon construction, and does not permit you to change the size later.
 *
 * `TypedArrayBuilder` manages a `TypedArray`, permitting you to [[push]] and [[append]] elements to it. It exposes two "size" properties":
 *  - [[capacity]], the number of elements it has currently allocated space for - i.e., the length of the underlying TypedArray; and
 *  - [[length]], the number of elements that have so far been added to it, which is never bigger than [[capacity]].
 * When [[capacity]] is exceeded, a new, bigger TypedArray is allocated and the contents of the previous array are copied over to it.
 *
 * Once you've finished adding elements, you can obtain the finished `TypedArray` via [[toTypedArray]].
 * @see [[Uint8ArrayBuilder]], [[Uint16ArrayBuilder]], and [[Uint32ArrayBuilder]] to build specific types of arrays.
 * @public
 */
export class TypedArrayBuilder<T extends Uint8Array | Uint16Array | Uint32Array> {
  /** The constructor for the specific type of array being populated. */
  protected readonly _constructor: Constructor<T>;
  /** The underlying typed array, to be reallocated and copied when its capacity is exceeded. */
  protected _data: T;
  /** The number of elements added to the array so far. */
  protected _length: number;
  /** Multiplier applied to required capacity by [[ensureCapacity]]. */
  public readonly growthFactor: number;

  /** Constructs a new builder from the specified options, with a [[length]] of zero. */
  protected constructor(constructor: Constructor<T>, options?: TypedArrayBuilderOptions) {
    this._constructor = constructor;
    this._data = new constructor(options?.initialCapacity ?? 0);
    this.growthFactor = Math.max(1.0, options?.growthFactor ?? 1.5);
    this._length = 0;
  }

  /** The number of elements currently in the array. */
  public get length(): number {
    return this._length;
  }

  /** The number of elements that can fit into the memory currently allocated for the array. */
  public get capacity(): number {
    return this._data.length;
  }

  /** Like [TypedArray.at](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/at),
   * returns the element at the specified index, with negative integers counting back from the end of the array.
   * @note It is your responsibility to ensure the index falls within the bounds of the array.
   */
  public at(index: number): number {
    if (index < 0)
      index = this.length - index;

    const value = this._data[index];
    assert(value !== undefined, "index out of bounds");
    return value;
  }

  /** Ensure that [[capacity]] is at least equal to `newCapacity`.
   * This is used internally by methods like [[push]] and [[append]] to ensure the array has room for the element(s) to be added.
   * It can also be useful when you know you intend to add some number of additional elements, to minimize reallocations.
   *
   * If `newCapacity` is not greater than the current [[capacity]], this function does nothing.
   * Otherwise, it allocates a new `TypedArray` with room for `newCapacity * growthFactor` elements, and copies the contents of the previous `TypedArray` into it.
   * [[length]] remains unchanged; [[capacity]] reflects the size of the new TypeArray.
   */
  public ensureCapacity(newCapacity: number): number {
    if (this.capacity >= newCapacity)
      return this.capacity;

    assert(this.growthFactor >= 1.0);
    newCapacity = Math.ceil(newCapacity * this.growthFactor);
    const prevData = this._data;
    this._data = new this._constructor(newCapacity);
    this._data.set(prevData, 0);

    assert(this.capacity === newCapacity);
    return this.capacity;
  }

  /** Append the specified value, resizing if necessary. */
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

  /** Obtain the finished array.
   * @param includeUnusedCapacity If true, the length of the returned array will be equal to [[capacity]], with extra bytes initialized to zero; otherwise, the
   * returned array's length will be equal to [[length]].
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

/** A [[TypedArrayBuilder]] for producing a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).
 * @public
 */
export class Uint8ArrayBuilder extends TypedArrayBuilder<Uint8Array> {
  /** @see [[TypedArrayBuilder]] constructor. */
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint8Array, options);
  }
}

/** A [[TypedArrayBuilder]] for producing a [Uint16Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array).
 * @public
 */
export class Uint16ArrayBuilder extends TypedArrayBuilder<Uint16Array> {
  /** @see [[TypedArrayBuilder]] constructor. */
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint16Array, options);
  }
}

/** A [[TypedArrayBuilder]] for producing a [Uint32Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array).
 * @public
 */
export class Uint32ArrayBuilder extends TypedArrayBuilder<Uint32Array> {
  /** @see [[TypedArrayBuilder]] constructor. */
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint32Array, options);
  }

  /** Obtain a view of the finished array as an array of bytes. */
  public toUint8Array(includeUnusedCapacity = false): Uint8Array {
    if (includeUnusedCapacity)
      return new Uint8Array(this._data.buffer);

    return new Uint8Array(this._data.buffer, 0, this.length * 4);
  }
}
