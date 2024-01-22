/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedXYCollection } from "./IndexedXYCollection";
import { MultiLineStringDataVariant } from "./IndexedXYZCollection";
import { Matrix3d } from "./Matrix3d";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { Point3d } from "./Point3dVector3d";
import { Range2d } from "./Range";
import { Transform } from "./Transform";
import { XAndY, XYAndZ } from "./XYZProps";

/** `GrowableXYArray` manages a (possibly growing) Float64Array to pack xy coordinates.
 * @public
 */
export class GrowableXYArray extends IndexedXYCollection {
  /**
   * array of packed xy xy xy components
   */
  private _data: Float64Array;
  /**
   * Number of xy tuples (not floats) in the array
   */
  private _xyInUse: number;
  /**
   * capacity in xy tuples. (not floats)
   */
  private _xyCapacity: number;
  /**
   * multiplier used by ensureCapacity to expand requested reallocation size
   */
  private _growthFactor: number;

  /** Construct a new GrowablePoint2d array.
   * @param numPoints initial capacity in xy tuples (default 8)
   * @param growthFactor used by ensureCapacity to expand requested reallocation size (default 1.5)
   */
  public constructor(numPoints: number = 8, growthFactor?: number) {
    super();
    this._data = new Float64Array(numPoints * 2);   // 2 values per point
    this._xyInUse = 0;
    this._xyCapacity = numPoints;
    this._growthFactor = (undefined !== growthFactor && growthFactor >= 1.0) ? growthFactor : 1.5;
  }

  /** Copy xy points from source array. Does not reallocate or change active point count.
   * @param source array to copy from
   * @param sourceCount copy the first sourceCount points; all points if undefined
   * @param destOffset copy to instance array starting at this point index; zero if undefined
   * @return count and offset of points copied
   */
  protected copyData(source: Float64Array | number[], sourceCount?: number, destOffset?: number): {count: number, offset: number} {
    // validate inputs and convert from points to entries
    let myOffset = (undefined !== destOffset) ? destOffset * 2 : 0;
    if (myOffset < 0)
      myOffset = 0;
    if (myOffset >= this._data.length)
      return {count: 0, offset: 0};
    let myCount = (undefined !== sourceCount) ? sourceCount * 2 : source.length;
    if (myCount > 0) {
      if (myCount > source.length)
        myCount = source.length;
      if (myOffset + myCount > this._data.length)
        myCount = this._data.length - myOffset;
      if (myCount % 2 !== 0)
        myCount -= myCount % 2;
    }
    if (myCount <= 0)
      return {count: 0, offset: 0};
    if (myCount === source.length)
      this._data.set(source, myOffset);
    else if (source instanceof Float64Array)
      this._data.set(source.subarray(0, myCount), myOffset);
    else
      this._data.set(source.slice(0, myCount), myOffset);
    return {count: myCount / 2, offset: myOffset / 2};
  }

  /** The number of points in use. When the length is increased, the array is padded with zeroes. */
  public override get length() { return this._xyInUse; }
  public set length(newLength: number) { this.resize(newLength, true); }

  /** Return the number of float64 in use. */
  public get float64Length() { return this._xyInUse * 2; }
  /** Return the raw packed data.
   * * Note that the length of the returned Float64Array is a count of doubles, and includes the excess capacity
   */
  public float64Data(): Float64Array { return this._data; }

