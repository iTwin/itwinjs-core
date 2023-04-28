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

import { ALong } from "../../system/runtime/ALong";
import { GridIndex } from "./GridIndex";

/**
 * Class BlockIndex defines a block index in a pointcloud file.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class BlockIndex {
  /** The level */
  public level: int32;
  /** The unique key of the block */
  public key: string;
  /** The index of the block in the level */
  public index: int32;
  /** The grid index */
  public gridIndex: GridIndex;
  /** The index of the first tile in the block (derived) */
  public tileIndex: int32;
  /** The tile count */
  public tileCount: int32;
  /** The index of the first point in the block (derived) */
  public pointIndex: ALong;
  /** The point count */
  public pointCount: ALong;
  /** The last access time */
  public accessTime: float64;

  /**
   * Create a new index.
   */
  public constructor(
    level: int32,
    index: int32,
    gridIndex: GridIndex,
    tileIndex: int32,
    tileCount: int32,
    pointIndex: ALong,
    pointCount: ALong
  ) {
    this.level = level;
    this.index = index;
    this.gridIndex = gridIndex;
    this.tileIndex = tileIndex;
    this.tileCount = tileCount;
    this.pointIndex = pointIndex;
    this.pointCount = pointCount;
    this.accessTime = 0.0;
    this.key = "L" + this.level + ",B:" + this.index;
  }

  /**
   * Check if two indexes are the same.
   * @param other another index.
   * @return true if same.
   */
  public same(other: BlockIndex): boolean {
    return other.level == this.level && other.index == this.index;
  }

  /**
   * Get the unique key of the block in the pointcloud file.
   * @return the unique key (combines level and grid index).
   */
  public getKey(): string {
    return (
      "B" +
      this.level +
      "/" +
      this.gridIndex.x +
      "/" +
      this.gridIndex.y +
      "/" +
      this.gridIndex.z
    );
  }
}
