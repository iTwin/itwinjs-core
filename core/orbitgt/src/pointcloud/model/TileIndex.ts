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
 * Class TileIndex defines a tile index in a pointcloud file.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class TileIndex {
  /** The level */
  public level: int32;
  /** The unique key of the block */
  public key: string;
  /** The index of the tile in the level */
  public index: int32;
  /** The grid index */
  public gridIndex: GridIndex;
  /** The index of the first point in the tile (derived) */
  public pointIndex: ALong;
  /** The point count */
  public pointCount: int32;
  /** The children */
  public children: Array<TileIndex>;
  /** The last access time */
  public accessTime: float64;

  /**
   * Create a new index.
   */
  public constructor(
    level: int32,
    index: int32,
    gridIndex: GridIndex,
    pointIndex: ALong,
    pointCount: int32
  ) {
    this.level = level;
    this.index = index;
    this.gridIndex = gridIndex;
    this.pointIndex = pointIndex;
    this.pointCount = pointCount;
    this.children = null;
    this.accessTime = 0.0;
    this.key = "L" + this.level + ",T:" + this.index;
  }

  /**
   * Check if two indexes are the same.
   * @param other another index.
   * @return true if same.
   */
  public same(other: TileIndex): boolean {
    return other.level == this.level && other.index == this.index;
  }

  /**
   * Get the unique key of the tile in the pointcloud file.
   * @return the unique key (combines level and grid index).
   */
  public getKey(): string {
    return (
      "T" +
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
