/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.format.opc;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { LittleEndian } from "../../../system/buffer/LittleEndian";
import { InStream } from "../../../system/io/InStream";
import { OutStream } from "../../../system/io/OutStream";
import { ALong } from "../../../system/runtime/ALong";
import { Numbers } from "../../../system/runtime/Numbers";
import { BlockIndex } from "../../model/BlockIndex";
import { GridIndex } from "../../model/GridIndex";

/**
 * Class BlockRecord defines a (32x32x32) block of tiles.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class BlockRecord {
  /** The size of the record in the file */
  public static readonly RECORD_SIZE: int32 = 24;

  /**
   * No instances.
   */
  private constructor() {}

  /**
   * Convert a tile grid index to a block grid index.
   * @param tileIndex the tile index.
   * @param blockSize the block size.
   * @return the block index.
   */
  public static toBlockIndex1(tileIndex: int32, blockSize: int32): int32 {
    if (tileIndex < 0) return Numbers.divInt(tileIndex + 1, blockSize) - 1;
    return Numbers.divInt(tileIndex, blockSize);
  }

  /**
   * Convert a tile grid index to a block grid index.
   * @param tileX the x index of the tile.
   * @param tileY the y index of the tile.
   * @param tileZ the z index of the tile.
   * @param blockSize the block size.
   * @return the block index.
   */
  public static toBlockIndex(tileX: int32, tileY: int32, tileZ: int32, blockSize: int32): GridIndex {
    return new GridIndex(
      BlockRecord.toBlockIndex1(tileX, blockSize),
      BlockRecord.toBlockIndex1(tileY, blockSize),
      BlockRecord.toBlockIndex1(tileZ, blockSize)
    );
  }

  /**
   * Write a record.
   * @param output the output stream.
   */
  public static write(block: BlockIndex, output: OutStream): void {
    let blockX: int32 = block.gridIndex.x;
    let blockY: int32 = block.gridIndex.y;
    let blockZ: int32 = block.gridIndex.z;
    LittleEndian.writeStreamInt(output, blockX);
    LittleEndian.writeStreamInt(output, blockY);
    LittleEndian.writeStreamInt(output, blockZ);
    LittleEndian.writeStreamInt(output, block.tileCount);
    LittleEndian.writeStreamLong(output, block.pointCount);
  }

  /**
   * Read a record.
   * @param level the level.
   * @param in the input stream from the file.
   * @param tileIndex the index of the tile.
   * @param pointIndex the index of the first point in the block.
   * @return the requested record.
   */
  public static readNew(
    level: int32,
    input: InStream,
    blockIndex: int32,
    tileIndex: int32,
    pointIndex: ALong
  ): BlockIndex {
    /* Read the record */
    let blockX: int32 = LittleEndian.readStreamInt(input);
    let blockY: int32 = LittleEndian.readStreamInt(input);
    let blockZ: int32 = LittleEndian.readStreamInt(input);
    let tileCount: int32 = LittleEndian.readStreamInt(input);
    let pointCount: ALong = LittleEndian.readStreamLong(input);
    /* Create the record */
    return new BlockIndex(
      level,
      blockIndex,
      new GridIndex(blockX, blockY, blockZ),
      tileIndex,
      tileCount,
      pointIndex,
      pointCount
    );
  }
}
