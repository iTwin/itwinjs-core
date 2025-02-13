/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

/**
 * Type for a OptionalGrowableFloat64Array or undefined.
 * @public
 */
export type OptionalGrowableFloat64Array = GrowableFloat64Array | undefined;
/**
 * Signature for a function which does lexical comparison of `blockSize` consecutive values as 2 starting indices.
 * @public
 */
export type BlockComparisonFunction = (data: Float64Array, blockSize: number, index0: number, index1: number) => number;
/**
 * A `GrowableFloat64Array` is Float64Array accompanied by a count of how many of the array's entries are considered in use.
 * * In C++ terms, this is like an std::vector
 * * As entries are added to the array, the buffer is reallocated as needed to accommodate.
 * * The reallocations leave unused space to accept further additional entries without reallocation.
 * * The `length` property returns the number of entries in use.
 * * the `capacity` property returns the (usually larger) length of the (over-allocated) Float64Array.
 * @public
 */
export class GrowableFloat64Array {
  private _data: Float64Array;
  private _inUse: number;
  private _growthFactor: number;

  /** Construct a GrowableFloat64Array.
   * @param initialCapacity initial capacity (default 8)
   * @param growthFactor used by ensureCapacity to expand requested reallocation size (default 1.5)
   */
  constructor(initialCapacity: number = 8, growthFactor?: number) {
    this._data = new Float64Array(initialCapacity);
    this._inUse = 0;
    this._growthFactor = (undefined !== growthFactor && growthFactor >= 1.0) ? growthFactor : 1.5;
  }

  /** Copy data from source array. Does not reallocate or change active entry count.
   * @param source array to copy from
   * @param sourceCount copy the first sourceCount entries; all entries if undefined
   * @param destOffset copy to instance array starting at this index; zero if undefined
   * @return count and offset of entries copied
   */
  protected copyData(source: Float64Array | number[], sourceCount?: number, destOffset?: number): {count: number, offset: number} {
    let myOffset = destOffset ?? 0;
    if (myOffset < 0)
      myOffset = 0;
    if (myOffset >= this._data.length)
      return {count: 0, offset: 0};
    let myCount = sourceCount ?? source.length;
    if (myCount > 0) {
      if (myCount > source.length)
        myCount = source.length;
      if (myOffset + myCount > this._data.length)
        myCount = this._data.length - myOffset;
    }
    if (myCount <= 0)
      return {count: 0, offset: 0};
    if (myCount === source.length)
      this._data.set(source, myOffset);
    else if (source instanceof Float64Array)
      this._data.set(source.subarray(0, myCount), myOffset);
    else
      this._data.set(source.slice(0, myCount), myOffset);
    return {count: myCount, offset: myOffset};
  }

  /**
   * Create a GrowableFloat64Array with given contents.
   * @param contents data to copy into the array
   */
  public static create(contents: Float64Array | number[]): GrowableFloat64Array {
    const out = new GrowableFloat64Array(contents.length);
    out.copyData(contents);
    out._inUse = contents.length;
    return out;
  }
  /** sort-compatible comparison.
   * * Returns `(a-b)` which is
   *   * negative if `a<b`
   *   * zero if `a === b` (with exact equality)
   *   * positive if `a>b`
   */
  public static compare(a: any, b: any): number {
    return a - b;
  }
  /** Return a new array with
   * * All active entries copied from this instance
   * * optionally trimmed capacity to the active length or replicate the capacity and unused space.
   */
  public clone(maintainExcessCapacity: boolean = false): GrowableFloat64Array {
    const out = new GrowableFloat64Array(maintainExcessCapacity ? this.capacity() : this._inUse);
    out.copyData(this._data, this._inUse);
    out._inUse = this._inUse;
    return out;
  }
  /**
   * Returns the number of entries in use.
   * * Note that this is typically smaller than the length of the length of the supporting `Float64Array`
   */
  public get length() {
    return this._inUse;
  }
  /**
   * Set the value at specified index.
   * @param index index of entry to set
   * @param value value to set
   */
  public setAtUncheckedIndex(index: number, value: number) {
    this._data[index] = value;
  }

  /**
   * Move the value at index i to index j.
   * @param i source index
   * @param j destination index.
   */
  public move(i: number, j: number) {
    this._data[j] = this._data[i];
  }
  /**
   * swap the values at indices i and j
   * @param i first index
   * @param j second index
   */
  public swap(i: number, j: number) {
    const a = this._data[i];
    this._data[i] = this._data[j];
    this._data[j] = a;
  }

