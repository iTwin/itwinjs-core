/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { Point2d, Vector2d, XY } from "./Point2dVector2d";
import { XAndY } from "./XYZProps";

/**
 * abstract base class for access to XY data with indexed reference.
 * * This allows algorithms to work with Point2d[] or GrowableXY.
 *   * GrowableXYArray implements these for its data.
 *   * Point2dArrayCarrier carries a (reference to) a Point2d[] and implements the methods with calls on that array reference.
 * * In addition to "point by point" accessors, other abstract members compute commonly useful vector data "between points".
 * * Methods that create vectors among multiple indices allow callers to avoid creating temporaries.
 * @public
 */
export abstract class IndexedXYCollection {
  /**
   * Get from `index` as a `Point2d`
   * @param index index of point within the array
   * @param result optional caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract getPoint2dAtCheckedPointIndex(index: number, result?: Point2d): Point2d | undefined;
  /**
   * Get from `index` as a `Vector2d`
   * @param index index of point within the array
   * @param result optional caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract getVector2dAtCheckedVectorIndex(index: number, result?: Vector2d): Vector2d | undefined;
  /**
   * Return a vector from the point at `indexA` to the point at `indexB`
   * @param indexA index of point within the array
   * @param indexB index of point within the array
   * @param result optional caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract vectorIndexIndex(indexA: number, indexB: number, result?: Vector2d): Vector2d | undefined;
  /**
   * Return a vector from given origin to the point at `indexB`
   * @param origin origin for vector
   * @param indexB index of point within the array
   * @param result optional caller-allocated vector.
   * @returns undefined if index is out of bounds
   */
  public abstract vectorXAndYIndex(origin: XAndY, indexB: number, result?: Vector2d): Vector2d | undefined;

  /**
   * Return the cross product of vectors from `origin` to points at `indexA` and `indexB`
   * @param origin origin for vector
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result optional caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract crossProductXAndYIndexIndex(origin: XAndY, indexA: number, indexB: number): number | undefined;
  /**
   * Return the cross product of vectors from origin point at `indexA` to target points at `indexB` and `indexC`
   * @param origin index of origin
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result optional caller - allocated vector.
   * @returns return true if indexA, indexB both valid
   */
  public abstract crossProductIndexIndexIndex(origin: number, indexA: number, indexB: number): number | undefined;

  /**
   * read-only property for number of XY in the collection.
   */
  public abstract get length(): number;

  private static _workPoint?: Point2d;

  /** access x of indexed point
   * * Subclasses may wish to override with a more efficient implementation.
   */
  public getXAtUncheckedPointIndex(pointIndex: number): number {
    const pt = this.getPoint2dAtCheckedPointIndex(pointIndex, IndexedXYCollection._workPoint);
    if (undefined === IndexedXYCollection._workPoint)
      IndexedXYCollection._workPoint = pt;  // allocate the cache
    return pt ? pt.x : 0.0;
  }

  /** access y of indexed point
   * * Subclasses may wish to override with a more efficient implementation.
   */
  public getYAtUncheckedPointIndex(pointIndex: number): number {
    const pt = this.getPoint2dAtCheckedPointIndex(pointIndex, IndexedXYCollection._workPoint);
    if (undefined === IndexedXYCollection._workPoint)
      IndexedXYCollection._workPoint = pt;  // allocate the cache
    return pt ? pt.y : 0.0;
  }

  /** Compute the linear combination s of the indexed p_i and given scales s_i.
   * @param scales array of scales. For best results, scales should have same length as the instance.
   * @param result optional pre-allocated object to fill and return
   * @return s = sum(p_i * s_i), where i ranges from 0 to min(this.length, scales.length).
   */
  public linearCombination(scales: number[], result?: Point2d | Vector2d): XY {
    const n = Math.min(this.length, scales.length);
    const sum = (result instanceof Vector2d) ? Vector2d.createZero(result) : Point2d.createZero(result);
    for (let i = 0; i < n; ++i) {
      sum.x += scales[i] * this.getXAtUncheckedPointIndex(i);
      sum.y += scales[i] * this.getYAtUncheckedPointIndex(i);
    }
    return sum;
  }
}
