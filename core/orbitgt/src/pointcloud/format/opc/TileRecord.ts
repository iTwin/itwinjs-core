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

import { ABuffer } from "../../../system/buffer/ABuffer";
import { LittleEndian } from "../../../system/buffer/LittleEndian";
import { AList } from "../../../system/collection/AList";
import { InStream } from "../../../system/io/InStream";
import { OutStream } from "../../../system/io/OutStream";
import { ALong } from "../../../system/runtime/ALong";
import { Numbers } from "../../../system/runtime/Numbers";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { Grid } from "../../model/Grid";
import { GridIndex } from "../../model/GridIndex";
import { TileIndex } from "../../model/TileIndex";

/**
 * Class TileRecord defines a tile index record.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class TileRecord {
  /** The size of the record in the file */
  public static readonly RECORD_SIZE: int32 = 16;

  /**
   * No instances.
   */
  private constructor() {}

  /**
   * Check if this tile has a certain index.
   * @param tileX the tile x index.
   * @param tileY the tile y index.
   * @param tileZ the tile Z index.
   * @return true if the tile has the index.
   */
  public static isTile(tile: TileIndex, tileX: int32, tileY: int32, tileZ: int32): boolean {
    return tileX == tile.gridIndex.x && tileY == tile.gridIndex.y && tileZ == tile.gridIndex.z;
  }

  /**
   * Check if this tile is located after a certain index.
   * @param tileX the tile x index.
   * @param tileY the tile y index.
   * @param tileZ the tile Z index.
   * @return true if the tile is after the index.
   */
  public static isAfterTile(tile: TileIndex, tileX: int32, tileY: int32, tileZ: int32): boolean {
    if (tile.gridIndex.x < tileX) return false;
    if (tile.gridIndex.x > tileX) return true;
    if (tile.gridIndex.y < tileY) return false;
    if (tile.gridIndex.y > tileY) return true;
    if (tile.gridIndex.z < tileZ) return false;
    if (tile.gridIndex.z > tileZ) return true;
    return false;
  }

  /**
   * Check if this tile is located before a certain index.
   * @param tileX the tile x index.
   * @param tileY the tile y index.
   * @param tileZ the tile Z index.
   * @return true if the tile is before the index.
   */
  public static isBeforeTile(tile: TileIndex, tileX: int32, tileY: int32, tileZ: int32): boolean {
    if (tile.gridIndex.x < tileX) return true;
    if (tile.gridIndex.x > tileX) return false;
    if (tile.gridIndex.y < tileY) return true;
    if (tile.gridIndex.y > tileY) return false;
    if (tile.gridIndex.z < tileZ) return true;
    if (tile.gridIndex.z > tileZ) return false;
    return false;
  }

  /**
   * Write a record.
   * @param output the output stream.
   */
  public static write(tile: TileIndex, output: OutStream): void {
    let tileX: int32 = tile.gridIndex.x;
    let tileY: int32 = tile.gridIndex.y;
    let tileZ: int32 = tile.gridIndex.z;
    LittleEndian.writeStreamInt(output, tileX);
    LittleEndian.writeStreamInt(output, tileY);
    LittleEndian.writeStreamInt(output, tileZ);
    LittleEndian.writeStreamInt(output, tile.pointCount);
  }

  /**
   * Read a record.
   * @param tileGrid the grid.
   * @param stream the data stream from the file.
   * @param tileIndex the index of the tile.
   * @param pointIndex the index of the first point in the tile.
   * @return the requested record.
   */
  public static readNew(
    level: int32,
    tileGrid: Grid,
    stream: InStream,
    tileIndex: int32,
    pointIndex: ALong
  ): TileIndex {
    /* Read the record */
    let tileX: int32 = LittleEndian.readStreamInt(stream);
    let tileY: int32 = LittleEndian.readStreamInt(stream);
    let tileZ: int32 = LittleEndian.readStreamInt(stream);
    let pointCount: int32 = LittleEndian.readStreamInt(stream);
    /* Create the record */
    return new TileIndex(level, tileIndex, new GridIndex(tileX, tileY, tileZ), pointIndex, pointCount);
  }

  /**
   * Read a record.
   * @param in the input stream.
   * @param tileIndex the index of the tile.
   * @param pointIndex the index of the first point in the tile.
   */
  public static read(
    tile: TileIndex,
    level: int32,
    blockIndex: int32,
    stream: InStream,
    tileIndex: int32,
    pointIndex: ALong
  ): void {
    tile.level = level;
    tile.index = tileIndex;
    tile.gridIndex.x = LittleEndian.readStreamInt(stream);
    tile.gridIndex.y = LittleEndian.readStreamInt(stream);
    tile.gridIndex.z = LittleEndian.readStreamInt(stream);
    tile.pointCount = LittleEndian.readStreamInt(stream);
    tile.pointIndex = pointIndex;
  }

  /**
   * Get the squared distance to a grid cell.
   * @param reference the reference point.
   * @return the squared distance.
   */
  public static distanceSq(tile: TileIndex, reference: GridIndex): int32 {
    let dx: int32 = tile.gridIndex.x - reference.x;
    let dy: int32 = tile.gridIndex.y - reference.y;
    let dz: int32 = tile.gridIndex.z - reference.z;
    return dx * dx + dy * dy + dz * dz;
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
   * @param index the index at the current level.
   * @return the next-level index.
   */
  public static getNextLevelIndex(index: GridIndex): GridIndex {
    let nextX: int32 = TileRecord.getNextLevelIndex1(index.x);
    let nextY: int32 = TileRecord.getNextLevelIndex1(index.y);
    let nextZ: int32 = TileRecord.getNextLevelIndex1(index.z);
    return new GridIndex(nextX, nextY, nextZ);
  }
}
