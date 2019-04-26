/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module CartesianGeometry */

/* tslint:disable:variable-name jsdoc-format no-empty */
import { Point2d, Vector2d, XY } from "./Point2dVector2d";
import { XAndY } from "./XYZProps";
import { IndexedXYCollection } from "./IndexedXYCollection";

/**
 * Helper object to access members of a Point2d[] in geometric calculations.
 * * The collection holds only a reference to the actual array.
 * * The actual array may be replaced by the user as needed.
 * * When replaced, there is no cached data to be updated.
 * @public
*/
export class Point2dArrayCarrier extends IndexedXYCollection {
  public data: Point2d[];
  /** CAPTURE caller supplied array ... */
  public constructor(data: Point2d[]) {
    super();
    this.data = data;
  }
  public isValidIndex(index: number): boolean {
    return index >= 0 && index < this.data.length;
  }
  /**
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
