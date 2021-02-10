/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Collections
 */

import { OrderedComparator } from "./Compare";
import { CloneFunction, shallowClone, SortedArray } from "./SortedArray";

/** A read-only equivalent of `Set<T>` that maintains its elements in sorted order as specified by a comparison function.
 * Iteration returns elements in the order specified by the comparison function, as opposed to `Set` which returns elements in insertion order.
 * Implemented in terms of [[SortedArray]].
 * @public
 */
export class ReadonlyOrderedSet<T> implements Iterable<T> {
  protected readonly _array: SortedArray<T>;

  /** Construct a new ReadonlyOrderedSet<T>.
   * @param compare The function used to compare elements within the set, determining their ordering.
   * @param clone The function invoked to clone a new element for insertion into the set. The default implementation simply returns its input.
   */
  public constructor(compare: OrderedComparator<T>, clone: CloneFunction<T> = shallowClone) {
    this._array = new SortedArray<T>(compare, false, clone);
  }

  /** The number of elements in the set. */
  public get size(): number {
    return this._array.length;
  }

  /** Returns true if `value` is present in the set. */
  public has(value: T): boolean {
    return -1 !== this._array.indexOf(value);
  }

  /** Iterate over the elements in sorted order (as opposed to `Set`'s iterator, which returns elements in insertion order). */
  public [Symbol.iterator](): Iterator<T> {
    return this._array[Symbol.iterator]();
  }
}

/** A mutable [[ReadonlyOrderedSet]].
 * @public
 */
export class OrderedSet<T> extends ReadonlyOrderedSet<T> {
  /** Construct a new OrderedSet<T>.
   * @param compare The function used to compare elements within the set, determining their ordering.
   * @param clone The function invoked to clone a new element for insertion into the set. The default implementation simply returns its input.
   */
  public constructor(compare: OrderedComparator<T>, clone: CloneFunction<T> = shallowClone) {
    super(compare, clone);
  }

  /** Remove all elements from the set. */
  public clear(): void {
    this._array.clear();
  }

  /** Add the specified element to the set. Returns this set. */
  public add(value: T): this {
    this._array.insert(value);
    return this;
  }

  /** Removes the specified element from the set. Returns `true` if the element was present. */
  public delete(value: T): boolean {
    return -1 !== this._array.remove(value);
  }
}
