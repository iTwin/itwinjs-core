/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { Geometry } from "../Geometry";
import { Point3d, Vector3d, XYZ } from "./Point3dVector3d";
import { Range3d } from "./Range";
import { XAndY, XYAndZ } from "./XYZProps";

class PointsIterator implements Iterator<Point3d>, Iterable<Point3d> {
  private readonly _collection: IndexedXYZCollection;
  private _curIndex = -1;

  public constructor(collection: IndexedXYZCollection) {
    this._collection = collection;
  }

  public next(): IteratorResult<Point3d> {
    if (++this._curIndex >= this._collection.length) {
      // The ECMAScript spec states that value=undefined is valid if done=true. The TypeScript interface violates the spec hence the cast to any and back below.
      return { done: true } as any as IteratorResult<Point3d>;
    }

    return {
      value: this._collection.getPoint3dAtUncheckedPointIndex(this._curIndex),
      done: false,
    };
  }

  public [Symbol.iterator](): Iterator<Point3d> { return this; }
}
/**
 * abstract base class for read-only access to XYZ data with indexed reference.
 * * This allows algorithms to work with Point3d[] or GrowableXYZ.
 *   * GrowableXYZArray implements these for its data.
 *   * Point3dArrayCarrier carries a (reference to) a Point3d[] and implements the methods with calls on that array reference.
 * * In addition to "point by point" accessors, other abstract members compute commonly useful vector data "between points".
 * * Methods that create vectors among multiple indices allow callers to avoid creating temporaries.
 * @public
 */
