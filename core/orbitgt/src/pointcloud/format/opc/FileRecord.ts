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
import { FileStorage } from "../../../system/storage/FileStorage";

/**
 * Class FileRecord defines the global file record.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class FileRecord {
  /** The optionsALong */
  private _options: int32;
  /** The CRS */
  private _crs: string;
  /** The number of levels (4 byte) */
  private _levelCount: int32;
  /** The number of attributes (4 byte) */
  private _attributeCount: int32;
  /** The size of the blocks (4 byte) */
  private _blockSize: int32;
  /** The metric level-0 cell size (8 byte) */
  private _metricCellSize: float64;
  /** The creation timestamp (8 byte) */
  private _creationTime: ALong;

  /**
   * Create a new record.
   */
  public constructor(
    options: int32,
    crs: string,
    levelCount: int32,
    attributeCount: int32,
    blockSize: int32,
    metricCellSize: float64,
    creationTime: ALong
  ) {
    this._options = options;
    this._crs = crs;
    this._levelCount = levelCount;
    this._attributeCount = attributeCount;
    this._blockSize = blockSize;
    this._metricCellSize = metricCellSize;
    this._creationTime = creationTime;
  }

  /**
   * Get the options.
   * @return the options.
   */
  public getOptions(): int32 {
    return this._options;
  }

  /**
   * Get the CRS.
   * @return the CRS.
   */
  public getCRS(): string {
    return this._crs;
  }

  /**
   * Get the number of levels.
   * @return the number.
   */
  public getLevelCount(): int32 {
    return this._levelCount;
  }

  /**
   * Get the number of attributes.
   * @return the number.
   */
  public getAttributeCount(): int32 {
    return this._attributeCount;
  }

  /**
   * Get the size of blocks.
   * @return the number.
   */
  public getBlockSize(): int32 {
    return this._blockSize;
  }

  /**
   * Get the metric cell size.
   * @return the metric cell size.
   */
  public getMetricCellSize(): float64 {
    return this._metricCellSize;
  }

  /**
   * Get the creation timestamp.
   * @return the creation timestamp.
   */
  public getCreationTime(): ALong {
    return this._creationTime;
  }

  /**
   * Read a record.
   * @param data the record data.
   * @return the record.
   */
  private static readFromBuffer(data: ABuffer): FileRecord {
    /* Get the record fields */
    let options: int32 = LittleEndian.readBufferInt(data, 0);
    let crs: string = LittleEndian.readBufferString(data, 4);
    let dataOffset: int32 = 4 + LittleEndian.getStringByteCount(crs);
    let levelCount: int32 = LittleEndian.readBufferInt(data, dataOffset + 0);
    let attributeCount: int32 = LittleEndian.readBufferInt(
      data,
      dataOffset + 4
    );
    let blockSize: int32 = LittleEndian.readBufferInt(data, dataOffset + 8);
    let metricCellSize: float64 = LittleEndian.readBufferDouble(
      data,
      dataOffset + 12
    );
    let creationTime: ALong = LittleEndian.readBufferLong(
      data,
      dataOffset + 20
    );
    /* Return the record */
    return new FileRecord(
      options,
      crs,
      levelCount,
      attributeCount,
      blockSize,
      metricCellSize,
      creationTime
    );
  }

  /**
   * Read a record.
   * @param fileAccess the access to the file.
   * @param offset the file offset to the record.
   * @param size the file size to the record.
   * @return the record.
   */
  public static async readNew(
    fileStorage: FileStorage,
    fileName: string,
    offset: ALong,
    size: ALong
  ): Promise<FileRecord> {
    /* Read the record */
    let data: ABuffer = await fileStorage.readFilePart(
      fileName,
      offset,
      size.toInt()
    );
    /* Parse the record */
    return FileRecord.readFromBuffer(data);
  }

  /**
   * Write the record.
   * @param output the output stream.
   */
  public write(output: OutStream): void {
    LittleEndian.writeStreamInt(output, this._options);
    LittleEndian.writeStreamString(output, this._crs);
    LittleEndian.writeStreamInt(output, this._levelCount);
    LittleEndian.writeStreamInt(output, this._attributeCount);
    LittleEndian.writeStreamInt(output, this._blockSize);
    LittleEndian.writeStreamDouble(output, this._metricCellSize);
    LittleEndian.writeStreamLong(output, this._creationTime);
  }
}
