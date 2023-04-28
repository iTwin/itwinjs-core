/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.render;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Coordinate } from "../../spatial/geom/Coordinate";
import { StringMap } from "../../system/collection/StringMap";
import { BlockIndex } from "../model/BlockIndex";
import { Grid } from "../model/Grid";
import { GridIndex } from "../model/GridIndex";
import { Block } from "./Block";

/**
 * Class Level defines a resolution level of a pointcloud.
 *
 * @version 1.0 November 2015
 */
/** @internal */
export class Level {
  /** The index of the level */
  private _index: int32;
  /** The unique key of the level */
  private _key: string;
  /** The grid of the blocks */
  private _blockGrid: Grid;
  /** The grid of the tiles */
  private _tileGrid: Grid;
  /** The list of blocks */
  private _blockList: Array<Block>;
  /** The map of blocks */
  private _blockMap: StringMap<Block>;

  /**
   * Create a new level.
   * @param index the index of the level.
   * @param blockGrid the grid of the blocks.
   * @param tileGrid the grid of the tiles.
   * @param blockList the list of blocks.
   */
  public constructor(
    index: int32,
    blockGrid: Grid,
    tileGrid: Grid,
    blockList: Array<Block>
  ) {
    /* Store the parameters */
    this._index = index;
    this._key = "L" + index;
    this._blockGrid = blockGrid;
    this._tileGrid = tileGrid;
    this.setBlockList(blockList);
  }

  /**
   * Set the block list.
   * @param blockList the list of blocks.
   */
  public setBlockList(blockList: Array<Block>): void {
    this._blockList = blockList;
    /* Map the blocks */
    this._blockMap = new StringMap<Block>();
    for (let block of this._blockList)
      this._blockMap.set(block.getBlockIndex().gridIndex.getKey(), block);
  }

  /**
   * Get the index of the level.
   * @return the index of the level.
   */
  public getIndex(): int32 {
    return this._index;
  }

  /**
   * Get the unique key of the level.
   * @return the unique key of the level.
   */
  public getKey(): string {
    return this._key;
  }

  /**
   * Get the block grid.
   * @return the block grid.
   */
  public getBlockGrid(): Grid {
    return this._blockGrid;
  }

  /**
   * Get the tile grid.
   * @return the tile grid.
   */
  public getTileGrid(): Grid {
    return this._tileGrid;
  }

  /**
   * List all blocks.
   * @return all blocks.
   */
  public getBlocks(): Array<Block> {
    return this._blockList;
  }

  /**
   * Get the number of blocks.
   * @return the number of blocks.
   */
  public getBlockCount(): int32 {
    return this._blockList.length;
  }

  /**
   * Find a block.
   * @param blockIndex the index of the block to find.
   * @return the block.
   */
  public findBlock(blockIndex: BlockIndex): Block {
    for (let block of this._blockList)
      if (block.getBlockIndex().same(blockIndex)) return block;
    return null;
  }

  /**
   * Find a block index.
   * @param blockIndex the index of the block to find.
   * @return the block (can be null).
   */
  public findBlockGridIndex(blockIndex: GridIndex): Block {
    return this._blockMap.get(blockIndex.getKey());
  }

  /**
   * Find the block for a tile.
   * @param tileGridIndex the grid index of the tile.
   * @return the block (can be null).
   */
  public findBlockForTile(tileGridIndex: GridIndex): Block {
    /* Get the block index */
    let tileCenter: Coordinate = this._tileGrid.getCellCenter(tileGridIndex);
    let blockGridIndex: GridIndex = this._blockGrid.getCellIndex(tileCenter);
    /* Try to find the block */
    return this._blockMap.get(blockGridIndex.getKey());
  }
}
