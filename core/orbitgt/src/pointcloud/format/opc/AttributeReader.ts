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

import { ALong } from "../../../system/runtime/ALong";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { AttributeValue } from "../../model/AttributeValue";
import { CloudPoint } from "../../model/CloudPoint";
import { PointAttribute } from "../../model/PointAttribute";
import { ReadRequest } from "../../model/ReadRequest";
import { TileIndex } from "../../model/TileIndex";
import { TileReadBuffer } from "./TileReadBuffer";

/**
 * Class AttributeReader reads attribute data.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export abstract class AttributeReader {
  /**
   * Create a new reader.
   */
  public constructor() {}

  /**
   * Close the reader.
   */
  public abstract close(): void;

  /**
   * Get the attribute.
   * @return the attribute.
   */
  public abstract getAttribute(): PointAttribute;

  /**
   * Get the minimum value.
   * @return the minimum value.
   */
  public abstract getMinimumValue(): AttributeValue;

  /**
   * Get the maximum value.
   * @return the maximum value.
   */
  public abstract getMaximumValue(): AttributeValue;

  /**
   * Read the raw data for a tile.
   * @param level the index of the level.
   * @param tile the tile.
   * @param tileBuffer the buffer to read into.
   * @param bufferIndex the index of the attribute in the read buffer.
   * @param readRequest the read parameters (contains the result read statistics).
   */
  public abstract readTileData2(
    level: int32,
    tile: TileIndex,
    pointOffset: ALong,
    pointCount: int32,
    tileBuffer: TileReadBuffer,
    bufferIndex: int32,
    readRequest: ReadRequest,
    fileContents: ContentLoader
  ): void;

  /**
   * Get an attribute value.
   * @param level the index of the level.
   * @param tile the tile.
   * @param tileBuffer the buffer that has been read.
   * @param bufferIndex the index of the attribute in the read buffer.
   * @param pointIndex the index of the point in the tile (starts at 0).
   * @param cloudPoint the point to read the attribute of.
   */
  public abstract getPointData(
    level: int32,
    tile: TileIndex,
    tileBuffer: TileReadBuffer,
    bufferIndex: int32,
    pointIndex: int32,
    cloudPoint: CloudPoint
  ): void;
}
