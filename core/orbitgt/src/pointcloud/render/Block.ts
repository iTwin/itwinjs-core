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

import { Bounds } from "../../spatial/geom/Bounds";
import { AList } from "../../system/collection/AList";
import { IntMap } from "../../system/collection/IntMap";
import { BlockIndex } from "../model/BlockIndex";
import { GridIndex } from "../model/GridIndex";
import { TileIndex } from "../model/TileIndex";
import { Level } from "./Level";

/**
 * Class Block defines a block of tiles.
 *
 * @version 1.0 November 2015
 */
/** @internal */
export class Block {
  /** The index of the block */
  private _index: BlockIndex;
  /** The full list of tiles in the block (can be null if the tile-list has not been loaded) */
  private _tileList: Array<TileIndex>;
  /** The map of tiles in the block */
  private _tileMap: IntMap<IntMap<IntMap<TileIndex>>>;

  /**
   * Create a new block.
   * @param index the index of the block.
   */
  public constructor(index: BlockIndex) {
    this._index = index;
    this._tileList = null;
    this._tileMap = null;
  }

  /**
   * Get the index of the block.
   * @return the index of the block.
   */
  public getBlockIndex(): BlockIndex {
    return this._index;
  }

  /**
   * Get the spatial bounds of the block.
   * @param level the level to which the block belongs.
   * @return the spatial bounds of the block.
   */
  public getBlockBounds(level: Level): Bounds {
    return level.getBlockGrid().getCellBounds(this._index.gridIndex);
  }

  /**
   * Add a block to the list of blocks to load.
   * @param blocksToLoad the list of blocks to load.
   * @param block the block to add.
   */
  private static addToLoadList(
    blocksToLoad: AList<BlockIndex>,
    block: BlockIndex
  ): void {
    for (let i: number = 0; i < blocksToLoad.size(); i++)
      if (blocksToLoad.get(i).same(block)) return;
    blocksToLoad.add(block);
  }

  /**
   * Set the tiles in the block.
   * @param tileList the list of tiles.
   */
  public setTiles(tileList: Array<TileIndex>): void {
    /* Store the list */
    this._tileList = tileList;
    /* Make the map */
    this._tileMap = new IntMap<IntMap<IntMap<TileIndex>>>();
    for (let tile of this._tileList) {
      let tileX: int32 = tile.gridIndex.x;
      let yzMap: IntMap<IntMap<TileIndex>> = this._tileMap.get(tileX);
      if (yzMap == null) {
        yzMap = new IntMap<IntMap<TileIndex>>();
        this._tileMap.set(tileX, yzMap);
      }
      let tileY: int32 = tile.gridIndex.y;
      let zMap: IntMap<TileIndex> = yzMap.get(tileY);
      if (zMap == null) {
        zMap = new IntMap<TileIndex>();
        yzMap.set(tileY, zMap);
      }
      let tileZ: int32 = tile.gridIndex.z;
      zMap.set(tileZ, tile);
    }
  }

  /**
   * Have the tiles been set?
   * @return true if the tiles have been set.
   */
  public hasTiles(): boolean {
    return this._tileList != null;
  }

  /**
   * List all tiles.
   * @param blocksToLoad the list of blocks to load.
   * @return all tiles (null if tiles are not loaded).
   */
  public getTiles(blocksToLoad: AList<BlockIndex>): Array<TileIndex> {
    if (this._tileList == null) {
      Block.addToLoadList(blocksToLoad, this._index);
      return null;
    }
    return this._tileList;
  }

  /**
   * Find a tile.
   * @param tileGridIndex the grid index of the tile.
   * @return the tile (null if not found).
   */
  public findTile(tileGridIndex: GridIndex): TileIndex {
    if (this._tileMap == null) return null;
    let tileX: int32 = tileGridIndex.x;
    let yzMap: IntMap<IntMap<TileIndex>> = this._tileMap.get(tileX);
    if (yzMap == null) return null;
    let tileY: int32 = tileGridIndex.y;
    let zMap: IntMap<TileIndex> = yzMap.get(tileY);
    if (zMap == null) return null;
    let tileZ: int32 = tileGridIndex.z;
    return zMap.get(tileZ);
  }
}
