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
import { AList } from "../../../system/collection/AList";
import { ABufferInStream } from "../../../system/io/ABufferInStream";
import { ALong } from "../../../system/runtime/ALong";
import { ASystem } from "../../../system/runtime/ASystem";
import { ContentLoader } from "../../../system/storage/ContentLoader";
import { BlockIndex } from "../../model/BlockIndex";
import { GridIndex } from "../../model/GridIndex";
import { TileIndex } from "../../model/TileIndex";
import { BlockRecord } from "./BlockRecord";
import { ContainerFilePart } from "./ContainerFilePart";
import { DirectoryRecord } from "./DirectoryRecord";
import { FileAccess } from "./FileAccess";
import { FileReader } from "./FileReader";
import { FileRecord } from "./FileRecord";
import { TileRecord } from "./TileRecord";

/**
 * Class DirectoryReader reads the tile and block directory.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class DirectoryReader {
  /** The file reader */
  private _fileReader: FileReader;
  /** The level */
  private _level: int32;

  /** The location of the tile directory */
  private _tileDirPart: ContainerFilePart;
  /** The location of the block directory */
  private _blockDirPart: ContainerFilePart;

  /** The directory record */
  private _directoryRecord: DirectoryRecord;
  /** The blocks (lazy loading) */
  private _blocks: Array<BlockIndex>;

  /**
   * Create a new reader.
   * @param fileReader the file reader.
   * @param level the level.
   */
  public constructor(fileReader: FileReader, level: int32) {
    /* Store the parameters */
    this._fileReader = fileReader;
    this._level = level;
    /* Get the tile directory */
    this._tileDirPart = fileReader
      .getContainer()
      .getPart("" + level + ".tile.directory");
    /* Get the block directory */
    this._blockDirPart = fileReader
      .getContainer()
      .getPart("" + level + ".block.directory");
    /* Clear */
    this._directoryRecord = null;
    this._blocks = new Array<BlockIndex>(0);
  }

  /**
   * Get the directory record.
   * @return the directory record.
   */
  public getDirectoryRecord(): DirectoryRecord {
    return this._directoryRecord;
  }

  /**
   * Get the blocks.
   * @return the blocks.
   */
  public getBlocks(): Array<BlockIndex> {
    return this._blocks;
  }

  /**
   * Load the data.
   * @param readBlockList should the list of blocks be read?
   * @param fileContents the file content read helper.
   * @return the reader.
   */
  public loadData(
    readBlockList: boolean,
    fileContents: ContentLoader
  ): DirectoryReader {
    /* Read the record */
    let directoryPart: ContainerFilePart = this._fileReader
      .getContainer()
      .getPart("" + this._level + ".directory");
    this._directoryRecord = DirectoryRecord.readNew(
      directoryPart.getOffset(),
      directoryPart.getSize(),
      fileContents
    );
    /* Read the blocks? */
    if (readBlockList)
      this.readBlocks(this._fileReader.getFileRecord(), fileContents);
    /* Return the reader */
    return this;
  }

  /**
   * Read the blocks.
   * @param fileRecord the file record.
   * @param fileContents the file content read helper.
   * @return the blocks.
   */
  public readBlocks(
    fileRecord: FileRecord,
    fileContents: ContentLoader
  ): Array<BlockIndex> {
    /* Request the data? */
    let fileAccess: FileAccess = this._blockDirPart.getFileAccess();
    if (fileContents.isAvailable() == false) {
      /* Add the range */
      fileContents.requestFilePart(
        this._blockDirPart.getOffset(),
        this._blockDirPart.getSize().toInt()
      );
      return null;
    }
    /* Get the data */
    let data: ABuffer = fileContents.getFilePart(
      this._blockDirPart.getOffset(),
      this._blockDirPart.getSize().toInt()
    );
    /* Allocate the blocks */
    this._blocks = new Array<BlockIndex>(this._directoryRecord.getBlockCount());
    /* Read all blocks */
    let input: ABufferInStream = new ABufferInStream(data, 0, data.size());
    let pointIndex: ALong = ALong.ZERO;
    let tileIndex: int32 = 0;
    for (let i: number = 0; i < this._blocks.length; i++) {
      /* Read the next block */
      let blockIndex: BlockIndex = BlockRecord.readNew(
        this._level,
        input,
        i,
        tileIndex,
        pointIndex
      );
      this._blocks[i] = blockIndex;
      /* Advance */
      tileIndex += blockIndex.tileCount;
      pointIndex = pointIndex.add(blockIndex.pointCount);
    }
    input.close();
    /* We have to match the counts */
    ASystem.assert0(
      this._directoryRecord.getTileCount() == tileIndex,
      "Expected " +
        this._directoryRecord.getTileCount() +
        " tiles, not " +
        tileIndex
    );
    ASystem.assert0(
      pointIndex.same(this._directoryRecord.getPointCount()),
      "Expected " +
        this._directoryRecord.getPointCount().toDouble() +
        " points, not " +
        pointIndex.toDouble()
    );
    /* Return the blocks */
    return this._blocks;
  }

  /**
   * Read the tiles of a block.
   * @param block the block record.
   * @return the tile records.
   */
  public readTiles2(
    block: BlockIndex,
    fileContents: ContentLoader
  ): Array<TileIndex> {
    /* Get the tile range */
    let tileIndex: int32 = block.tileIndex;
    let tileCount: int32 = block.tileCount;
    /* Get the file extent */
    let fileName: string = this._tileDirPart.getFileAccess().getFileName();
    let fileSize: ALong = this._fileReader.getContainer().getFileLength();
    let dataOffset: ALong = ALong.fromInt(TileRecord.RECORD_SIZE)
      .mulInt(tileIndex)
      .add(this._tileDirPart.getOffset());
    let dataSize: int32 = tileCount * TileRecord.RECORD_SIZE;
    /* Request the data? */
    if (fileContents.isAvailable() == false) {
      /* Add the range */
      fileContents.requestFilePart(dataOffset, dataSize);
      return null;
    }
    /* Get the data */
    let data: ABuffer = fileContents.getFilePart(dataOffset, dataSize);
    /* Read the tiles */
    let tiles: Array<TileIndex> = new Array<TileIndex>(tileCount);
    let input: ABufferInStream = new ABufferInStream(data, 0, data.size());
    let pointIndex: ALong = block.pointIndex;
    for (let i: number = 0; i < tileCount; i++) {
      /* Read the next tile */
      let tile: TileIndex = new TileIndex(
        this._level,
        tileIndex,
        new GridIndex(0, 0, 0),
        ALong.ZERO,
        0
      );
      TileRecord.read(
        tile,
        this._level,
        block.index,
        input,
        tileIndex,
        pointIndex
      );
      tiles[i] = tile;
      tileIndex += 1;
      pointIndex = pointIndex.addInt(tile.pointCount);
    }
    input.close();
    /* Return the tiles */
    return tiles;
  }

  /**
   * Get all tile indexes at this level.
   * @param tileFilter the optional tile filter.
   * @param selectionType the type of selection in the pointcloud.
   * @return the list of tiles.
   */
  public getAllTileIndexes2(fileContents: ContentLoader): AList<TileIndex> {
    /* Process all blocks */
    let tileList: AList<TileIndex> = new AList<TileIndex>();
    for (let block of this._blocks) {
      /* Read the tiles */
      let tiles: Array<TileIndex> = this.readTiles2(block, fileContents);
      /* Add all tiles */
      for (let tile of tiles) tileList.add(tile);
    }
    /* Return the list of tiles */
    return tileList;
  }
}
