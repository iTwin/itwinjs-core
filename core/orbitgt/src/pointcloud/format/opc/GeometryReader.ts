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

import { Coordinate } from "../../../spatial/geom/Coordinate";
import { ABuffer } from "../../../system/buffer/ABuffer";
import { LittleEndian } from "../../../system/buffer/LittleEndian";
import { Uint16Buffer } from "../../../system/buffer/Uint16Buffer";
import { Uint8Buffer } from "../../../system/buffer/Uint8Buffer";
import { ALong } from "../../../system/runtime/ALong";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { CloudPoint } from "../../model/CloudPoint";
import { Grid } from "../../model/Grid";
import { PointDataRaw } from "../../model/PointDataRaw";
import { ReadRequest } from "../../model/ReadRequest";
import { TileIndex } from "../../model/TileIndex";
import { ContainerFilePart } from "./ContainerFilePart";
import { FileReader } from "./FileReader";
import { GeometryRecord } from "./GeometryRecord";
import { TileReadBuffer } from "./TileReadBuffer";

/**
 * Class GeometryReader reads geometry data.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class GeometryReader {
  /** The size of the high-resolution record in the file */
  public static readonly RECORD_SIZE_HR: int32 = 6;
  /** The size of the low-resolution record in the file */
  public static readonly RECORD_SIZE_LR: int32 = 3;

  /** The number of bins (subdivisions) in a multi-resolution tile */
  public static readonly MR_BIN_COUNT: int32 = 64;

  /** The file reader */
  private _fileReader: FileReader;
  /** The level */
  private _level: int32;

  /** The geometry record */
  private _geometryRecord: GeometryRecord;
  /** The location of the geometry data */
  private _geometryDataPart: ContainerFilePart;

  /**
   * Create a new reader.
   * @param opcReader the file reader.
   * @param level the level.
   */
  public constructor(fileReader: FileReader, level: int32) {
    /* Store the parameters */
    this._fileReader = fileReader;
    this._level = level;
    /* Get the geometry data */
    this._geometryRecord = null;
    this._geometryDataPart = fileReader.getContainer().getPart("" + level + ".geometry.data");
  }

  /**
   * Load the data.
   * @return the reader.
   */
  public loadData(fileContents: ContentLoader): GeometryReader {
    /* Read the record */
    let geometryPart: ContainerFilePart = this._fileReader
      .getContainer()
      .getPart("" + this._level + ".geometry.definition");
    this._geometryRecord = GeometryRecord.readNew(geometryPart.getOffset(), geometryPart.getSize(), fileContents);
    /* Return the reader */
    return this;
  }

  /**
   * Get the geometry record.
   * @return the geometry record.
   */
  public getGeometryRecord(): GeometryRecord {
    return this._geometryRecord;
  }

  /**
   * Read the raw data for a tile.
   * @param tile the tile.
   * @param tileBuffer the buffer to read into.
   * @param readRequest the read parameters (contains the result read statistics).
   */
  public readTileData2(
    tile: TileIndex,
    pointOffset: int32,
    pointCount: int32,
    tileBuffer: TileReadBuffer,
    readRequest: ReadRequest,
    fileContents: ContentLoader
  ): void {
    /* What resolution do we have? */
    let lowResolution: boolean = this._level > 0;
    let recordSize: int32 = lowResolution ? GeometryReader.RECORD_SIZE_LR : GeometryReader.RECORD_SIZE_HR;
    /* Get the file extent */
    let fileSize: ALong = this._fileReader.getContainer().getFileLength();
    let offset: ALong = tile.pointIndex.addInt(pointOffset).mulInt(recordSize).add(this._geometryDataPart.getOffset());
    let size: int32 = pointCount * recordSize;
    this._geometryDataPart.rangeCheck(offset, ALong.fromInt(size));
    /* Request the data? */
    if (fileContents.isAvailable() == false) {
      /* Add the range */
      fileContents.requestFilePart(offset, size);
      return;
    }
    /* Update the statistics */
    readRequest.addDataSize(size);
    /* Read the content */
    let data: ABuffer = fileContents.getFilePart(offset, size);
    tileBuffer.setGeometryBuffer(data);
  }

  /**
   * Convert a low-resolution coordinate to a high-resolution one.
   * @param local the low-resolution coordinate.
   * @return the high-resolution coordinate.
   */
  public static lowToHighResolution(local: int32): int32 {
    return (local << 8) + 128;
  }

  /**
   * Get geometry data.
   * @param tile the tile.
   * @param tileBuffer the buffer that has been read.
   * @param pointIndex the index of the point to read.
   * @param cloudPoint the point to read the geometry of.
   */
  public getPointData(tile: TileIndex, tileBuffer: TileReadBuffer, pointIndex: int32, cloudPoint: CloudPoint): void {
    /* What resolution do we have? */
    let lowResolution: boolean = this._level > 0;
    let recordSize: int32 = lowResolution ? GeometryReader.RECORD_SIZE_LR : GeometryReader.RECORD_SIZE_HR;
    /* Get the buffer */
    let buffer: ABuffer = tileBuffer.getGeometryBuffer();
    let offset: int32 = pointIndex * recordSize;
    /* Read the local position */
    let lx: int32;
    let ly: int32;
    let lz: int32;
    if (lowResolution) {
      /* Read the 8-bit local position */
      lx = GeometryReader.lowToHighResolution(LittleEndian.readBufferByte(buffer, offset));
      offset++;
      ly = GeometryReader.lowToHighResolution(LittleEndian.readBufferByte(buffer, offset));
      offset++;
      lz = GeometryReader.lowToHighResolution(LittleEndian.readBufferByte(buffer, offset));
    } else {
      /* Read the 16-bit local position */
      lx = LittleEndian.readBufferShort(buffer, offset);
      offset += 2;
      ly = LittleEndian.readBufferShort(buffer, offset);
      offset += 2;
      lz = LittleEndian.readBufferShort(buffer, offset);
    }
    /* Get the grid */
    let grid: Grid = this._geometryRecord.getTileGrid();
    /* Get the tile position */
    let tileX0: float64 = grid.p0.x + tile.gridIndex.x * grid.size.x;
    let tileY0: float64 = grid.p0.y + tile.gridIndex.y * grid.size.y;
    let tileZ0: float64 = grid.p0.z + tile.gridIndex.z * grid.size.z;
    /* Get the coordinate scale factors */
    let scaleX: float64 = grid.size.x / 65536.0;
    let scaleY: float64 = grid.size.y / 65536.0;
    let scaleZ: float64 = grid.size.z / 65536.0;
    /* Set the position */
    cloudPoint.setX(tileX0 + scaleX * lx);
    cloudPoint.setY(tileY0 + scaleY * ly);
    cloudPoint.setZ(tileZ0 + scaleZ * lz);
  }

  /**
   * Get geometry data.
   * @param tile the tile.
   * @param tileBuffer the buffer that has been read.
   * @param pointData the point data.
   */
  public getPointDataRaw(tile: TileIndex, tileBuffer: TileReadBuffer, pointData: PointDataRaw): void {
    /* What resolution do we have? */
    let lowResolution: boolean = this._level > 0;
    if (lowResolution) {
      /* Straight copy of the raw buffer */
      pointData.points8 = new Uint8Buffer(tileBuffer.getGeometryBuffer(), 0, 3 * tile.pointCount);
    } else {
      /* Straight copy of the raw buffer */
      pointData.points16 = new Uint16Buffer(tileBuffer.getGeometryBuffer(), 0, 3 * tile.pointCount);
    }
  }
}