  /** If necessary, increase the capacity to a new pointCount.  Current coordinates and point count (length) are unchanged. */
  public ensureCapacity(pointCapacity: number, applyGrowthFactor: boolean = true) {
    if (pointCapacity > this._xyCapacity) {
      if (applyGrowthFactor)
        pointCapacity *= this._growthFactor;
      const prevData = this._data;
      this._data = new Float64Array(pointCapacity * 2);
      this.copyData(prevData, this._xyInUse);
      this._xyCapacity = pointCapacity;
    }
  }
  /**
   * * If pointCount is less than current length, just reset current length to pointCount, effectively trimming active points but preserving original capacity.
   * * If pointCount is greater than current length, reallocate to exactly pointCount, copy existing points, and optionally pad excess with zero.
   * @param pointCount new number of active points in array
   * @param padWithZero when increasing point count, whether to zero out new points (default false)
   */
   public resize(pointCount: number, padWithZero?: boolean) {
    if (pointCount >= 0 && pointCount < this._xyInUse)
      this._xyInUse = pointCount;
    else if (pointCount > this._xyInUse) {
      this.ensureCapacity(pointCount, false);
      if (padWithZero ?? false)
        this._data.fill(0, this._xyInUse * 2);
      this._xyInUse = pointCount;
    }
  }
  /**
   * Make a copy of the (active) points in this array.
   * (The clone does NOT get excess capacity)
   */
  public clone(): GrowableXYArray {
    const newPoints = new GrowableXYArray(this.length);
    newPoints.copyData(this._data, this.length);
    newPoints._xyInUse = this.length;
    return newPoints;
  }
  /** Create an array populated from
   * Valid inputs are:
   * * Point2d
   * * Point3d
   * * An array of 2 doubles
   * * An array of 3 doubles
   * * A GrowableXYZArray
   * * A GrowableXYArray
   * * Any json object satisfying Point3d.isXAndY
   * * A Float64Array of doubles, interpreted as xyxy
   * * An array of any of the above
   */
  public static create(data: any, result?: GrowableXYArray): GrowableXYArray {
    if (result) {
      result.clear();
    } else {
      const pointCount = typeof data[0] === "number" ? data.length / 2 : data.length;
      result = new GrowableXYArray(pointCount);
    }
    result.pushFrom(data);
    return result;
  }

  /** Restructure MultiLineStringDataVariant as array of GrowableXYZArray
   * @deprecated in 4.x. Moved to GrowableXYZArray class.
   */
  public static createArrayOfGrowableXYZArray(data: MultiLineStringDataVariant): GrowableXYZArray[] | undefined {
    return GrowableXYZArray.createArrayOfGrowableXYZArray(data);
  }
  /** push a point to the end of the array */
  public push(toPush: XAndY) {
    this.pushXY(toPush.x, toPush.y);
  }

  /** push all points of an array */
  public pushAll(points: XAndY[]) {
    this.ensureCapacity(this._xyInUse + points.length, false);
    for (const p of points)
      this.push(p);
  }
  /** push all points of an array */
  public pushAllXYAndZ(points: XYAndZ[] | GrowableXYZArray) {
    this.ensureCapacity(this._xyInUse + points.length, false);
    if (points instanceof GrowableXYZArray) {
      const xyzBuffer = points.float64Data();
      const n = points.length * 3;
      for (let i = 0; i + 2 < n; i += 3)
        this.pushXY(xyzBuffer[i], xyzBuffer[i + 1]);
    } else {
      for (const p of points) this.pushXY(p.x, p.y);
    }
  }
  /** Push copies of points from variant sources.
   * Valid inputs are:
   * * Point2d
   * * Point3d
   * * An array of 2 doubles
   * * A GrowableXYArray
   * * A GrowableXYZArray
   * * Any json object satisfying Point3d.isXAndY
   * * A Float64Array of doubles, interpreted as xyxy
   * * An array of any of the above
   */
  public pushFrom(p: any) {
    if (p instanceof Point3d) {
      this.pushXY(p.x, p.y);
    } else if (p instanceof GrowableXYZArray) {
      this.pushAllXYAndZ(p);
    } else if (p instanceof Point2d) {
      this.pushXY(p.x, p.y);
    } else if (Geometry.isNumberArray(p, 3) || p instanceof Float64Array) {
      const xyToAdd = Math.trunc(p.length / 2);
      this.ensureCapacity(this._xyInUse + xyToAdd, false);
      this.copyData(p, xyToAdd, this._xyInUse);
      this._xyInUse += xyToAdd;
    } else if (Geometry.isNumberArray(p, 2)) {
      this.pushXY(p[0], p[1]);
    } else if (Array.isArray(p)) {
      // direct recursion re-wraps p and goes infinite. Unroll here.
      for (const q of p)
        this.pushFrom(q);
    } else if (Point3d.isXAndY(p)) {
      this.pushXY(p.x, p.y);
    } else if (p instanceof IndexedXYCollection) {
      const n = p.length;
      this.ensureCapacity(this._xyInUse + n, false);
      for (let i = 0; i < n; i++)
        this.pushXY(p.getXAtUncheckedPointIndex(i), p.getYAtUncheckedPointIndex(i));
    }
  }
  /**
   * Replicate numWrap xy values from the front of the array as new values at the end.
   * @param numWrap number of xy values to replicate
   */
  public pushWrap(numWrap: number) {
    if (this._xyInUse >= numWrap) {
      this.ensureCapacity(this._xyInUse + numWrap, false);
      for (let i = 0; i < numWrap; i++) {
        const k = 2 * i;
        this.pushXY(this._data[k], this._data[k + 1]);
      }
    }
  }
  /** push a point given by x,y coordinates */
  public pushXY(x: number, y: number) {
    this.ensureCapacity(this._xyInUse + 1);
    const index = this._xyInUse * 2;
    this._data[index] = x;
    this._data[index + 1] = y;
    this._xyInUse++;
  }

