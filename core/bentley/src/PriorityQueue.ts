/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Collections */

import { CloneFunction, shallowClone } from "./SortedArray";
import { OrderedComparator } from "./Compare";

export type ComputePriorityFunction<T> = (value: T) => number;

/**
 * A [priority queue](https://en.wikipedia.org/wiki/Priority_queue) implemented as a heap array.
 * The queue is ordered by an [[OrderedComparator]] function supplied by the user such that the value in the queue that compares less than all other values is always located at the front of the queue.
 */
export class PriorityQueue<T> {
  protected _array: T[] = [];
  protected readonly _compare: OrderedComparator<T>;
  protected readonly _clone: CloneFunction<T>;

  /**
   * Constructor
   * @param compare The function used to compare values in the queue. If `compare(x, y)` returns a negative value, then x is placed before y in the queue.
   * @param clone The function used to clone a value for insertion onto the queue. The default implementation simply returns its input.
   * @note If the criterion which control the result of the `compare` function changes, then [[PriorityQueue.sort]] should be used to reorder the queue according to the new criterion.
   */
  public constructor(compare: OrderedComparator<T>, clone: CloneFunction<T> = shallowClone) {
    this._compare = compare;
    this._clone = clone;
  }

  /** The number of values in the queue. */
  public get length(): number { return this._array.length; }

  /** Returns true if the queue contains no values. */
  public get isEmpty(): boolean { return 0 === this.length; }

  protected _swap(a: number, b: number) {
    const temp = this._array[a];
    this._array[a] = this._array[b];
    this._array[b] = temp;
  }

  protected _heapify(index: number): void {
    let candidate = -1;
    while (true) {
      const right = 2 * (index + 1);
      const left = right - 1;
      if (left < this.length && this._compare(this._array[left], this._array[index]) < 0)
        candidate = left;
      else
        candidate = index;

      if (right < this.length && this._compare(this._array[right], this._array[candidate]) < 0)
        candidate = right;

      if (candidate !== index) {
        this._swap(candidate, index);
        index = candidate;
      } else {
        break;
      }
    }
  }

  /**
   * Reorders the queue. This function should only (and *always*) be called when the criteria governing the ordering of items on the queue have changed.
   * For example, a priority queue containing graphics sorted by their distance from the camera would need to be reordered when the position of the camera changes.
   */
  public sort(): void {
    for (let i = Math.ceil(this.length / 2); i >= 0; i--)
      this._heapify(i);
  }

  /**
   * Pushes a value onto the queue according to the sorting criterion.
   * @param value The value to insert
   * @returns The inserted value, cloned according to the [[CloneFunction]] supplied to this queue's constructor.
   */
  public push(value: T): T {
    const clone = this._clone(value);

    let index = this.length;
    this._array.push(clone);

    while (index !== 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this._compare(this._array[index], this._array[parent]) < 0) {
        this._swap(index, parent);
        index = parent;
      } else {
        break;
      }
    }

    return clone;
  }

  /** Returns the element at the front of the queue, or `undefined` if the queue is empty. */
  public get front(): T | undefined {
    return this._peek(0);
  }

  /**
   * Removes the front-most element off of the queue and returns it.
   * @returns The front-most element, or undefined if the queue is empty.
   */
  public pop(): T | undefined {
    return this._pop(0);
  }

  /** Removes all values from the queue. */
  public clear(): void {
    this._array.length = 0;
  }

  /**
   * Removes the value at the specified index from the queue and reorders the queue.
   * @param index The index of the value to remove
   * @returns the value at the specified index, or undefined if the index is out of range.
   */
  protected _pop(index: number): T | undefined {
    if (index < 0 || index >= this.length)
      return undefined;

    const root = this._array[index];
    this._swap(index, this.length - 1);
    this._array.length--;

    this._heapify(index);
    return root;
  }

  /**
   * Returns the value at the specified index in the queue.
   * @param index The index of the value to retrieve
   * @returns the value at the specified index, or undefined if the index is out of range.
   */
  protected _peek(index: number): T | undefined {
    if (index < 0 || index >= this.length)
      return undefined;
    else
      return this._array[index];
  }
}
