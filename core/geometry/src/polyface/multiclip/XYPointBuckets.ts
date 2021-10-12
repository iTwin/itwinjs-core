/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Geometry } from "../../Geometry";
import { IndexedXYZCollection } from "../../geometry3d/IndexedXYZCollection";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range2d, Range3d } from "../../geometry3d/Range";
import { LowAndHighXY } from "../../geometry3d/XYZProps";

/** Type for a value which may be either (a) undefined or (b) an array of type []. */
export type OptionalArray<T> = T[] | undefined;
/**
 * Arrays of type T values distributed by xy position when entered.
 * @internal
 */
export class XYIndexGrid<T> {
  private _range: Range2d;
  private _numXEdge: number;
  private _numYEdge: number;

  private _data: Array<Array<OptionalArray<T>>>; // _indices[j][i][k] = index k value in row j block i

  protected constructor(range: Range2d, numX: number, numY: number) {
    this._range = range;
    this._numXEdge = Math.max(numX, 1);
    this._numYEdge = Math.max(numY, 1);
    this._data = [];
    for (let j = 0; j < numY; j++) {
      const thisRow: Array<OptionalArray<T>> = [];
      for (let i = 0; i < numX; i++) {
        thisRow.push(undefined);
      }
      this._data.push(thisRow);
    }
  }
  /** Return the number of x edges in the grid */
  public get numXEdge(): number { return this._numXEdge; }
  /** Return the number of y edges in the grid */
  public get numYEdge(): number { return this._numYEdge; }

  /** Return the `i` index of cells containing x coordinate */
  public xIndex(x: number): number {
    const fraction = (x - this._range.low.x) / (this._range.high.x - this._range.low.x);
    const q = Math.floor(fraction * this._numXEdge);
    if (q < 0)
      return 0;
    if (q > this._numXEdge - 1)
      return this._numXEdge - 1;
    return q;
  }
  /** Return the `j` index of cells containing x coordinate */
  public yIndex(y: number): number {
    const fraction = (y - this._range.low.y) / (this._range.high.y - this._range.low.y);
    const q = Math.floor(fraction * this._numYEdge);
    if (q < 0)
      return 0;
    if (q > this._numYEdge - 1)
      return this._numYEdge - 1;
    return q;
  }
  /**
   * Construct an array with cells mapped to a range, with counts determined by estimated total count and target number of entries per cell.
   * @param range
   * @param totalEntries
   * @param targetEntriesPerCell
   */
  public static createWithEstimatedCounts<T>(range: LowAndHighXY, totalEntries: number, targetEntriesPerCell: number): XYIndexGrid<T> | undefined {
    if (range.low.x >= range.high.x || range.low.y >= range.high.y)
      return undefined;
    const range2d = Range2d.createXYXY(range.low.x, range.low.y, range.high.x, range.high.y);

    const dx = range2d.xLength();
    const dy = range2d.yLength();
    // numX / numY = dX / dY  (numX,numY will be integers  . . .)
    // numX = dX * numY / dY
    let numX: number;
    let numY: number;
    if (dy > dx) {
      numY = Math.ceil(Math.sqrt(dy * totalEntries / (targetEntriesPerCell * dx)));
      numX = Math.ceil(totalEntries / numY);
    } else {
      numX = Math.ceil(Math.sqrt(dx * totalEntries / (targetEntriesPerCell * dy)));
      numY = Math.ceil(totalEntries / (numX * targetEntriesPerCell));
    }
    return new XYIndexGrid(range2d, numX, numY);
  }
  /**
   * Add (save) a new data value to the grid cell containing x,y
   * @param x
   * @param y
   * @param value
   */
  public addDataAtXY(x: number, y: number, value: T) {
    const i = this.xIndex(x);
    const j = this.yIndex(y);
    let dataJI = this._data[j][i];
    if (!dataJI) {
      dataJI = [];
      this._data[j][i] = dataJI;
    }
    dataJI.push(value);
    return;
  }
  /**
   * Get the (reference to the possibly null array of) data values for the cell indicated by xy.
   * @param x
   * @param y
   */
  public getDataAtXY(x: number, y: number): OptionalArray<T> {
    const i = this.xIndex(x);
    const j = this.yIndex(y);
    return this._data[j][i];
  }

  /**
   * Get the (reference to the possibly null array of) data values for the cell indicated by indices in the x and y direction
   * @param xIndex
   * @param yIndex
   */
  public getDataAtIndex(xIndex: number, yIndex: number): OptionalArray<T> {
    if (xIndex < 0)
      return undefined;
    if (xIndex >= this._numXEdge)
      return undefined;
    if (yIndex < 0)
      return undefined;
    if (yIndex >= this._numYEdge)
      return undefined;

    return this._data[yIndex][xIndex];
  }
  /** Return true if (xIndex, yIndex) is a valid cell index. */
  public isValidIndex(xIndex: number, yIndex: number): boolean {
    if (xIndex < 0)
      return false;
    if (xIndex >= this._numXEdge)
      return false;
    if (yIndex < 0)
      return false;
    if (yIndex >= this._numYEdge)
      return false;
    return true;
  }
}
/** Manage buckets of points for fast search.
 * @internal
 */
export class XYPointBuckets {
  private _points: IndexedXYZCollection;
  private _buckets: XYIndexGrid<number>;
  /** Return the underlying grid with indices recorded by block */
  public get indexGrid(): XYIndexGrid<number> { return this._buckets; }
  private constructor(points: IndexedXYZCollection, buckets: XYIndexGrid<number>) {
    this._points = points;
    this._buckets = buckets;
  }
  /** Create an XYIndex grid with all indices of all `points` entered */
  public static create(points: IndexedXYZCollection, targetPointsPerCell: number): XYPointBuckets | undefined {
    const n = points.length;
    if (points.length < 1)
      return undefined;
    const range = points.getRange();
    range.expandInPlace(Geometry.smallMetricDistance * 1000.0);
    const buckets = XYIndexGrid.createWithEstimatedCounts<number>(range, points.length, targetPointsPerCell);
    if (buckets === undefined)
      return undefined;
    const result = new XYPointBuckets(points, buckets);
    const point = Point3d.create();
    for (let i = 0; i < n; i++) {
      points.getPoint3dAtUncheckedPointIndex(i, point);
      buckets.addDataAtXY(point.x, point.y, i);
    }
    return result;
  }
  /** call the `announce` function with the index and coordinates of all points in given range.
   * * continue the search if `announce` returns true.
   * * terminate the search if `announce` returns false;
   */
  public announcePointsInRange(range: Range2d | Range3d, announce: (index: number, x: number, y: number, z: number) => boolean) {
    const i0 = this._buckets.xIndex(range.low.x);
    const i1 = this._buckets.xIndex(range.high.x);
    const j0 = this._buckets.yIndex(range.low.y);
    const j1 = this._buckets.yIndex(range.high.y);
    const n = this._points.length;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const candidates = this._buckets.getDataAtIndex(i, j);
        if (candidates !== undefined) {
          for (const k of candidates) {
            if (k < n) {
              const x = this._points.getXAtUncheckedPointIndex(k);
              const y = this._points.getYAtUncheckedPointIndex(k);
              const z = this._points.getZAtUncheckedPointIndex(k);
              if (range.containsXY(x, y))
                if (!announce(k, x, y, z))
                  return;
            }
          }
        }
      }
    }
  }
}
