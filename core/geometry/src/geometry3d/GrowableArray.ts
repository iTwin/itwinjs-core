/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module ArraysAndInterfaces */

import { Geometry } from "../Geometry";
import { XYAndZ } from "./XYZProps";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Range3d } from "./Range";
import { Transform } from "./Transform";
import { IndexedXYZCollection } from "./IndexedXYZCollection";

import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";

export type OptionalGrowableFloat64Array = GrowableFloat64Array | undefined;
export type BlockComparisonFunction = (data: Float64Array, blockSize: number, index0: number, index1: number) => number;

export class GrowableFloat64Array {
  private _data: Float64Array;
  private _inUse: number;
  constructor(initialCapacity: number = 8) {
    this._data = new Float64Array(initialCapacity);
    this._inUse = 0;
  }
  public static compare(a: any, b: any): number {
    return a - b;
  }
  public get length() {
    return this._inUse;
  }
  /**
   * Set the value at specified index.
   * @param index index of entry to set
   * @param value value to set
   */
  public setAt(index: number, value: number) {
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

  public push(toPush: number) {
    if (this._inUse + 1 < this._data.length) {
      this._data[this._inUse] = toPush;
      this._inUse++;
    } else {
      // Make new array (double size), copy values, then push toPush
      const newData = new Float64Array(this._inUse * 2);
      for (let i = 0; i < this._inUse; i++) {
        newData[i] = this._data[i];
      }
      this._data = newData;
      this._data[this._inUse] = toPush;
      this._inUse++;
    }
  }
  /** Push a `numToCopy` consecutive values starting at `copyFromIndex` to the end of the array. */
  public pushBlockCopy(copyFromIndex: number, numToCopy: number) {
    const newLength = this._inUse + numToCopy;
    this.ensureCapacity(newLength);
    const limit = copyFromIndex + numToCopy;
    for (let i = copyFromIndex; i < limit; i++)
      this._data[this._inUse++] = this._data[i];
  }
  /** Clear the array to 0 length.  The underlying memory remains allocated for reuse. */
  public clear() {
    while (this._inUse > 0)
      this.pop();
  }
  public capacity() {
    return this._data.length;
  }
  public ensureCapacity(newCapacity: number) {
    if (newCapacity > this.capacity()) {
      const oldInUse = this._inUse;
      const newData = new Float64Array(newCapacity);
      for (let i = 0; i < oldInUse; i++)
        newData[i] = this._data[i];
      this._data = newData;
    }
  }
  /**
   * * If newLength is less than current (active) length, just set (active) length.
   * * If newLength is greater, ensureCapacity (newSize) and pad with padValue up to newSize;
   * @param newLength new data count
   * @param padValue value to use for padding if the length increases.
   */
  public resize(newLength: number, padValue: number = 0) {
    // quick out for easy case ...
    if (newLength <= this._inUse) {
      this._inUse = newLength;
      return;
    }
    const oldLength = this._inUse;
    this.ensureCapacity(newLength);
    for (let i = oldLength; i < newLength; i++)
      this._data[i] = padValue;
    this._inUse = newLength;
  }
  public pop() {
    // Could technically access outside of array, if filled and then reduced using pop (similar to C
    // and accessing out of bounds), but with adjusted inUse counter, that data will eventually be overwritten
    if (this._inUse > 0) {
      this._inUse--;
    }
  }

  public at(index: number): number {
    return this._data[index];
  }

  public front() {
    return this._data[0];
  }
  public back() {
    return this._data[this._inUse - 1];
  }
  public reassign(index: number, value: number) {
    this._data[index] = value;
  }

  /**
   * * Sort the array entries.
   * * Uses insertion sort -- fine for small arrays (less than 30), slow for larger arrays
   * @param compareMethod comparison method
   */
  public sort(compareMethod: (a: any, b: any) => number = GrowableFloat64Array.compare) {
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
   * * For each index `i0 <= i < i1` overwrite `data[i+1]` by `f0*data[i]+f1*data[i+1]
   * * This is the essential step of a bezier polynomial subdivision step
   * @param i0 first index to update
   * @param i1 one beyond last index to update.
   * @param f0 left scale
   * @param f1 right scale
   */
  public overwriteWithScaledCombinations(i0: number, i1: number, f0: number, f1: number) {
    // work right to left for simplest overwrite
    for (let i = i1; i > i0; i--) {
      this._data[i] = f0 * this._data[i - 1] + f1 * this._data[i];
    }
  }
  /**
   * @returns Return the weighted sum `data[i0+i]*weights[i]`.
   * @param i0 first index of data
   * @param weights array of weights.
   * @note The length of the weight array is the number of summed terms.
   */
  public weightedSum(i0: number, weights: Float64Array) {
    let i = i0;
    let sum: number = 0.0;
    const data = this._data;
    for (const w of weights)
      sum += w * data[i++];
    return sum;
  }
  /**
   * @returns Return the weighted sum `(data[i0+i] - data[i])*weights[i]`.
   * @param i0 first index of data
   * @param weights array of weights.
   * @note The length of the weight array is the number of summed terms.
   */
  public weightedDifferenceSum(i0: number, weights: Float64Array) {
    let i = i0;
    let sum: number = 0.0;
    const data = this._data;
    for (const w of weights) {
      sum += w * (data[i + 1] - data[i]);
      i++;
    }
    return sum;
  }

}
/**
 * Array of contiguous doubles, indexed by block number and index within block.
 * * This is essentially a rectangular matrix, with each block being a row of the matrix.
 */
export class GrowableBlockedArray {
  protected _data: Float64Array;
  protected _inUse: number;
  protected _blockSize: number;  // positive integer !!!
  protected constructor(blockSize: number, initialBlocks: number = 8) {
    this._data = new Float64Array(initialBlocks * blockSize);
    this._inUse = 0;
    this._blockSize = blockSize;
  }
  /** computed property: length (in blocks, not doubles) */
  public get numBlocks(): number { return this._inUse; }
  /** property: number of data values per block */
  public get numPerBlock(): number { return this._blockSize; }
  /**
   * Return a single value indexed within a blcok
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
  public ensureBlockCapacity(blockCapacity: number) {
    if (blockCapacity > this.blockCapacity()) {
      const newData = new Float64Array(blockCapacity * this._blockSize);
      for (let i = 0; i < this._data.length; i++) {
        newData[i] = this._data[i];
      }
      this._data = newData;
    }
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
    if (this._blockSize * (index + 1) > this._data.length)
      this.ensureBlockCapacity(2 * this._inUse);
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
  /** compre two blocks in simple lexical order.
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
  public sortIndicesLexical(compareBlocks: BlockComparisonFunction = GrowableBlockedArray.compareLexicalBlock): Uint32Array {
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
/** Use a Float64Array to pack xyz coordinates. */
export class GrowableXYZArray extends IndexedXYZCollection {
  private _data: Float64Array;
  private _inUse: number;
  private _capacity: number;
  /** Construct a new GrowablePoint3d array.
   * @param numPoints [in] initial capacity.
   */
  public constructor(numPoints: number = 8) {
    super();
    this._data = new Float64Array(numPoints * 3);   // 8 Points to start (3 values each)
    this._inUse = 0;
    this._capacity = numPoints;
  }
  /** @returns Return the number of points in use. */
  public get length() { return this._inUse; }
  /** @returns Return the number of float64 in use. */
  public get float64Length() { return this._inUse * 3; }
  /** If necessary, increase the capacity to a new pointCount.  Current coordinates and point count (length) are unchnaged. */
  public ensureCapacity(pointCapacity: number) {
    if (pointCapacity > this._capacity) {
      const newData = new Float64Array(pointCapacity * 3);
      const numCopy = this.length * 3;
      for (let i = 0; i < numCopy; i++) newData[i] = this._data[i];
      this._data = newData;
      this._capacity = pointCapacity;
    }
  }
  /** Resize the actual point count, preserving excess capacity. */
  public resize(pointCount: number) {
    if (pointCount < this.length) {
      this._inUse = pointCount >= 0 ? pointCount : 0;
    } else if (pointCount > this._capacity) {
      const newArray = new Float64Array(pointCount * 3);
      // Copy contents
      for (let i = 0; i < this._data.length; i += 3) {
        newArray[i] = this._data[i];
        newArray[i + 1] = this._data[i + 1];
        newArray[i + 2] = this._data[i + 2];
      }
      this._data = newArray;
      this._capacity = pointCount;
    }
  }
  /**
   * Make a copy of the (active) points in this array.
   * (The clone does NOT get excess capacity)
   */
  public clone(): GrowableXYZArray {
    const newPoints = new GrowableXYZArray(this.length);
    const numValue = this.length * 3;
    const newData = newPoints._data;
    const data = this._data;
    for (let i = 0; i < numValue; i++) newData[i] = data[i];
    newPoints._inUse = this.length;
    return newPoints;
  }

  public static create(data: XYAndZ[]): GrowableXYZArray {
    const newPoints = new GrowableXYZArray(data.length);
    for (const p of data) newPoints.push(p);
    return newPoints;
  }

  /** push a point to the end of the array */
  public push(toPush: XYAndZ) {
    this.pushXYZ(toPush.x, toPush.y, toPush.z);
  }

  /** push all points of an array */
  public pushAll(points: Point3d[]) {
    for (const p of points) this.push(p);
  }
  /**
   * Replicate numWrap xyz values from the front of the array as new values at the end.
   * @param numWrap number of xyz values to replicate
   */
  public pushWrap(numWrap: number) {
    if (this._inUse > 0) {
      let k;
      for (let i = 0; i < numWrap; i++) {
        k = 3 * i;
        this.pushXYZ(this._data[k], this._data[k + 1], this._data[k + 2]);
      }
    }
  }

  public pushXYZ(x: number, y: number, z: number) {
    const index = this._inUse * 3;
    if (index >= this._data.length)
      this.ensureCapacity(this.length * 2);
    this._data[index] = x;
    this._data[index + 1] = y;
    this._data[index + 2] = z;
    this._inUse++;
  }

  /** Remove one point from the back. */
  public pop() {
    if (this._inUse > 0)
      this._inUse--;
  }
  /**
   * Test if index is valid for an xyz (point or vector) withibn this array
   * @param index xyz index to test.
   */
  public isIndexValid(index: number): boolean {
    if (index >= this._inUse || index < 0)
      return false;
    return true;
  }
  /**
   * Clear all xyz data, but leave capacity unchanged.
   */
  public clear() {
    this._inUse = 0;
  }
  /**
   * Get a point by index, strongly typed as a Point3d.  This is unchecked.  Use atPoint3dIndex to have validity test.
   * @param pointIndex index to access
   * @param result optional result
   */
  public getPoint3dAt(pointIndex: number, result?: Point3d): Point3d {
    const index = 3 * pointIndex;
    return Point3d.create(this._data[index], this._data[index + 1], this._data[index + 2], result);
  }

  /** copy xyz into strongly typed Point3d */
  public atPoint3dIndex(pointIndex: number, result?: Point3d): Point3d | undefined {
    const index = 3 * pointIndex;
    if (pointIndex >= 0 && pointIndex < this._inUse) {
      if (!result) result = Point3d.create();
      result.x = this._data[index];
      result.y = this._data[index + 1];
      result.z = this._data[index + 2];
      return result;
    }
    return undefined;
  }

  /** copy xyz into strongly typed Point3d */
  public atVector3dIndex(vectorIndex: number, result?: Vector3d): Vector3d | undefined {
    const index = 3 * vectorIndex;
    if (vectorIndex >= 0 && vectorIndex < this._inUse) {
      if (!result) result = Vector3d.create();
      result.x = this._data[index];
      result.y = this._data[index + 1];
      result.z = this._data[index + 2];
      return result;
    }
    return undefined;
  }

  /**
   * Read coordinates from source array, place them at indexe within this array.
   * @param destIndex point index where coordinats are to be placed in this array
   * @param source source array
   * @param sourceIndex point index in source array
   * @returns true if destIndex and sourceIndex are both valid.
   */
  public transferFromGrowableXYZArray(destIndex: number, source: GrowableXYZArray, sourceIndex: number): boolean {
    if (destIndex < this.length && sourceIndex < source.length) {
      const i = destIndex * 3;
      const j = sourceIndex * 3;
      this._data[i] = source._data[j];
      this._data[i + 1] = source._data[j + 1];
      this._data[i + 2] = source._data[j + 2];
      return true;
    }
    return false;
  }
  /**
   * push coordinates from the source array to the end of this array.
   * @param source source array
   * @param sourceIndex xyz index within the source
   * @returns true if sourceIndex is valid.
   */
  public pushFromGrowableXYZArray(source: GrowableXYZArray, sourceIndex: number) {
    if (sourceIndex < source.length) {
      const j = sourceIndex * 3;
      this.pushXYZ(source._data[j], source._data[j + 1], source._data[j + 2]);
      return true;
    }
    return false;
  }

  /**
   * @returns Return the first point, or undefined if the array is empty.
   */
  public front(result?: Point3d): Point3d | undefined {
    if (this._inUse === 0) return undefined;
    return this.getPoint3dAt(0, result);
  }
  /**
   * @returns Return the last point, or undefined if the array is empty.
   */
  public back(result?: Point3d): Point3d | undefined {
    if (this._inUse - 1 < 0) return undefined;
    return this.getPoint3dAt(this._inUse - 1, result);
  }
  /**
   * Set the coordinates of a single point.
   * @param pointIndex index of point to set
   * @param value coordinates to set
   */
  public setAt(pointIndex: number, value: XYAndZ): boolean {
    if (pointIndex < 0 || pointIndex >= this._inUse) return false;
    let index = pointIndex * 3;
    this._data[index++] = value.x;
    this._data[index++] = value.y;
    this._data[index] = value.z;
    return true;
  }
  /**
   * Set the coordinates of a single point given as coordintes
   * @param pointIndex index of point to set
   * @param x x coordinate
   * @param y y coordinate
   * @param z z coordinate
   */
  public setCoordinates(pointIndex: number, x: number, y: number, z: number): boolean {
    if (pointIndex < 0 || pointIndex >= this._inUse) return false;
    let index = pointIndex * 3;
    this._data[index++] = x;
    this._data[index++] = y;
    this._data[index] = z;
    return true;
  }

  /**
   * @returns Copy all points into a simple array of Point3d
   */
  public getPoint3dArray(): Point3d[] {
    const result = [];
    const data = this._data;
    const n = this.length;
    for (let i = 0; i < n; i++) {
      result.push(Point3d.create(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]));
    }
    return result;
  }
  /** multiply each point by the transform, replace values. */
  public transformInPlace(transform: Transform) {
    const data = this._data;
    const nDouble = this.float64Length;
    const coffs = transform.matrix.coffs;
    const origin = transform.origin;
    const x0 = origin.x;
    const y0 = origin.y;
    const z0 = origin.z;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i + 3 <= nDouble; i += 3) {
      x = data[i];
      y = data[i + 1];
      z = data[i + 2];
      data[i] = coffs[0] * x + coffs[1] * y + coffs[2] * z + x0;
      data[i + 1] = coffs[3] * x + coffs[4] * y + coffs[5] * z + y0;
      data[i + 2] = coffs[6] * x + coffs[7] * y + coffs[8] * z + z0;
    }
  }

  /** multiply each point by the transform, replace values. */
  public tryTransformInverseInPlace(transform: Transform): boolean {
    const data = this._data;
    const nDouble = this.float64Length;
    const matrix = transform.matrix;
    matrix.computeCachedInverse(true);
    const coffs = matrix.inverseCoffs;
    if (!coffs)
      return false;
    const origin = transform.origin;
    const x0 = origin.x;
    const y0 = origin.y;
    const z0 = origin.z;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i + 3 <= nDouble; i += 3) {
      x = data[i] - x0;
      y = data[i + 1] - y0;
      z = data[i + 2] - z0;
      data[i] = coffs[0] * x + coffs[1] * y + coffs[2] * z;
      data[i + 1] = coffs[3] * x + coffs[4] * y + coffs[5] * z;
      data[i + 2] = coffs[6] * x + coffs[7] * y + coffs[8] * z;
    }
    return true;
  }
  public extendRange(rangeToExtend: Range3d, transform?: Transform) {
    const numDouble = this.float64Length;
    const data = this._data;
    if (transform) {
      for (let i = 0; i + 3 <= numDouble; i += 3)
        rangeToExtend.extendTransformedXYZ(transform, data[i], data[i + 1], data[i + 2]);
    } else {
      for (let i = 0; i + 3 <= numDouble; i += 3)
        rangeToExtend.extendXYZ(data[i], data[i + 1], data[i + 2]);

    }
  }
  public sumLengths(): number {
    let sum = 0.0;
    const n = 3 * (this._inUse - 1);  // Length already takes into account what specifically is in use
    const data = this._data;
    for (let i = 0; i < n; i += 3) sum += Geometry.hypotenuseXYZ(
      data[i + 3] - data[i],
      data[i + 4] - data[i + 1],
      data[i + 5] - data[i + 2]);
    return sum;
  }

  public isCloseToPlane(plane: Plane3dByOriginAndUnitNormal, tolerance: number = Geometry.smallMetricDistance): boolean {
    const numCoordinate = 3 * this._inUse;
    const data = this._data;
    for (let i = 0; i < numCoordinate; i += 3)
      if (Math.abs(plane.altitudeXYZ(data[i], data[i + 1], data[i + 2])) > tolerance)
        return false;
    return true;
  }
  /** Compute a point at fractional coordinate between points i and j */
  public interpolate(i: number, fraction: number, j: number, result?: Point3d): Point3d | undefined {
    if (i >= 0 && i < this._inUse) {
      const fraction0 = 1.0 - fraction;
      const data = this._data;
      i = 3 * i;
      j = 3 * j;
      return Point3d.create(
        fraction0 * data[i] + fraction * data[j],
        fraction0 * data[i + 1] + fraction * data[j + 1],
        fraction0 * data[i + 2] + fraction * data[j + 2], result);
    }
    return undefined;
  }

  /** Sum the signed areas of the projection to xy plane */
  public areaXY(): number {
    let area = 0.0;
    const n = this._data.length - 6;   // at least two points needed !!!!
    if (n > 2) {
      const x0 = this._data[0];
      const y0 = this._data[1];
      let dx1 = this._data[3] - x0;
      let dy1 = this._data[4] - y0;
      let dx2 = 0;
      let dy2 = 0;
      for (let i = 6; i < n; i += 3, dx1 = dx2, dy1 = dy2) {
        dx2 = this._data[i] - x0;
        dy2 = this._data[i + 1] - y0;
        area += Geometry.crossProductXYXY(dx1, dy1, dx2, dy2);
      }
    }
    return 0.5 * area;
  }

  /** Compute a vector from index target i to indexed target j  */
  public vectorIndexIndex(i: number, j: number, result?: Vector3d): Vector3d | undefined {
    const n = this._inUse;
    if (i < 0 || i >= n)
      return undefined;
    if (j < 0 || j >= n)
      return undefined;
    if (!result) result = Vector3d.create();
    const data = this._data;
    i = 3 * i;
    j = 3 * j;
    result.x = data[j] - data[i];
    result.y = data[j + 1] - data[i + 1];
    result.z = data[j + 2] - data[i + 2];
    return result;
  }

  /** Compute a vector from origin to indexed target j */
  public vectorXYAndZIndex(origin: XYAndZ, j: number, result?: Vector3d): Vector3d | undefined {
    if (j >= 0 && j < this._inUse) {
      const data = this._data;
      j = 3 * j;
      return Vector3d.create(
        data[j] - origin.x,
        data[j + 1] - origin.y,
        data[j + 2] - origin.z, result);
    }
    return undefined;
  }

  /** Compute the cross product of vectors from from indexed origin to indexed targets i and j */
  public crossProductIndexIndexIndex(originIndex: number, targetAIndex: number, targetBIndex: number, result?: Vector3d): Vector3d | undefined {
    const i = originIndex * 3;
    const j = targetAIndex * 3;
    const k = targetBIndex * 3;
    const data = this._data;
    if (this.isIndexValid(originIndex) && this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex))
      return Geometry.crossProductXYZXYZ(
        data[j] - data[i], data[j + 1] - data[i + 1], data[j + 2] - data[i + 2],
        data[k] - data[i], data[k + 1] - data[i + 1], data[k + 2] - data[i + 2],
        result);
    return undefined;
  }

  /**
   * * compute the cross product from indexed origin t indexed targets targetAIndex and targetB index.
   * * accumulate it to the result.
   */
  public accumulateCrossProductIndexIndexIndex(originIndex: number, targetAIndex: number, targetBIndex: number, result: Vector3d): void {
    const i = originIndex * 3;
    const j = targetAIndex * 3;
    const k = targetBIndex * 3;
    const data = this._data;
    if (this.isIndexValid(originIndex) && this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex))
      result.addCrossProductToTargetsInPlace(
        data[i], data[i + 1], data[i + 2],
        data[j], data[j + 1], data[j + 2],
        data[k], data[k + 1], data[k + 2]);
    return undefined;
  }

  /** Compute the cross product of vectors from from origin to indexed targets i and j */
  public crossProductXYAndZIndexIndex(origin: XYAndZ, targetAIndex: number, targetBIndex: number, result?: Vector3d): Vector3d | undefined {
    const j = targetAIndex * 3;
    const k = targetBIndex * 3;
    const data = this._data;
    if (this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex))
      return Geometry.crossProductXYZXYZ(
        data[j] - origin.x, data[j + 1] - origin.y, data[j + 2] - origin.z,
        data[k] - origin.x, data[k + 1] - origin.y, data[k + 2] - origin.z,
        result);
    return undefined;
  }

  /** Return the distance between two points in the array. */
  public distance(i: number, j: number): number {
    if (i >= 0 && i < this._inUse && j >= 0 && j <= this._inUse) {
      const i0 = 3 * i;
      const j0 = 3 * j;
      return Geometry.hypotenuseXYZ(
        this._data[j0] - this._data[i0],
        this._data[j0 + 1] - this._data[i0 + 1],
        this._data[j0 + 2] - this._data[i0 + 2]);
    }
    return 0.0;
  }
  public static isAlmostEqual(dataA: GrowableXYZArray | undefined, dataB: GrowableXYZArray | undefined): boolean {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      for (let i = 0; i < dataA.length; i++)
        if (!dataA.getPoint3dAt(i).isAlmostEqual(dataB.getPoint3dAt(i)))
          return false;
      return true;
    }
    // if both are null it is equal, otherwise unequal
    return (!dataA && !dataB);
  }

  /** Return an array of block indices sorted per compareLexicalBlock function */
  public sortIndicesLexical(): Uint32Array {
    const n = this._inUse;
    // let numCompare = 0;
    const result = new Uint32Array(n);
    for (let i = 0; i < n; i++)result[i] = i;
    result.sort(
      (blockIndexA: number, blockIndexB: number) => {
        // numCompare++;
        return this.compareLexicalBlock(blockIndexA, blockIndexB);
      });
    // console.log (n, numCompare);
    return result;
  }

  /** compare two blocks in simple lexical order. */
  public compareLexicalBlock(ia: number, ib: number): number {
    let ax = 0;
    let bx = 0;
    for (let i = 0; i < 3; i++) {
      ax = this._data[ia * 3 + i];
      bx = this._data[ib * 3 + i];
      if (ax > bx) return 1;
      if (ax < bx) return -1;
    }
    return ia - ib; // so original order is maintained among duplicates !!!!
  }

  /** Access a single double at offset within a block.  This has no index checking. */
  public component(pointIndex: number, componentIndex: number): number {
    return this._data[3 * pointIndex + componentIndex];
  }
}
