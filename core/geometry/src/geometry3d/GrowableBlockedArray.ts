/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { BlockComparisonFunction } from "./GrowableFloat64Array";

/**
 * Array of contiguous doubles, indexed by block number and index within block.
 * * This is essentially a rectangular matrix (two dimensional array), with each block being a row of the matrix.
 * @public
 */
export class GrowableBlockedArray {
  /** underlying contiguous, oversized buffer. */
  protected _data: Float64Array;
  /** Number of blocks (matrix rows) in use. */
  protected _inUse: number;
  /** number of numbers per block in the array.
   * * If viewing the array as a two dimensional array, this is the row size.
   */
  protected _blockSize: number;  // positive integer !!!
  /**
   * multiplier used by ensureBlockCapacity to expand requested reallocation size
   */
  protected _growthFactor: number;

  /**
   * Construct an array whose contents are in blocked (row-major) order, possibly with extra capacity.
   * * Total capacity is `this._data.length`
   * * Actual in-use count is `this._inUse * this._blockSize`
   * @param blockSize number of entries in each block, i.e., row size
   * @param initialBlocks initial capacity in blocks (default 8)
   * @param growthFactor used by ensureBlockCapacity to expand requested reallocation size (default 1.5)
   */
  public constructor(blockSize: number, initialBlocks: number = 8, growthFactor?: number) {
    this._data = new Float64Array(initialBlocks * blockSize);
    this._inUse = 0;
    this._blockSize = blockSize > 0 ? blockSize : 1;
    this._growthFactor = (undefined !== growthFactor && growthFactor >= 1.0) ? growthFactor : 1.5;
  }

  /** Copy data from source array. Does not reallocate or change active block count.
   * @param source array to copy from
   * @param sourceCount copy the first sourceCount blocks; all blocks if undefined
   * @param destOffset copy to instance array starting at this block index; zero if undefined
   * @return count and offset of blocks copied
   */
  protected copyData(source: Float64Array | number[], sourceCount?: number, destOffset?: number): {count: number, offset: number} {
    // validate inputs and convert from blocks to entries
    let myOffset = (undefined !== destOffset) ? destOffset * this.numPerBlock : 0;
    if (myOffset < 0)
      myOffset = 0;
    if (myOffset >= this._data.length)
      return {count: 0, offset: 0};
    let myCount = (undefined !== sourceCount) ? sourceCount * this.numPerBlock : source.length;
    if (myCount > 0) {
      if (myCount > source.length)
        myCount = source.length;
      if (myOffset + myCount > this._data.length)
        myCount = this._data.length - myOffset;
      if (myCount % this.numPerBlock !== 0)
        myCount -= myCount % this.numPerBlock;
    }
    if (myCount <= 0)
      return {count: 0, offset: 0};
    if (myCount === source.length)
      this._data.set(source, myOffset);
    else if (source instanceof Float64Array)
      this._data.set(source.subarray(0, myCount), myOffset);
    else
      this._data.set(source.slice(0, myCount), myOffset);
    return {count: myCount / this.numPerBlock, offset: myOffset / this.numPerBlock};
  }

  /**
   * Make a copy of the (active) blocks in this array.
   * (The clone does NOT get excess capacity)
   */
  public clone(): GrowableBlockedArray {
    const newBlocks = new GrowableBlockedArray(this.numPerBlock, this.numBlocks, this._growthFactor);
    newBlocks.copyData(this._data, this.numBlocks);
    newBlocks._inUse = this.numBlocks;
    return newBlocks;
  }