  /** Remove one point from the back.
   * * NOTE that (in the manner of std::vector native) this is "just" removing the point -- no point is NOT returned.
   * * Use `back ()` to get the last x,y assembled into a `Point2d `
   */
  public pop() {
    if (this._xyInUse > 0)
      this._xyInUse--;
  }
  /**
   * Test if index is valid for an xy (point or vector) within this array
   * @param index xy index to test.
   */
  public isIndexValid(index: number): boolean {
    if (index >= this._xyInUse || index < 0)
      return false;
    return true;
  }
  /**
   * Clear all xy data, but leave capacity unchanged.
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
  public override getXAtUncheckedPointIndex(pointIndex: number): number {
    return this._data[2 * pointIndex];
  }

  /**
   * Get y coordinate by point index, with no index checking
   * @param pointIndex index to access
   */
  public override getYAtUncheckedPointIndex(pointIndex: number): number {
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

  /** copy xy into strongly typed Point2d */
  public override getPoint2dAtCheckedPointIndex(pointIndex: number, result?: Point2d): Point2d | undefined {
    if (this.isIndexValid(pointIndex)) {
      const index = 2 * pointIndex;
      return Point2d.create(this._data[index], this._data[index + 1], result);
    }
    return undefined;
  }

  /** copy xy into strongly typed Vector2d */
  public override getVector2dAtCheckedVectorIndex(vectorIndex: number, result?: Vector2d): Vector2d | undefined {
    if (this.isIndexValid(vectorIndex)) {
      const index = 2 * vectorIndex;
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
      return true;
    }
    return false;
  }

  /**
   * push coordinates from the source array to the end of this array.
   * @param source source array
   * @param sourceIndex xy index within the source.  If undefined, push entire contents of source
   * @returns number of points pushed.
   */
  public pushFromGrowableXYArray(source: GrowableXYArray, sourceIndex?: number): number {
    // full array push  . . .
    if (sourceIndex === undefined) {
      const numXYAdd = source.length;
      this.ensureCapacity(this.length + numXYAdd, false);
      this.copyData(source._data, numXYAdd, this.length);
      this._xyInUse += numXYAdd;
      return numXYAdd;
    }
    // single point push . . .
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
      const fraction0 = 1.0 - fraction;
      const data = source._data;
      i = 2 * i;
      j = 2 * j;
      this.pushXY(
        fraction0 * data[i] + fraction * data[j],
        fraction0 * data[i + 1] + fraction * data[j + 1]);
    }
  }

