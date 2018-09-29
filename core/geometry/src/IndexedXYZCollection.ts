/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module ArraysAndInterfaces */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty */
import { Point3d, Vector3d, XYAndZ } from "./PointVector";

/**
 * abstract base class for access to XYZ data with indexed reference.
 * * This allows algorithms to work with Point3d[] or GrowableXYZ.
 * ** GrowableXYZArray implements these for its data.
 * ** Point3dArrayCarrier carries a (reference to) a Point3d[] and implements the methods with calls on that array reference.
 * * In addition to "point by point" accessors, there abstract members compute commonly useful vector data "between points".
 * * Methods that create vectors among multiple indices allow callers to avoid creating temporaries.
*/
export abstract class IndexedXYZCollection {
  /**
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract atPoint3dIndex(index: number, result?: Point3d): Point3d | undefined;
  /**
   * @param index index of point within the array
   * @param result caller-allocated destination
   * @returns undefined if the index is out of bounds
   */
  public abstract atVector3dIndex(index: number, result?: Vector3d): Vector3d | undefined;
  /**
   * @param indexA index of point within the array
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract vectorIndexIndex(indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
   * @param origin origin for vector
   * @param indexB index of point within the array
   * @param result caller-allocated vector.
   * @returns undefined if index is out of bounds
   */
  public abstract vectorXYAndZIndex(origin: XYAndZ, indexB: number, result?: Vector3d): Vector3d | undefined;

  /**
   * @param origin origin for vector
   * @param indexA index of first target within the array
   * @param indexB index of second target within the array
   * @param result caller-allocated vector.
   * @returns undefined if either index is out of bounds
   */
  public abstract crossProductXYAndZIndexIndex(origin: XYAndZ, indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
 * @param origin index of origin
 * @param indexA index of first target within the array
 * @param indexB index of second target within the array
 * @param result caller-allocated vector.
 * @returns return true if indexA, indexB both valid
 */
  public abstract crossProductIndexIndexIndex(origin: number, indexA: number, indexB: number, result?: Vector3d): Vector3d | undefined;
  /**
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
}
