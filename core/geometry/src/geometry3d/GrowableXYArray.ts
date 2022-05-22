/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { Geometry } from "../Geometry";
import { MultiLineStringDataVariant } from "../topology/Triangulation";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedXYCollection } from "./IndexedXYCollection";
import { Matrix3d } from "./Matrix3d";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { Point3d } from "./Point3dVector3d";
import { PointStreamGrowableXYZArrayCollector, VariantPointDataStream } from "./PointStreaming";
import { Range2d } from "./Range";
import { Transform } from "./Transform";
import { XAndY, XYAndZ } from "./XYZProps";

/** `GrowableXYArray` manages a (possibly growing) Float64Array to pack xy coordinates.
 * @public
 */
export class GrowableXYArray extends IndexedXYCollection {
  /**
   * array of packed xyz xyz xyz components
   */
  private _data: Float64Array;
  /**
   * Number of xyz triples (not floats) in the array
   */
  private _xyInUse: number;
  /**
   * capacity in xyz triples. (not floats)
   */
  private _xyzCapacity: number;
  /** Construct a new GrowablePoint2d array.
   * @param numPoints [in] initial capacity.
   */
  public constructor(numPoints: number = 8) {
    super();
    this._data = new Float64Array(numPoints * 2);   // 8 Points to start (2 values each)
    this._xyInUse = 0;
    this._xyzCapacity = numPoints;
  }

  /** The number of points in use. When the length is increased, the array is padded with zeroes. */
  public get length() { return this._xyInUse; }
  public set length(newLength: number) {
    let oldLength = this.length;
    if (newLength < oldLength) {
      this._xyInUse = newLength;
    } else if (newLength > oldLength) {
      this.ensureCapacity(newLength);
      while (oldLength++ < newLength)
        this.pushXY(0, 0);
    }
  }

  /** Return the number of float64 in use. */
  public get float64Length() { return this._xyInUse * 2; }
  /** Return the raw packed data.
   * * Note that the length of the returned Float64Array is a count of doubles, and includes the excess capacity
   */
  public float64Data(): Float64Array { return this._data; }

  /** If necessary, increase the capacity to a new pointCount.  Current coordinates and point count (length) are unchanged. */
  public ensureCapacity(pointCapacity: number) {
    if (pointCapacity > this._xyzCapacity) {
      const newData = new Float64Array(pointCapacity * 2);
      const numCopy = this.length * 2;
      for (let i = 0; i < numCopy; i++) newData[i] = this._data[i];
      this._data = newData;
      this._xyzCapacity = pointCapacity;
    }
  }
  /** Resize the actual point count, preserving excess capacity. */
  public resize(pointCount: number) {
    if (pointCount < this.length) {
      this._xyInUse = pointCount >= 0 ? pointCount : 0;
    } else if (pointCount > this._xyzCapacity) {
      const newArray = new Float64Array(pointCount * 2);
      // Copy contents
      for (let i = 0; i < this._data.length; i += 2) {
        newArray[i] = this._data[i];
        newArray[i + 1] = this._data[i + 1];
        newArray[i + 2] = this._data[i + 2];
      }
      this._data = newArray;
      this._xyzCapacity = pointCount;
      this._xyInUse = pointCount;
    }
  }
  /**
   * Make a copy of the (active) points in this array.
   * (The clone does NOT get excess capacity)
   */
  public clone(): GrowableXYArray {
    const newPoints = new GrowableXYArray(this.length);
    const numValue = this.length * 2;
    const newData = newPoints._data;
    const data = this._data;
    for (let i = 0; i < numValue; i++) newData[i] = data[i];
    newPoints._xyInUse = this.length;
    return newPoints;
  }
  /** Create an array populated from
   * * An array of Point2d
   * * An array of Point3d (hidden as XAndY)
   * * An array of objects with keyed values, et `{x:1, y:1}`
   * * A `GrowableXYZArray`
   */
  public static create(data: XAndY[] | GrowableXYZArray): GrowableXYArray {
    const newPoints = new GrowableXYArray(data.length);
    if (data instanceof GrowableXYZArray) {
      newPoints.pushAllXYAndZ(data);
    } else {
      newPoints.pushAll(data);
    }
    return newPoints;
  }

  /** Restructure MultiLineStringDataVariant as array of GrowableXYZArray */
  public static createArrayOfGrowableXYZArray(data: MultiLineStringDataVariant): GrowableXYZArray[] | undefined {
    const collector = new PointStreamGrowableXYZArrayCollector();
    VariantPointDataStream.streamXYZ(data, collector);
    return collector.claimArrayOfGrowableXYZArray();
  }
  /** push a point to the end of the array */
  public push(toPush: XAndY) {
    this.pushXY(toPush.x, toPush.y);
  }