  /**
   * Create an array of xy points from source xyz points.
   * @param source source array of xyz
   * @param transform optional transform to apply to xyz points.
   * @param dest optional result.
   */
  public static createFromGrowableXYZArray(source: GrowableXYZArray, transform?: Transform, dest?: GrowableXYArray) {
    const numPoints = source.length;
    if (!dest)
      dest = new GrowableXYArray(numPoints);
    else {
      dest.ensureCapacity(numPoints, false);
      dest.clear();
    }
    if (transform) {
      const packedXYZ = source.float64Data();
      const nDouble = 3 * numPoints;
      let x, y, z;
      for (let i = 0; i < nDouble; i += 3) {
        x = packedXYZ[i];
        y = packedXYZ[i + 1];
        z = packedXYZ[i + 2];
        dest.pushXY(transform.multiplyComponentXYZ(0, x, y, z), transform.multiplyComponentXYZ(1, x, y, z));
      }
    } else {
      dest.pushAllXYAndZ(source);
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
  public setXYAtCheckedPointIndex(pointIndex: number, x: number, y: number): boolean {
    if (!this.isIndexValid(pointIndex))
      return false;
    const index = pointIndex * 2;
    this._data[index] = x;
    this._data[index + 1] = y;
    return true;
  }
  /**
   * Set the coordinates of a single point given as coordinates.
   * @deprecated in 3.x. Use setXYAtCheckedPointIndex instead
   */
   public setXYZAtCheckedPointIndex(pointIndex: number, x: number, y: number): boolean {
    return this.setXYAtCheckedPointIndex(pointIndex, x, y);
  }

  /**
   * Copy all points into a simple array of Point3d with given z.
   */
  public getPoint3dArray(z: number = 0): Point3d[] {
    const n = 2 * this._xyInUse;
    const result = [];
    const data = this._data;
    for (let i = 0; i < n; i += 2)
      result.push(Point3d.create(data[i], data[i + 1], z));
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
    for (let i = 0; i + 1 < nDouble; i += 2) {
      x = data[i];
      y = data[i + 1];
      data[i] = coffs[0] * x + coffs[1] * y + x0;
      data[i + 1] = coffs[3] * x + coffs[4] * y + y0;
    }
  }

  /** multiply each xy (as a vector) by matrix, replace values. */
  public multiplyMatrix3dInPlace(matrix: Matrix3d) {
    const data = this._data;
    const nDouble = this.float64Length;
    const coffs = matrix.coffs;
    let x = 0;
    let y = 0;
    for (let i = 0; i + 1 < nDouble; i += 2) {
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
    for (let i = 0; i + 1 < nDouble; i += 2) {
      x = data[i] - x0;
      y = data[i + 1] - y0;
      data[i] = coffs[0] * x + coffs[1] * y;
      data[i + 1] = coffs[3] * x + coffs[4] * y;
    }
    return true;
  }
  /** Extend a `Range2d`, optionally transforming the points. */
  public extendRange(rangeToExtend: Range2d, transform?: Transform) {
    const numDouble = this.float64Length;
    const data = this._data;
    if (transform) {
      for (let i = 0; i + 1 < numDouble; i += 2)
        rangeToExtend.extendTransformedXY(transform, data[i], data[i + 1]);
    } else {
      for (let i = 0; i + 1 < numDouble; i += 2)
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
   * Multiply each x,y by the scale factor.
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
  public override vectorIndexIndex(i: number, j: number, result?: Vector2d): Vector2d | undefined {
    if (!this.isIndexValid(i) || !this.isIndexValid(j))
      return undefined;
    const data = this._data;
    i = 2 * i;
    j = 2 * j;
    return Vector2d.create(data[j] - data[i], data[j + 1] - data[i + 1], result);
  }

  /** Compute a vector from origin to indexed target j */
  public override vectorXAndYIndex(origin: XAndY, j: number, result?: Vector2d): Vector2d | undefined {
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
  public override crossProductIndexIndexIndex(originIndex: number, targetAIndex: number, targetBIndex: number): number | undefined {
    if (this.isIndexValid(originIndex) && this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex)) {
      const i = originIndex * 2;
      const j = targetAIndex * 2;
      const k = targetBIndex * 2;
      const data = this._data;
      return Geometry.crossProductXYXY(
        data[j] - data[i], data[j + 1] - data[i + 1],
        data[k] - data[i], data[k + 1] - data[i + 1]);
    }
    return undefined;
  }

  /** Compute the cross product of vectors from from origin to indexed targets i and j */
  public override crossProductXAndYIndexIndex(origin: XAndY, targetAIndex: number, targetBIndex: number): number | undefined {
    if (this.isIndexValid(targetAIndex) && this.isIndexValid(targetBIndex)) {
      const j = targetAIndex * 2;
      const k = targetBIndex * 2;
      const data = this._data;
      return Geometry.crossProductXYXY(
        data[j] - origin.x, data[j + 1] - origin.y,
        data[k] - origin.x, data[k + 1] - origin.y);
    }
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
    for (let i = 0; i < n; i++) result[i] = i;
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