  /** computed property: length (in blocks, not doubles) */
  public get length(): number { return this._inUse; }
  /** computed property: length (in blocks, not doubles) */
  public get numBlocks(): number { return this._inUse; }
  /** property: number of data values per block */
  public get numPerBlock(): number { return this._blockSize; }
  /**
   * Return a single value indexed within a block. Indices are unchecked.
   * @param blockIndex index of block to read
   * @param indexInBlock  offset within the block
   */
  public getWithinBlock(blockIndex: number, indexWithinBlock: number): number {
    return this._data[blockIndex * this._blockSize + indexWithinBlock];
  }
  /** clear the block count to zero, but maintain the allocated memory */
  public clear() { this._inUse = 0; }
  /** Return the capacity in blocks (not doubles) */
  public blockCapacity() {
    return this._data.length / this._blockSize;
  }
  /** ensure capacity (in blocks, not doubles) */
  public ensureBlockCapacity(blockCapacity: number, applyGrowthFactor: boolean = true) {
    if (blockCapacity > this.blockCapacity()) {
      if (applyGrowthFactor)
        blockCapacity *= this._growthFactor;
      const prevData = this._data;
      this._data = new Float64Array(blockCapacity * this._blockSize);
      this.copyData(prevData, this._inUse);
      }
  }
  /** Add a new block of data.
   * * If newData has fewer than numPerBlock entries, the remaining part of the new block is zeros.
   * * If newData has more entries, only the first numPerBlock are taken.
   */
  public addBlock(newData: number[]) {
    const k0 = this.newBlockIndex();
    let numValue = newData.length;
    if (numValue > this._blockSize)
      numValue = this._blockSize;
    for (let i = 0; i < numValue; i++)
      this._data[k0 + i] = newData[i];
  }
  /**
   * Return the starting index of a block of (zero-initialized) doubles at the end.
   *
   * * this.data is reallocated if needed to include the new block.
   * * The inUse count is incremented to include the new block.
   * * The returned block is an index to the Float64Array (not a block index)
   */
  protected newBlockIndex(): number {
    const index = this._blockSize * this._inUse;
    if ((index + 1) > this._data.length)
      this.ensureBlockCapacity(1 + this._inUse);
    this._inUse++;
    for (let i = index; i < index + this._blockSize; i++)
      this._data[i] = 0.0;
    return index;
  }
  /** reduce the block count by one. */
  public popBlock() {
    if (this._inUse > 0)
      this._inUse--;
  }
  /** convert a block index to the simple index to the underlying Float64Array. */
  protected blockIndexToDoubleIndex(blockIndex: number) { return this._blockSize * blockIndex; }
  /** Access a single double at offset within a block, with index checking and return undefined if indexing is invalid. */
  public checkedComponent(blockIndex: number, componentIndex: number): number | undefined {
    if (blockIndex >= this._inUse || blockIndex < 0 || componentIndex < 0 || componentIndex >= this._blockSize)
      return undefined;
    return this._data[this._blockSize * blockIndex + componentIndex];
  }
  /** Access a single double at offset within a block.  This has no index checking. */
  public component(blockIndex: number, componentIndex: number): number {
    return this._data[this._blockSize * blockIndex + componentIndex];
  }
  /** compare two blocks in simple lexical order.
   * @param data data array
   * @param blockSize number of items to compare
   * @param ia raw index (not block index) of first block
   * @param ib raw index (not block index) of second block
   */
  public static compareLexicalBlock(data: Float64Array, blockSize: number, ia: number, ib: number): number {
    let ax = 0;
    let bx = 0;
    for (let i = 0; i < blockSize; i++) {
      ax = data[ia + i];
      bx = data[ib + i];
      if (ax > bx) return 1;
      if (ax < bx) return -1;
    }
    return ia - ib; // so original order is maintained among duplicates !!!!
  }
  /** Return an array of block indices sorted per compareLexicalBlock function */
  public sortIndicesLexical(compareBlocks: BlockComparisonFunction = (dataArray, size, iA, iB) => GrowableBlockedArray.compareLexicalBlock(dataArray, size, iA, iB)): Uint32Array {
    const n = this._inUse;
    // let numCompare = 0;
    const result = new Uint32Array(n);
    const data = this._data;
    const blockSize = this._blockSize;
    for (let i = 0; i < n; i++)result[i] = i;
    result.sort(
      (blockIndexA: number, blockIndexB: number) => {
        // numCompare++;
        return compareBlocks(data, blockSize, blockIndexA * blockSize, blockIndexB * blockSize);
      });
    // console.log (n, numCompare);
    return result;
  }
  /** Return the distance (hypotenuse=sqrt(summed squares)) between indicated blocks */
  public distanceBetweenBlocks(blockIndexA: number, blockIndexB: number): number {
    let dd = 0.0;
    let iA = this.blockIndexToDoubleIndex(blockIndexA);
    let iB = this.blockIndexToDoubleIndex(blockIndexB);
    let a = 0;
    const data = this._data;
    for (let i = 0; i < this._blockSize; i++) {
      a = data[iA++] - data[iB++];
      dd += a * a;
    }
    return Math.sqrt(dd);
  }

  /** Return the distance (hypotenuse=sqrt(summed squares)) between block entries `iBegin <= i < iEnd` of indicated blocks */
  public distanceBetweenSubBlocks(blockIndexA: number, blockIndexB: number, iBegin: number, iEnd: number): number {
    let dd = 0.0;
    const iA = this.blockIndexToDoubleIndex(blockIndexA);
    const iB = this.blockIndexToDoubleIndex(blockIndexB);
    let a = 0;
    const data = this._data;
    for (let i = iBegin; i < iEnd; i++) {
      a = data[iA + i] - data[iB + i];
      dd += a * a;
    }
    return Math.sqrt(dd);
  }
}
