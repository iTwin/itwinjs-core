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

import { Bounds } from "../../spatial/geom/Bounds";
import { AList } from "../../system/collection/AList";
import { ALong } from "../../system/runtime/ALong";
import { ContentLoader } from "../../system/storage/ContentLoader";
import { FileStorage } from "../../system/storage/FileStorage";
import { AttributeValue } from "./AttributeValue";
import { BlockIndex } from "./BlockIndex";
import { CloudPoint } from "./CloudPoint";
import { Grid } from "./Grid";
import { PointAttribute } from "./PointAttribute";
import { PointData } from "./PointData";
import { ReadRequest } from "./ReadRequest";
import { TileIndex } from "./TileIndex";

/**
 * Abstract class PointCloudReader allows reading of blocks, tiles and points from pointcloud files using the two-step content loader technique.
 *
 * Point cloud access often results in many requests for small parts of the point cloud file. To avoid making too many requests a content loader can be used.
 *
 * Create a new content loader and call the needed methods to gather the file ranges to fetch from storage, ignoring the method results.
 * Then await the content loader request to load all needed data and wait for the results.
 * Then call the needed method again, they will have access to the data and return the right results.
 * This technique allows a single fetch request from storage to return multiple small file content ranges.
 *
 * @version 1.0 March 2016
 */
/** @internal */
export class PointCloudReader {
  /**
   * Create a new reader.
   */
  public constructor() {}

  /**
   * Close the reader.
   */
  public close(): void {}

  /**
   * Get a certain property of the reader.
   * @return the value (null if not defined).
   */
  public getProperty(propertyName: string): Object {
    return null;
  }

  /**
   * Get the storage of the file.
   * @return the storage of the file.
   */
  public getFileStorage(): FileStorage {
    return null;
  }

  /**
   * Get the name of the file.
   * @return the name of the file.
   */
  public getFileName(): string {
    return null;
  }

  /**
   * Get the CRS of the file.
   * @return the CRS of the file.
   */
  public getFileCRS(): string {
    return null;
  }

  /**
   * Get the spatial bounds of the file.
   * @return the spatial bounds of the file.
   */
  public getFileBounds(): Bounds {
    return null;
  }

  /**
   * Get the attributes of the points.
   * @return the attributes of the points.
   */
  public getPointAttributes(): Array<PointAttribute> {
    return null;
  }

  /**
   * Get the minimum value of an attribute.
   * @param attribute the attribute.
   * @return the minimum value (null if unknown).
   */
  public getMinAttributeValue(attribute: PointAttribute): AttributeValue {
    return null;
  }

  /**
   * Get the maximum value of an attribute.
   * @param attribute the attribute.
   * @return the maximum value (null if unknown).
   */
  public getMaxAttributeValue(attribute: PointAttribute): AttributeValue {
    return null;
  }

  /**
   * Get the number of levels.
   * @return the number of levels.
   */
  public getLevelCount(): int32 {
    return 0;
  }

  /**
   * Get the number of points.
   * @param level the index of the level.
   * @return the number of points.
   */
  public getLevelPointCount(level: int32): ALong {
    return ALong.ZERO;
  }

  /**
   * Get the bounds of points.
   * @param level the index of the level.
   * @return the bounds of points.
   */
  public getLevelPointBounds(level: int32): Bounds {
    return null;
  }

  /**
   * Get the block grid.
   * @param level the index of the level.
   * @return the block grid (null if there is no spatial grid).
   */
  public getLevelBlockGrid(level: int32): Grid {
    return null;
  }

  /**
   * Get the tile grid.
   * @param level the index of the level.
   * @return the tile grid (null if there is no spatial grid).
   */
  public getLevelTileGrid(level: int32): Grid {
    return null;
  }

  /**
   * Peek at block indexes.
   * @param level the index of the level.
   * @return the block indexes (zero length if the level has not yet been accessed in case of lazy loading).
   */
  public peekBlockIndexes(level: int32): Array<BlockIndex> {
    return null;
  }

  /**
   * Read block indexes (with a 2-step file content fetching sequence).
   * @param level the index of the level.
   * @param fileContents the file contents.
   * @return the tile indexes.
   */
  public readBlockIndexes(
    level: int32,
    fileContents: ContentLoader
  ): Array<BlockIndex> {
    return null;
  }

  /**
   * Read tile indexes (with a 2-step file content fetching sequence).
   * @param block the index of the block.
   * @param fileContents the file contents.
   * @return the tile indexes.
   */
  public readTileIndexes(
    block: BlockIndex,
    fileContents: ContentLoader
  ): Array<TileIndex> {
    return null;
  }

  /**
   * Read the points of a tile (with a 2-step file content fetching sequence).
   * @param tileIndex the tile index.
   * @param parameters the read parameters (contains the result read statistics).
   * @param fileContents the file contents.
   * @param processor the point processor.
   */
  public readPoints(
    tileIndex: TileIndex,
    parameters: ReadRequest,
    fileContents: ContentLoader
  ): AList<CloudPoint> {
    return null;
  }

  /**
   * Read the points of a tile (with a 2-step file content fetching sequence).
   * @param tileIndex the tile index.
   * @param dataFormat the data format.
   * @param accessTime the current access time.
   * @param fileContents the file contents.
   */
  public readPointData(
    tileIndex: TileIndex,
    dataFormat: int32,
    accessTime: float64,
    fileContents: ContentLoader
  ): PointData {
    return null;
  }

  /**
   * Clip the reader to a certain range of levels.
   * @param levelOffset the index of the first level.
   * @param levelCount the number of levels.
   * @return the clipped pointcloud.
   */
  public clipToLevelRange(
    levelOffset: int32,
    levelCount: int32
  ): PointCloudReader {
    return null;
  }
}