  /**
   * append a single value to the array.
   * @param toPush value to append to the active array.
   */
  public push(toPush: number) {
    this.ensureCapacity(this._inUse + 1);
    this._data[this._inUse] = toPush;
    this._inUse++;
  }
  /**
   * Push each value from an array.
   * @param data array of values to push
   */
  public pushArray(data: Float64Array | number[]) {
    this.ensureCapacity(this._inUse + data.length);
    this.copyData(data, data.length, this._inUse);
    this._inUse += data.length;
  }
  /** Push `numToCopy` consecutive values starting at `copyFromIndex`. */
  public pushBlockCopy(copyFromIndex: number, numToCopy: number) {
    if (copyFromIndex >= 0 && copyFromIndex < this._inUse && numToCopy > 0 && copyFromIndex + numToCopy <= this._inUse) {
      this.ensureCapacity(this._inUse + numToCopy);
      this._data.copyWithin(this._inUse, copyFromIndex, copyFromIndex + numToCopy);
      this._inUse += numToCopy;
    }
  }
  /** Clear the array to 0 length.  The underlying memory remains allocated for reuse. */
  public clear() {
    this._inUse = 0;
  }
  /**
   * Returns the number of entries in the supporting Float64Array buffer.
   * * This number can be larger than the `length` property.
   */
  public capacity() {
    return this._data.length;
  }
  /**
   * * If the capacity (Float64Array length) is less than or equal to the requested newCapacity, do nothing.
   * * If the requested newCapacity is larger than the existing capacity, reallocate to larger capacity, and copy existing values.
   * @param newCapacity size of new array
   * @param applyGrowthFactor whether to apply the growth factor to newCapacity when reallocating
   */
  public ensureCapacity(newCapacity: number, applyGrowthFactor: boolean = true) {
    if (newCapacity > this.capacity()) {
      if (applyGrowthFactor)
        newCapacity *= this._growthFactor;
      const prevData = this._data;
      this._data = new Float64Array(newCapacity);
      this.copyData(prevData, this._inUse);
    }
  }
  /**
   * * If newLength is less than current length, just reset current length to newLength, effectively trimming active entries but preserving original capacity.
   * * If newLength is greater than current length, reallocate to (exactly) newLength, copy existing entries, and pad with padValue up to newLength.
   * @param newLength new data count
   * @param padValue value to use for padding if the length increases.
   */
  public resize(newLength: number, padValue: number = 0) {
    if (newLength >= 0 && newLength < this._inUse)
      this._inUse = newLength;
    else if (newLength > this._inUse) {
      this.ensureCapacity(newLength, false);
      this._data.fill(padValue, this._inUse);
      this._inUse = newLength;
    }
  }
  /**
   * * Reduce the length by one.
   * * Note that there is no method return value -- use `back` to get that value before `pop()`
   * * (As with std::vector, separating the `pop` from the value access eliminates error testing from `pop` call)
   */
  public pop() {
    // Could technically access outside of array, if filled and then reduced using pop (similar to C
    // and accessing out of bounds), but with adjusted inUse counter, that data will eventually be overwritten
    if (this._inUse > 0) {
      this._inUse--;
    }
  }
  /** Access by index, without bounds check */
  public atUncheckedIndex(index: number): number {
    return this._data[index];
  }
  /** Access the 0-index member, without bounds check */
  public front() {
    return this._data[0];
  }
  /** Access the final member, without bounds check */
  public back() {
    return this._data[this._inUse - 1];
  }
  /** set a value by index */
  public reassign(index: number, value: number) {
    this._data[index] = value;
  }

  /**
   * * Sort the array entries.
   * * Uses insertion sort -- fine for small arrays (less than 30), slow for larger arrays
   * @param compareMethod comparison method
   */
  public sort(compareMethod: (a: any, b: any) => number = (a, b) => GrowableFloat64Array.compare(a, b)) {
    for (let i = 0; i < this._inUse; i++) {
      for (let j = i + 1; j < this._inUse; j++) {
        const tempI = this._data[i];
        const tempJ = this._data[j];
        if (compareMethod(tempI, tempJ) > 0) {
          this._data[i] = tempJ;
          this._data[j] = tempI;
        }
      }
    }
  }

  /**
   * * compress out values not within the [a,b] interval.
   * * Note that if a is greater than b all values are rejected.
   * @param a low value for accepted interval
   * @param b high value for accepted interval
   */
  public restrictToInterval(a: number, b: number) {
    const data = this._data;
    const n = data.length;
    let numAccept = 0;
    let q = 0;
    for (let i = 0; i < n; i++) {
      q = data[i];
      if (q >= a && q <= b)
        data[numAccept++] = q;
    }
    this._inUse = numAccept;
  }

  /**
   * * compress out multiple copies of values.
   * * this is done in the current order of the array.
   */
  public compressAdjacentDuplicates(tolerance: number = 0.0) {
    const data = this._data;
    const n = this._inUse;
    if (n === 0)
      return;

    let numAccepted = 1;
    let a = data[0];
    let b;
    for (let i = 1; i < n; i++) {
      b = data[i];
      if (Math.abs(b - a) > tolerance) {
        data[numAccepted++] = b;
        a = b;
      }
    }
    this._inUse = numAccepted;
  }

}
