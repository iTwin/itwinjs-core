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
import { OutStream } from "../../../system/io/OutStream";
import { ALong } from "../../../system/runtime/ALong";
import { ContentLoader } from "../../../system/storage/ContentLoader";

/**
 * Class DirectoryRecord defines a directory record.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class DirectoryRecord {
  /** The number of points (8 byte) */
  private _pointCount: ALong;
  /** The number of tiles (4 byte) */
  private _tileCount: int32;
  /** The number of blocks (4 byte) */
  private _blockCount: int32;

  /**
   * Create a new record.
   */
  public constructor(pointCount: ALong, tileCount: int32, blockCount: int32) {
    this._pointCount = pointCount;
    this._tileCount = tileCount;
    this._blockCount = blockCount;
  }

  /**
   * Get the number of points.
   * @return the number.
   */
  public getPointCount(): ALong {
    return this._pointCount;
  }

  /**
   * Get the number of tiles.
   * @return the number.
   */
  public getTileCount(): int32 {
    return this._tileCount;
  }

  /**
   * Get the number of blocks.
   * @return the number.
   */
  public getBlockCount(): int32 {
    return this._blockCount;
  }

  /**
   * Read a record.
   * @param data the record data.
   * @return the record.
   */
  private static readFromBuffer(data: ABuffer): DirectoryRecord {
    /* Get the record fields */
    let pointCount: ALong = LittleEndian.readBufferLong(data, 0);
    let tileCount: int32 = LittleEndian.readBufferInt(data, 8);
    let blockCount: int32 = LittleEndian.readBufferInt(data, 12);
    /* Return the record */
    return new DirectoryRecord(pointCount, tileCount, blockCount);
  }

  /**
   * Read a record.
   * @param offset the file offset to the record.
   * @param size the file size to the record.
   * @return the record.
   */
  public static readNew(
    offset: ALong,
    size: ALong,
    contentLoader: ContentLoader
  ): DirectoryRecord {
    /* Request the data? */
    if (contentLoader.isLoaded() == false) {
      /* Add the range */
      contentLoader.requestFilePart(offset, size.toInt());
      return null;
    }
    /* Get the data */
    let data: ABuffer = contentLoader.getFilePart(offset, size.toInt());
    /* Parse the record */
    return DirectoryRecord.readFromBuffer(data);
  }

  /**
   * Write the record.
   * @param output the output stream.
   */
  public write(output: OutStream): void {
    LittleEndian.writeStreamLong(output, this._pointCount);
    LittleEndian.writeStreamInt(output, this._tileCount);
    LittleEndian.writeStreamInt(output, this._blockCount);
  }
}