export abstract class IndexedXYZCollection {
  /**
   * Return the point at `index` as a strongly typed Point3d.
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract getPoint3dAtCheckedPointIndex(index: number, result?: Point3d): Point3d | undefined;
  /**
   * Return the point at `index` as a strongly typed Point3d, without checking the point index validity.
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract getPoint3dAtUncheckedPointIndex(index: number, result?: Point3d): Point3d;
  /**
   * Get from `index` as a strongly typed Vector3d.
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract getVector3dAtCheckedVectorIndex(index: number, result?: Vector3d): Vector3d | undefined;
  /**
   * Return a vector from the point at `indexA` to the point at `indexB`
   * @param indexA index of point within the array
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract vectorIndexIndex(indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
   * Return a vector from `origin` to the point at `indexB`
   * @param origin origin for vector
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if index is out of bounds
   */
  public abstract vectorXYAndZIndex(origin: XYAndZ, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
   * Return a vector from the point at `indexA` to `target`
   * @param indexA index of point within the array
   * @param target target for vector
   * @param result caller-allocated vector.
   * @returns undefined if index is out of bounds
   */
  public vectorIndexXYAndZ(indexA: number, target: XYAndZ, result?: Vector3d): Vector3d | undefined {
    const reversed = this.vectorXYAndZIndex(target, indexA, result);
    return reversed?.negate(reversed);
  }
  /**
   * Return the dot product of the vectors from the point at `origin` to the points at `indexA` and `indexB`.
   * @param origin index of point within the array; origin of both vectors
   * @param indexA index of point within the array; target of the first vector
   * @param indexA index of point within the array; target of the second vector
   * @returns undefined if index is out of bounds
   */
  public dotProductIndexIndexIndex(origin: number, indexA: number, indexB: number): number | undefined {
    if (origin < 0 || origin >= this.length || indexA < 0 || indexA >= this.length || indexB < 0 || indexB >= this.length)
      return undefined;
    const x0 = this.getXAtUncheckedPointIndex(origin);
    const y0 = this.getYAtUncheckedPointIndex(origin);
    const z0 = this.getZAtUncheckedPointIndex(origin);
    return (this.getXAtUncheckedPointIndex(indexA) - x0) * (this.getXAtUncheckedPointIndex(indexB) - x0) +
           (this.getYAtUncheckedPointIndex(indexA) - y0) * (this.getYAtUncheckedPointIndex(indexB) - y0) +
           (this.getZAtUncheckedPointIndex(indexA) - z0) * (this.getZAtUncheckedPointIndex(indexB) - z0);
  }
  /**
   * Return the dot product of the vectors from the point at `origin` to the point at `indexA` and to `targetB`.
   * @param origin index of point within the array; origin of both vectors
   * @param indexA index of point within the array; target of the first vector
   * @param targetB target for second vector
   * @returns undefined if index is out of bounds
   */
  public dotProductIndexIndexXYAndZ(origin: number, indexA: number, targetB: XYAndZ): number | undefined {
    if (origin < 0 || origin >= this.length || indexA < 0 || indexA >= this.length)
      return undefined;
    const x0 = this.getXAtUncheckedPointIndex(origin);
    const y0 = this.getYAtUncheckedPointIndex(origin);
    const z0 = this.getZAtUncheckedPointIndex(origin);
    return (this.getXAtUncheckedPointIndex(indexA) - x0) * (targetB.x - x0) +
           (this.getYAtUncheckedPointIndex(indexA) - y0) * (targetB.y - y0) +
           (this.getZAtUncheckedPointIndex(indexA) - z0) * (targetB.z - z0);
  }
  /**
   * Return the cross product of the vectors from `origin` to points at `indexA` and `indexB`
   * @param origin origin for vector
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract crossProductXYAndZIndexIndex(origin: XYAndZ, indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
   * Return the cross product of the vectors from `origin` to the point at `indexA` and to `targetB`
   * @param origin index of point within the array; origin of both vectors
   * @param indexA index of point within the array; target of the first vector
   * @param targetB target of second vector
   * @param result optional caller-allocated result to fill and return
   * @returns undefined if an index is out of bounds
   */
  public crossProductIndexIndexXYAndZ(origin: number, indexA: number, targetB: XYAndZ, result?: Vector3d): Vector3d | undefined {
    if (origin < 0 || origin >= this.length || indexA < 0 || indexA >= this.length)
      return undefined;
    const x0 = this.getXAtUncheckedPointIndex(origin);
    const y0 = this.getYAtUncheckedPointIndex(origin);
    const z0 = this.getZAtUncheckedPointIndex(origin);
    return Vector3d.createCrossProduct(this.getXAtUncheckedPointIndex(indexA) - x0,
                                       this.getYAtUncheckedPointIndex(indexA) - y0,
                                       this.getZAtUncheckedPointIndex(indexA) - z0,
                                       targetB.x - x0,
                                       targetB.y - y0,
                                       targetB.z - z0, result);
  }
  /**
   * Return the cross product of vectors from `origin` to points at `indexA` and `indexB`
   * @param origin origin for vector
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result optional caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract crossProductIndexIndexIndex(origin: number, indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
   * Return the cross product of vectors from origin point at `indexA` to target points at `indexB` and `indexC`
   * @param origin index of origin
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result caller-allocated vector.
   * @returns return true if indexA, indexB both valid
   */
  public abstract accumulateCrossProductIndexIndexIndex(origin: number, indexA: number, indexB: number, result: Vector3d): void;

  /**
   * read-only property for number of XYZ in the collection.
   */
  public abstract get length(): number;
  /**
   * Return distance squared between indicated points.
   * @param index0 first point index
   * @param index1 second point index
   */
  public abstract distanceSquaredIndexIndex(index0: number, index1: number): number | undefined;
  /**
   * Return distance squared between the point at index0 and target.
   * @param index0 first point index
   * @param target second point
   */
  public distanceSquaredIndexXYAndZ(index0: number, target: XYAndZ): number | undefined {
    if (index0 < 0 || index0 >= this.length)
      return undefined;
    return Geometry.hypotenuseSquaredXYZ(
      target.x - this.getXAtUncheckedPointIndex(index0),
      target.y - this.getYAtUncheckedPointIndex(index0),
      target.z - this.getZAtUncheckedPointIndex(index0));
  }
  /**
   * Return distance between indicated points.
   * @param index0 first point index
   * @param index1 second point index
   */
  public abstract distanceIndexIndex(index0: number, index1: number): number | undefined;

  /** Adjust index into range by modulo with the length. */
  public cyclicIndex(i: number): number {
    return (i % this.length);
  }
  /** Return the range of the points. */
  public getRange(): Range3d {
    const range = Range3d.createNull();
    const n = this.length;
    const point = Point3d.create();
    for (let i = 0; i < n; i++) {
      this.getPoint3dAtUncheckedPointIndex(i, point);
      range.extendPoint(point);
    }
    return range;
  }

  /**
   * For each run of points with indices i+1 to i+n within distance tolerance of points[i], return the indices i+1, ..., i+n.
   * @return ordered array of 0-based indices of duplicate points
   */
  public findOrderedDuplicates(tolerance: number = Geometry.smallMetricDistance): number[] {
    const tol2 = tolerance * tolerance;
    const indices: number[] = [];
    if (this.length > 1) {
      for (let i = 0; i < this.length - 1;) {
        let j = i + 1;
        for (; j < this.length; ++j) {
          const dist2 = this.distanceSquaredIndexIndex(i, j);
          if (dist2 !== undefined && dist2 < tol2)
            indices.push(j);
          else
            break;
        }
        i = j; // found next unique point
      }
    }
    return indices;
  }

  /** Accumulate scale times the x,y,z values at index.
   * * No action if index is out of bounds.
   */
  public abstract accumulateScaledXYZ(index: number, scale: number, sum: Point3d): void;

  /** Compute the linear combination s of the indexed p_i and given scales s_i.
   * @param scales array of scales. For best results, scales should have same length as the instance.
   * @param result optional pre-allocated object to fill and return
   * @return s = sum(p_i * s_i), where i ranges from 0 to min(this.length, scales.length).
  */
  public linearCombination(scales: number[], result?: Point3d | Vector3d): XYZ {
    const n = Math.min(this.length, scales.length);
    const sum = (result instanceof Vector3d) ? Vector3d.createZero(result) : Point3d.createZero(result);
    for (let i = 0; i < n; ++i) {
      sum.x += scales[i] * this.getXAtUncheckedPointIndex(i);
      sum.y += scales[i] * this.getYAtUncheckedPointIndex(i);
      sum.z += scales[i] * this.getZAtUncheckedPointIndex(i);
    }
    return sum;
  }

  /**
   * Interpolate the points at the given indices.
   * @param index0 index of point p0 within the array
   * @param fraction fraction f such that returned point is p0 + f * (p1 - p0)
   * @param index1 index of point p1 within the array
   * @param result optional caller-allocated result to fill and return
   * @returns undefined if an index is out of bounds
   */
  public interpolateIndexIndex(index0: number, fraction: number, index1: number, result?: Point3d): Point3d | undefined {
    if (index0 < 0 || index0 >= this.length || index1 < 0 || index1 >= this.length)
      return undefined;
    return Point3d.create(Geometry.interpolate(this.getXAtUncheckedPointIndex(index0), fraction, this.getXAtUncheckedPointIndex(index1)),
                          Geometry.interpolate(this.getYAtUncheckedPointIndex(index0), fraction, this.getYAtUncheckedPointIndex(index1)),
                          Geometry.interpolate(this.getZAtUncheckedPointIndex(index0), fraction, this.getZAtUncheckedPointIndex(index1)), result);
  }

  /** access x of indexed point */
  public abstract getXAtUncheckedPointIndex(pointIndex: number): number;

  /** access y of indexed point */
  public abstract getYAtUncheckedPointIndex(pointIndex: number): number;

  /** access z of indexed point */
  public abstract getZAtUncheckedPointIndex(pointIndex: number): number;

  /** Return iterator over the points in this collection. Usage:
   * ```ts
   *  for (const point: Point3d of collection.points) { ... }
   * ```
   */
  public get points(): Iterable<Point3d> {
    return new PointsIterator(this);
  }
  /** convert to Point3d[] */
  public getArray(): Point3d[] {
    const result = [];
    for (const p of this.points)
      result.push(p);
    return result;
  }
  /** Return the first point, or undefined if the array is empty. */
  public front(result?: Point3d): Point3d | undefined {
    if (this.length === 0)
      return undefined;
    return this.getPoint3dAtUncheckedPointIndex(0, result);
  }
  /** Return the last point, or undefined if the array is empty. */
  public back(result?: Point3d): Point3d | undefined {
    if (this.length === 0)
      return undefined;
    return this.getPoint3dAtUncheckedPointIndex(this.length - 1, result);
  }
  /**
   * Test whether the indexed points are equal within tolerance.
   * @param index0 index of first point
   * @param index1 index of second point
   * @param tolerance max coordinate difference to be considered equal. For exact test, pass 0. Defaults to `Geometry.smallMetricDistance`.
   */
  public almostEqualIndexIndex(index0: number, index1: number, tolerance = Geometry.smallMetricDistance): boolean | undefined {
    if (index0 < 0 || index0 >= this.length || index1 < 0 || index1 >= this.length)
      return undefined;
    return Geometry.isSameCoordinate(this.getXAtUncheckedPointIndex(index0), this.getXAtUncheckedPointIndex(index1), tolerance)
      && Geometry.isSameCoordinate(this.getYAtUncheckedPointIndex(index0), this.getYAtUncheckedPointIndex(index1), tolerance)
      && Geometry.isSameCoordinate(this.getZAtUncheckedPointIndex(index0), this.getZAtUncheckedPointIndex(index1), tolerance);
  }
}
/**
 * abstract base class extends IndexedXYZCollection, adding methods to push, peek, and pop, and rewrite.
 * @public
 */
export abstract class IndexedReadWriteXYZCollection extends IndexedXYZCollection {
  /** push a (clone of) point onto the collection
   * * point itself is not pushed -- xyz data is extracted into the native form of the collection.
   */
  public abstract push(data: XYAndZ): void;
  /**
   * push a new point (given by coordinates) onto the collection
   * @param x x coordinate
   * @param y y coordinate
   * @param z z coordinate
   */
  public abstract pushXYZ(x?: number, y?: number, z?: number): void;
  /** remove the final point. */
  public abstract pop(): void;
  /**  clear all entries */
  public abstract clear(): void;
  /** reverse the points in place. */
  public abstract reverseInPlace(): void;
}

/**
 * Type for use as signature for xyz data of a single linestring appearing in a parameter list.
 * @public
 */
export type LineStringDataVariant = IndexedXYZCollection | XYAndZ[] | XAndY[] | number[][];

/**
 * Type for use as signature for multiple xyz data of multiple linestrings appearing in a parameter list.
 * @public
 */
export type MultiLineStringDataVariant = LineStringDataVariant | LineStringDataVariant[];