  /** push all points of an array */
  public pushAll(points: XAndY[]) {
    for (const p of points) this.push(p);
  }
  /** push all points of an array */
  public pushAllXYAndZ(points: XYAndZ[] | GrowableXYZArray) {
    if (points instanceof GrowableXYZArray) {
      const xyzBuffer = points.float64Data();
      const n = points.length * 3;
      for (let i = 0; i + 2 < n; i += 3) {
        this.pushXY(xyzBuffer[i], xyzBuffer[i + 1]);
      }
    } else {
      for (const p of points) this.pushXY(p.x, p.y);
    }
  }

  /**
   * Replicate numWrap xyz values from the front of the array as new values at the end.
   * @param numWrap number of xyz values to replicate
   */
  public pushWrap(numWrap: number) {
    if (this._xyInUse > 0) {
      let k;
      for (let i = 0; i < numWrap; i++) {
        k = 2 * i;
        this.pushXY(this._data[k], this._data[k + 1]);
      }
    }
  }
  /** push a point given by x,y coordinates */
  public pushXY(x: number, y: number) {
    const index = this._xyInUse * 2;
    if (index >= this._data.length)
      this.ensureCapacity(this.length === 0 ? 4 : this.length * 2);
    this._data[index] = x;
    this._data[index + 1] = y;
    this._xyInUse++;
  }

  /** Remove one point from the back.
   * * NOTE that (in the manner of std::vector native) this is "just" removing the point -- no point is NOT returned.
   * * Use `back ()` to get the last x,y,z assembled into a `Point3d `
   */
  public pop() {
    if (this._xyInUse > 0)
      this._xyInUse--;
  }
  /**
   * Test if index is valid for an xyz (point or vector) within this array
   * @param index xyz index to test.
   */
  public isIndexValid(index: number): boolean {
    if (index >= this._xyInUse || index < 0)
      return false;
    return true;
  }
  /**
   * Clear all xyz data, but leave capacity unchanged.
   */
  public clear() {
    this._xyInUse = 0;
  }
  /**
   * Get a point by index, strongly typed as a Point2d.  This is unchecked.  Use atPoint2dIndex to have validity test.
   * @param pointIndex index to access
   * @param result optional result
   */
  public getPoint2dAtUncheckedPointIndex(pointIndex: number, result?: Point2d): Point2d {
    const index = 2 * pointIndex;
    return Point2d.create(this._data[index], this._data[index + 1], result);
  }

  /**
   * Get x coordinate by point index, with no index checking
   * @param pointIndex index to access
   */
  public getXAtUncheckedPointIndex(pointIndex: number): number {
    return this._data[2 * pointIndex];
  }

  /**
   * Get y coordinate by index, with no index checking
   * @param pointIndex index to access
   */
  public getYAtUncheckedPointIndex(pointIndex: number): number {
    return this._data[2 * pointIndex + 1];
  }

  /**
   * Gather all points as a Point2d[]
   */
  public getPoint2dArray(): Point2d[] {
    const n = 2 * this._xyInUse;
    const result = [];
    const data = this._data;
    for (let i = 0; i < n; i += 2)
      result.push(Point2d.create(data[i], data[i + 1]));
    return result;
  }

  /** copy xyz into strongly typed Point2d */
  public getPoint2dAtCheckedPointIndex(pointIndex: number, result?: Point2d): Point2d | undefined {
    const index = 2 * pointIndex;
    if (this.isIndexValid(pointIndex)) {
      return Point2d.create(this._data[index], this._data[index + 1], result);
    }
    return undefined;
  }

  /** copy xyz into strongly typed Vector2d */
  public getVector2dAtCheckedVectorIndex(vectorIndex: number, result?: Vector2d): Vector2d | undefined {
    const index = 2 * vectorIndex;
    if (this.isIndexValid(vectorIndex)) {
      return Vector2d.create(this._data[index], this._data[index + 1], result);
    }
    return undefined;
  }

