/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { IndexedXYCollection } from "./IndexedXYCollection";
/* eslint-disable @typescript-eslint/naming-convention, no-empty */
import { Point2d, Vector2d, XY } from "./Point2dVector2d";
import { XAndY } from "./XYZProps";

/**
 * Helper object to access members of a Point2d[] in geometric calculations.
 * * The collection holds only a reference to the actual array.
 * * The actual array may be replaced by the user as needed.
 * * When replaced, there is no cached data to be updated.
 * @public
*/
export class Point2dArrayCarrier extends IndexedXYCollection {
  /** reference to array being queried. */
  public data: Point2d[];
  /** CAPTURE caller supplied array ... */
  public constructor(data: Point2d[]) {
    super();
    this.data = data;
  }
  /** test if index is valid  */
  public isValidIndex(index: number): boolean {
    return index >= 0 && index < this.data.length;
  }
  /**
   * Access by index, returning strongly typed Point2d
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public getPoint2dAtCheckedPointIndex(index: number, result?: Point2d): Point2d | undefined {
    if (this.isValidIndex(index)) {
      const source = this.data[index];
      return Point2d.create(source.x, source.y, result);
    }
    return undefined;
  }
  /**
   * Access by index, returning strongly typed Vector2d
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public getVector2dAtCheckedVectorIndex(index: number, result?: Vector2d): Vector2d | undefined {
    if (this.isValidIndex(index)) {
      const source = this.data[index];
      return Vector2d.create(source.x, source.y, result);
    }
    return undefined;
  }
  /**
   * Return a vector from the point at indexA to the point at indexB
   * @param indexA index of point within the array
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public vectorIndexIndex(indexA: number, indexB: number, result?: Vector2d): Vector2d | undefined {
    if (this.isValidIndex(indexA) && this.isValidIndex(indexB))
      return Vector2d.createStartEnd(this.data[indexA], this.data[indexB], result);
    return undefined;
  }
  /**
   * Return a vector from given origin to point at indexB
   * @param origin origin for vector
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if index is out of bounds
   */
  public vectorXAndYIndex(origin: XAndY, indexB: number, result?: Vector2d): Vector2d | undefined {
    if (this.isValidIndex(indexB))
      return Vector2d.createStartEnd(origin, this.data[indexB], result);
    return undefined;
  }

  /**
   * Return the cross product of vectors from origin to points at indexA and indexB
   * @param origin origin for vector
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public crossProductXAndYIndexIndex(origin: XAndY, indexA: number, indexB: number): number | undefined {
    if (this.isValidIndex(indexA) && this.isValidIndex(indexB))
      return XY.crossProductToPoints(origin, this.data[indexA], this.data[indexB]);
    return undefined;
  }
  /**
 * Return the cross product of vectors from point at originIndex to points at indexA and indexB
 * @param originIndex index of origin
 * @param indexA index of first target within the array
 * @param indexB index of second target within the array
 * @param result caller-allocated vector.
 * @returns return true if indexA, indexB both valid
 */
  public crossProductIndexIndexIndex(originIndex: number, indexA: number, indexB: number): number | undefined {
    if (this.isValidIndex(originIndex) && this.isValidIndex(indexA) && this.isValidIndex(indexB))
      return XY.crossProductToPoints(this.data[originIndex], this.data[indexA], this.data[indexB]);
    return undefined;
  }
  /**
   * read-only property for number of XYZ in the collection.
   */
  public get length(): number {
    return this.data.length;
  }
}
