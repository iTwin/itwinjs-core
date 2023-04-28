/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.model;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Numbers } from "../../system/runtime/Numbers";

/** @internal */
export class GridIndex {
  /** The x index */
  public x: int32;
  /** The y index */
  public y: int32;
  /** The z index */
  public z: int32;

  /**
   * Create a new point.
   * @param x the x index.
   * @param y the y index.
   * @param z the z index.
   */
  public constructor(x: int32, y: int32, z: int32) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Get the square distance to another cell.
   * @param other the other cell.
   * @return the square distance.
   */
  public distanceSq(other: GridIndex): int32 {
    let dx: int32 = other.x - this.x;
    let dy: int32 = other.y - this.y;
    let dz: int32 = other.z - this.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Get the distance to another cell.
   * @param other the other cell.
   * @return the distance.
   */
  public distance(other: GridIndex): float64 {
    return Numbers.sqrt(this.distanceSq(other));
  }

  /**
   * Get a next-level index.
   * @param index the index at the current level.
   * @return the next-level index.
   */
  private static getNextLevelIndex1(index: int32): int32 {
    if (index < 0) return Numbers.divInt(index - 1, 2);
    return Numbers.divInt(index, 2);
  }

  /**
   * Get a next-level index.
   * @param nextLevel the index at the next level.
   */
  public getNextLevelIndex(nextLevel: GridIndex): void {
    nextLevel.x = GridIndex.getNextLevelIndex1(this.x);
    nextLevel.y = GridIndex.getNextLevelIndex1(this.y);
    nextLevel.z = GridIndex.getNextLevelIndex1(this.z);
  }

  /**
   * Does this point equal another?
   * @param other the other point.
   * @return true if equal.
   */
  public same(other: GridIndex): boolean {
    return other.x == this.x && other.y == this.y && other.z == this.z;
  }

  /**
   * Create a copy.
   * @return a copy.
   */
  public copy(): GridIndex {
    return new GridIndex(this.x, this.y, this.z);
  }

  /**
   * Get the unique key.
   * @return the unique key.
   */
  public getKey(): string {
    return "{x:" + this.x + ",y:" + this.y + ",z:" + this.z + "}";
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return "[GridPoint3D:" + this.x + "," + this.y + "," + this.z + "]";
  }
}