  /**
   * Read coordinates from source array, place them at index within this array.
   * @param destIndex point index where coordinates are to be placed in this array
   * @param source source array
   * @param sourceIndex point index in source array
   * @returns true if destIndex and sourceIndex are both valid.
   */
  public transferFromGrowableXYArray(destIndex: number, source: GrowableXYArray, sourceIndex: number): boolean {
    if (this.isIndexValid(destIndex) && source.isIndexValid(sourceIndex)) {
      const i = destIndex * 2;
      const j = sourceIndex * 2;
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
   * @param sourceIndex xyz index within the source.  If undefined, push entire contents of source
   * @returns true if sourceIndex is valid.
   */
  public pushFromGrowableXYArray(source: GrowableXYArray, sourceIndex?: number): number {
    if (sourceIndex === undefined) {
      const numPresent = this.length;
      const numPush = source.length;
      this.ensureCapacity(numPresent + numPush);
      const numFloatPresent = 2 * numPresent;
      const numFloatAdd = 2 * numPush;
      for (let i = 0; i < numFloatAdd; i++)
        this._data[numFloatPresent + i] = source._data[i];
      this._xyInUse += numPush;
      return numPush;
    }
    if (source.isIndexValid(sourceIndex)) {
      const j = sourceIndex * 2;
      this.pushXY(source._data[j], source._data[j + 1]);
      return 1;
    }
    return 0;
  }

  /**
   * * Compute a point at fractional coordinate between points i and j of source
   * * push onto this array.
   */
  public pushInterpolatedFromGrowableXYArray(source: GrowableXYArray, i: number, fraction: number, j: number) {
    if (source.isIndexValid(i) && source.isIndexValid(j)) {
      const data = source._data;
      i = 3 * i;
      j = 3 * j;
      this.pushXY(Geometry.interpolate(data[i], fraction, data[j]),
        Geometry.interpolate(data[i + 1], fraction, data[j + 1]));
    }
  }

  /**
   * push coordinates from the source array to the end of this array.
   * @param source source array
   * @param transform optional transform to apply to points.
   * @param dest optional result.
   */
  public static createFromGrowableXYZArray(source: GrowableXYZArray, transform?: Transform, dest?: GrowableXYArray) {
    const packedXYZ = source.float64Data();
    const numXYZ = source.length;    // this is in xyz points
    const nDouble = 3 * numXYZ;
    if (!dest)
      dest = new GrowableXYArray(numXYZ);
    dest.clear();
    let x;
    let y;
    let z;
    if (transform) {
      for (let i = 0; i < nDouble; i += 3) {
        x = packedXYZ[i];
        y = packedXYZ[i + 1];
        z = packedXYZ[i + 2];
        dest.pushXY(transform.multiplyComponentXYZ(0, x, y, z), transform.multiplyComponentXYZ(1, x, y, z));
      }
    } else {
      for (let i = 0; i < nDouble; i += 3) {
        x = packedXYZ[i];
        y = packedXYZ[i + 1];
        dest.pushXY(x, y);
      }
    }
    return dest;
  }
  /**
   * Return the first point, or undefined if the array is empty.
   */
  public front(result?: Point2d): Point2d | undefined {
    if (this._xyInUse === 0) return undefined;
    return this.getPoint2dAtUncheckedPointIndex(0, result);
  }
  /**
   * Return the last point, or undefined if the array is empty.
   */
  public back(result?: Point2d): Point2d | undefined {
    if (this._xyInUse < 1) return undefined;
    return this.getPoint2dAtUncheckedPointIndex(this._xyInUse - 1, result);
  }
  /**
   * Set the coordinates of a single point.
   * @param pointIndex index of point to set
   * @param value coordinates to set
   */
  public setAtCheckedPointIndex(pointIndex: number, value: XAndY): boolean {
    if (!this.isIndexValid(pointIndex))
      return false;
    const index = pointIndex * 2;
    this._data[index] = value.x;
    this._data[index + 1] = value.y;
    return true;
  }
  /**
   * Set the coordinates of a single point given as coordinates.
   * @param pointIndex index of point to set
   * @param x x coordinate
   * @param y y coordinate
   */
  public setXYZAtCheckedPointIndex(pointIndex: number, x: number, y: number): boolean {
    if (!this.isIndexValid(pointIndex))
      return false;
    const index = pointIndex * 2;
    this._data[index] = x;
    this._data[index + 1] = y;
    return true;
  }

  /**
   * Copy all points into a simple array of Point3D with given z.
   */
  public getPoint3dArray(z: number = 0): Point3d[] {
    const result = [];
    const data = this._data;
    const n = this.length;
    for (let i = 0; i < n; i++) {
      result.push(Point3d.create(data[i * 2], data[i * 2 + 1], z));
    }
    return result;
  }
  /** reverse the order of points. */
  public reverseInPlace() {
    const n = this.length;
    let j0, j1;
    let a;
    const data = this._data;
    for (let i0 = 0, i1 = n - 1; i0 < i1; i0++, i1--) {
      j0 = 2 * i0;
      j1 = 2 * i1;
      a = data[j0]; data[j0] = data[j1]; data[j1] = a;
      j0++;
      j1++;
      a = data[j0]; data[j0] = data[j1]; data[j1] = a;
    }
  }

  /** multiply each point by the transform, replace values. */
  public multiplyTransformInPlace(transform: Transform) {
    const data = this._data;
    const nDouble = this.float64Length;
    const coffs = transform.matrix.coffs;
    const origin = transform.origin;
    const x0 = origin.x;
    const y0 = origin.y;
    let x = 0;
    let y = 0;
    for (let i = 0; i + 2 <= nDouble; i += 2) {
      x = data[i];
      y = data[i + 1];
      data[i] = coffs[0] * x + coffs[1] * y + x0;
      data[i + 1] = coffs[3] * x + coffs[4] * y + y0;
    }
  }

  /** multiply each xyz (as a vector) by matrix, replace values. */
  public multiplyMatrix3dInPlace(matrix: Matrix3d) {
    const data = this._data;
    const nDouble = this.float64Length;
    const coffs = matrix.coffs;
    let x = 0;
    let y = 0;
    for (let i = 0; i + 2 <= nDouble; i += 2) {
      x = data[i];
      y = data[i + 1];
      data[i] = coffs[0] * x + coffs[1] * y;
      data[i + 1] = coffs[3] * x + coffs[4] * y;
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
    let x = 0;
    let y = 0;
    for (let i = 0; i + 2 <= nDouble; i += 2) {
      x = data[i] - x0;
      y = data[i + 1] - y0;
      data[i] = coffs[0] * x + coffs[1] * y;
      data[i + 1] = coffs[3] * x + coffs[4] * y;
      data[i + 2] = coffs[6] * x + coffs[7] * y;
    }
    return true;
  }
  /** Extend a `Range2d`, optionally transforming the points. */
  public extendRange(rangeToExtend: Range2d, transform?: Transform) {
    const numDouble = this.float64Length;
    const data = this._data;
    if (transform) {
      for (let i = 0; i + 2 <= numDouble; i += 2)
        rangeToExtend.extendTransformedXY(transform, data[i], data[i + 1]);
    } else {
      for (let i = 0; i + 2 <= numDouble; i += 2)
        rangeToExtend.extendXY(data[i], data[i + 1]);

    }
  }
  /** sum the lengths of segments between points. */
  public sumLengths(): number {
    let sum = 0.0;
    const n = 2 * (this._xyInUse - 1);  // Length already takes into account what specifically is in use
    const data = this._data;
    for (let i = 0; i < n; i += 2) sum += Geometry.hypotenuseXY(
      data[i + 2] - data[i],
      data[i + 3] - data[i + 1]);
    return sum;
  }
  /**
   * Multiply each x,y,z by the scale factor.
   * @param factor
   */
  public scaleInPlace(factor: number) {
    if (this._data) {
      const numFloat = this.float64Length;
      for (let i = 0; i < numFloat; i++)
        this._data[i] = this._data[i] * factor;
    }
  }
  /** Compute a point at fractional coordinate between points i and j */
  public interpolate(i: number, fraction: number, j: number, result?: Point2d): Point2d | undefined {
    if (this.isIndexValid(i) && this.isIndexValid(j)) {
      const fraction0 = 1.0 - fraction;
      const data = this._data;
      i = 2 * i;
      j = 2 * j;
      return Point2d.create(
        fraction0 * data[i] + fraction * data[j],
        fraction0 * data[i + 1] + fraction * data[j + 1], result);
    }
    return undefined;
  }

  /** Sum the signed areas of the projection to xy plane */
  public areaXY(): number {
    let area = 0.0;
    const n = 2 * this._xyInUse;    // float count !!
    if (n > 4) {
      const x0 = this._data[n - 2];
      const y0 = this._data[n - 1];
      let dx1 = this._data[0] - x0;
      let dy1 = this._data[1] - y0;
      let dx2 = 0;
      let dy2 = 0;
      for (let i = 2; i < n; i += 2, dx1 = dx2, dy1 = dy2) {
        dx2 = this._data[i] - x0;
        dy2 = this._data[i + 1] - y0;
        area += Geometry.crossProductXYXY(dx1, dy1, dx2, dy2);
      }
    }
    return 0.5 * area;
  }

  /** Compute a vector from index origin i to indexed target j  */
  public vectorIndexIndex(i: number, j: number, result?: Vector2d): Vector2d | undefined {
    if (!this.isIndexValid(i) || !this.isIndexValid(j))
      return undefined;
    const data = this._data;
    i = 2 * i;
    j = 2 * j;
    return Vector2d.create(data[j] - data[i], data[j + 1] - data[i + 1], result);
  }

  /** Compute a vector from origin to indexed target j */
  public vectorXAndYIndex(origin: XAndY, j: number, result?: Vector2d): Vector2d | undefined {
    if (this.isIndexValid(j)) {
      const data = this._data;
      j = 2 * j;
      return Vector2d.create(
        data[j] - origin.x,
        data[j + 1] - origin.y, result);
    }
    return undefined;
  }

  /** Compute the cross product of vectors from from indexed origin to indexed targets i and j */
  public crossProductIndexIndexIndex(originIndex: number, targetAIndex: number, targetBIndex: number): number | undefined {
    const i = originIndex * 2;
    const j = targetAIndex * 2;
    const k = targetBIndex * 2;
    const data = this._data;
    if (this.isIndexValid(originIndex) && this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex))
      return Geometry.crossProductXYXY(
        data[j] - data[i], data[j + 1] - data[i + 1],
        data[k] - data[i], data[k + 1] - data[i + 1]);
    return undefined;
  }

  /** Compute the cross product of vectors from from origin to indexed targets i and j */
  public crossProductXAndYIndexIndex(origin: XAndY, targetAIndex: number, targetBIndex: number): number | undefined {
    const j = targetAIndex * 2;
    const k = targetBIndex * 2;
    const data = this._data;
    if (this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex))
      return Geometry.crossProductXYXY(
        data[j] - origin.x, data[j + 1] - origin.y,
        data[k] - origin.x, data[k + 1] - origin.y);
    return undefined;
  }

  /** Return the distance between two points in the array. */
  public distance(i: number, j: number): number | undefined {
    if (this.isIndexValid(i) && this.isIndexValid(j)) {
      const i0 = 2 * i;
      const j0 = 2 * j;
      return Geometry.hypotenuseXY(
        this._data[j0] - this._data[i0],
        this._data[j0 + 1] - this._data[i0 + 1]);
    }
    return undefined;
  }
  /** Return the distance between an array point and the input point. */
  public distanceIndexToPoint(i: number, spacePoint: Point2d): number | undefined {
    if (this.isIndexValid(i)) {
      const i0 = 2 * i;
      return Geometry.hypotenuseXY(
        spacePoint.x - this._data[i0],
        spacePoint.y - this._data[i0 + 1]);
    }
    return undefined;
  }
  /** Test for nearly equal arrays. */
  public static isAlmostEqual(dataA: GrowableXYArray | undefined, dataB: GrowableXYArray | undefined): boolean {
    if (dataA && dataB) {
      if (dataA.length !== dataB.length)
        return false;
      for (let i = 0; i < dataA.length; i++)
        if (!dataA.getPoint2dAtUncheckedPointIndex(i).isAlmostEqual(dataB.getPoint2dAtUncheckedPointIndex(i)))
          return false;
      return true;
    }
    // if both are null it is equal, otherwise unequal
    return (!dataA && !dataB);
  }

  /** Return an array of block indices sorted per compareLexicalBlock function */
  public sortIndicesLexical(): Uint32Array {
    const n = this._xyInUse;
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
    for (let i = 0; i < 2; i++) {
      ax = this._data[ia * 2 + i];
      bx = this._data[ib * 2 + i];
      if (ax > bx) return 1;
      if (ax < bx) return -1;
    }
    return ia - ib; // so original order is maintained among duplicates !!!!
  }

  /** Access a single double at offset within a block.  This has no index checking. */
  public component(pointIndex: number, componentIndex: number): number {
    return this._data[2 * pointIndex + componentIndex];
  }
  /** Toleranced equality test */
  public isAlmostEqual(other: GrowableXYArray, tolerance: number = Geometry.smallMetricDistance): boolean {
    const numXY = this._xyInUse;
    if (other._xyInUse !== numXY)
      return false;
    const dataA = this._data;
    const dataB = other._data;
    for (let i = 0; i < 2 * numXY; i++) {
      if (Math.abs(dataA[i] - dataB[i]) > tolerance)
        return false;
    }
    return true;
  }
}
