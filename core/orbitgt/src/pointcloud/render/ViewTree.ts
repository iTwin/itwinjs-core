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
import { Message } from "../../system/runtime/Message";
import { BlockIndex } from "../model/BlockIndex";
import { GridIndex } from "../model/GridIndex";
import { PointData } from "../model/PointData";
import { TileIndex } from "../model/TileIndex";
import { AViewRequest } from "./AViewRequest";
import { Block } from "./Block";
import { DataManager } from "./DataManager";
import { Level } from "./Level";

/**
 * Class TileSpatialIndex manages a spatial index of levels, blocks and tiles in pointcloud. The index does not store data, only block and tile indexes.
 *
 * @version 1.0 November 2015
 */
/** @internal */
export class ViewTree {
  /** The name of this module */
  private static readonly MODULE: string = "ViewTree";

  /** Debug mode? */
  private static readonly DEBUG: boolean = false;

  /** The data manager */
  private _dataManager: DataManager;
  /** The levels */
  private _levels: Array<Level>;
  /** The data bounds */
  private _dataBounds: Bounds;
  /** The root blocks */
  private _rootBlocks: AList<Block>;

  /**
   * Create a new tree.
   * @param levels the levels.
   * @param dataBounds the data bounds.
   */
  public constructor(dataManager: DataManager, levels: Array<Level>, dataBounds: Bounds) {
    /* Store the parameters */
    this._dataManager = dataManager;
    this._levels = levels;
    this._dataBounds = dataBounds;
    /* Find the root blocks */
    this._rootBlocks = this.findRootBlocks();
  }

  /**
   * Find all root blocks (dropping of single-point tiles during pyramid creation can lead to missing branches).
   * @return all root blocks.
   */
  private findRootBlocks(): AList<Block> {
    /* Check some levels below the top */
    let startLevel: int32 = this._levels.length - 6;
    if (startLevel < 0) startLevel = 0;
    Message.print(
      ViewTree.MODULE,
      "Finding root blocks starting at level index " + startLevel + " of " + this._levels.length
    );
    /* Check the levels */
    let rootBlocks: AList<Block> = new AList<Block>();
    let nextLevelIndex: GridIndex = new GridIndex(0, 0, 0);
    for (let i: number = startLevel; i < this._levels.length - 1; i++) {
      /* Check all blocks in the level */
      let level: Level = this._levels[i];
      for (let block of level.getBlocks()) {
        /* Non-top level? */
        let isRoot: boolean = true;
        if (i < this._levels.length - 2) {
          /* Do we have a parent block in the next level? */
          block.getBlockIndex().gridIndex.getNextLevelIndex(nextLevelIndex);
          isRoot = this._levels[i + 1].findBlockGridIndex(nextLevelIndex) == null;
          if (isRoot)
            Message.print(ViewTree.MODULE, "Block L" + i + " " + block.getBlockIndex().gridIndex + " is non-top root");
        }
        /* Add to the list? */
        if (isRoot) rootBlocks.add(block);
      }
    }
    /* Return the roots */
    Message.print(ViewTree.MODULE, "Found " + rootBlocks.size() + " root blocks");
    return rootBlocks;
  }

  /**
   * Get the number of levels.
   * @return the number of levels.
   */
  public getLevelCount(): int32 {
    return this._levels.length;
  }

  /**
   * Get a level.
   * @param index the index of the level.
   * @return the level.
   */
  public getLevel(index: int32): Level {
    return this._levels[index];
  }

  /**
   * Get the data bounds.
   * @return the data bounds.
   */
  public getDataBounds(): Bounds {
    return this._dataBounds;
  }

  /**
   * Set the blocks for a level (after a data load operation).
   * @param level the level.
   * @param blockIndexes the indexes of the blocks in the level.
   */
  public setLevelBlocks(level: Level, blockIndexes: Array<BlockIndex>): void {
    if (blockIndexes == null) return;
    let blockList: Array<Block> = new Array<Block>(blockIndexes.length);
    for (let i: number = 0; i < blockIndexes.length; i++) blockList[i] = new Block(blockIndexes[i]);
    level.setBlockList(blockList);
    Message.print(ViewTree.MODULE, "Loaded " + blockIndexes.length + " blocks for level " + level.getIndex());
  }

  /**
   * Set the tiles for a block (after a data load operation).
   * @param blockIndex the index of the block.
   * @param tileIndexes the indexes of the tiles in the block.
   */
  public setBlockTiles(blockIndex: BlockIndex, tileIndexes: Array<TileIndex>): void {
    let level: Level = this._levels[blockIndex.level];
    let block: Block = level.findBlock(blockIndex);
    block.setTiles(tileIndexes);
  }

  /**
   * Split a tile into lower-level tiles.
   * @param level the level of the tile to split.
   * @param tile the tile to split.
   * @param childLevel the lower level of the tile.
   * @param children the list of children to split into.
   * @param levelsToLoad the list of levels to load.
   * @param blocksToLoad the list of blocks to load.
   * @return true if the list of children is complete.
   */
  private splitTile(
    level: Level,
    tile: TileIndex,
    childLevel: Level,
    children: AList<TileIndex>,
    levelsToLoad: AList<Level>,
    blocksToLoad: AList<BlockIndex>
  ): boolean {
    /* Clear the result */
    children.clear();
    /* Already calculated? */
    let childList: Array<TileIndex> = tile.children;
    if (childList != null) {
      /* Return */
      for (let child of childList) children.add(child);
      return true;
    }
    /* Assume we have a complete list of children */
    let complete: boolean = true;
    /* Unloaded level? */
    if (childLevel.getBlockCount() == 0) {
      /* No need to continue, we need the level block list */
      if (levelsToLoad.contains(childLevel) == false) levelsToLoad.add(childLevel);
      return false;
    }
    /* Check the 8 possible child tiles */
    let index: GridIndex = tile.gridIndex;
    let childIndex: GridIndex = new GridIndex(0, 0, 0);
    for (let z: number = 0; z < 2; z++)
      for (let y: number = 0; y < 2; y++)
        for (let x: number = 0; x < 2; x++) {
          /* Get the index of the child */
          childIndex.x = 2 * index.x + x;
          childIndex.y = 2 * index.y + y;
          childIndex.z = 2 * index.z + z;
          /* Find the block */
          let block: Block = childLevel.findBlockForTile(childIndex);
          if (block == null) {
            /* This should not happen */
            Message.printWarning(
              ViewTree.MODULE,
              "Unable to find tile block " +
                childIndex +
                " in child level " +
                childLevel.getIndex() +
                " (" +
                childLevel.getBlockCount() +
                " blocks)"
            );
            complete = false;
            continue;
          }
          /* No tile info in the block? */
          if (block.hasTiles() == false) {
            /* Load the block data */
            if (blocksToLoad.contains(block.getBlockIndex()) == false) blocksToLoad.add(block.getBlockIndex());
            complete = false;
          } else {
            /* Find the child */
            let child: TileIndex = block.findTile(childIndex);
            if (child != null) children.add(child);
          }
        }
    /* Store the result if complete */
    if (complete) {
      /* Store */
      let tileChildren: Array<TileIndex> = new Array<TileIndex>(children.size());
      for (let i: number = 0; i < tileChildren.length; i++) tileChildren[i] = children.get(i);
      tile.children = tileChildren;
    }
    /* Do we have all children? */
    return complete;
  }

  /**
   * Is all tile data available for rendering?
   * @param viewRequest the view request.
   * @param tiles a list of tiles to check.
   * @param missingTiles the list of tiles whose data is missing.
   */
  private checkDataAvailable(viewRequest: AViewRequest, tiles: AList<TileIndex>, missingTiles: AList<TileIndex>): void {
    /* Check all tiles */
    missingTiles.clear();
    for (let i: number = 0; i < tiles.size(); i++) {
      /* Get the next tile */
      let tile: TileIndex = tiles.get(i);
      /* Not available? */
      if (this._dataManager.isTileLoaded(tile) == null) {
        /* Request to load the block */
        missingTiles.add(tile);
      } else {
        /* Touch the block */
        tile.accessTime = viewRequest.getFrameTime();
      }
    }
  }

  /**
   * Is all tile data available for rendering?
   * @param viewRequest the view request.
   * @param tiles a list of tiles to check.
   * @return true if the tile data is available.
   */
  private isDataAvailable(viewRequest: AViewRequest, tiles: Array<TileIndex>): boolean {
    /* Check all tiles */
    for (let i: number = 0; i < tiles.length; i++) {
      /* Get the next tile */
      let tile: TileIndex = tiles[i];
      /* Not available? */
      if (this._dataManager.isTileLoaded(tile) == null) return false;
    }
    /* Available */
    return true;
  }

  /**
   * Add visible tiles to the view.
   * @param viewRequest the view request.
   * @param level the level of the tiles.
   * @param tiles the tiles to check.
   * @param visibleTiles the list of visible tiles to add to.
   */
  private addTilesToView(
    viewRequest: AViewRequest,
    level: Level,
    tiles: Array<TileIndex>,
    levelsToLoad: AList<Level>,
    blocksToLoad: AList<BlockIndex>,
    tilesToLoad: AList<TileIndex>,
    tilesToRender: AList<PointData>
  ): void {
    /* No tiles? */
    if (tiles == null) return;
    /* Make the lists */
    let childTiles: AList<TileIndex> = new AList<TileIndex>();
    let missingChildTiles: AList<TileIndex> = new AList<TileIndex>();
    /* Check all tiles */
    for (let i: number = 0; i < tiles.length; i++) {
      /* Get the next tile */
      let tile: TileIndex = tiles[i];
      if (ViewTree.DEBUG)
        Message.print(
          ViewTree.MODULE,
          "Checking tile L" +
            tile.level +
            " (" +
            tile.gridIndex.x +
            "," +
            tile.gridIndex.y +
            "," +
            tile.gridIndex.z +
            ")"
        );
      /* Visible? */
      let tileBounds: Bounds = level.getTileGrid().getCellBounds(tile.gridIndex).getIntersection(this._dataBounds);
      if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, "> level " + tile.level);
      if (viewRequest.isVisibleBox(tileBounds)) {
        /* Has the tile been loaded? */
        let tileData: PointData = this._dataManager.isTileLoaded(tile);
        let tileAvailable: boolean = tileData != null;
        tile.accessTime = viewRequest.getFrameTime();
        if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > available? " + tileAvailable);
        /* We load all intermediate tiles to avoid holes in the coverage */
        if (tileAvailable == false) tilesToLoad.add(tile);
        /* Split the tile? */
        let shouldSplit: boolean = level.getIndex() > 0 && viewRequest.shouldSplit(level, tile);
        if (shouldSplit) {
          if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > visible, but needs splitting");
          /* Find the children at the lower level */
          let childLevel: Level = this._levels[level.getIndex() - 1];
          let completeChildList: boolean = this.splitTile(
            level,
            tile,
            childLevel,
            childTiles,
            levelsToLoad,
            blocksToLoad
          );
          if (completeChildList == false) {
            if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > loading child indexes");
            /* Display the tile while we wait for the block-tiles to load */
            if (tileAvailable) tilesToRender.add(tileData);
          } else {
            /* Are all children available with their data? */
            this.checkDataAvailable(viewRequest, childTiles, missingChildTiles);
            if (missingChildTiles.size() == 0) {
              if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > rendering children");
              /* Add the children */
              let childTiles2: Array<TileIndex> = new Array<TileIndex>(childTiles.size());
              for (let j: number = 0; j < childTiles2.length; j++) childTiles2[j] = childTiles.get(j);
              this.addTilesToView(
                viewRequest,
                childLevel,
                childTiles2,
                levelsToLoad,
                blocksToLoad,
                tilesToLoad,
                tilesToRender
              );
            } else {
              if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > loading children");
              /* Request for the missing children to be loaded */
              for (let j: number = 0; j < missingChildTiles.size(); j++) tilesToLoad.add(missingChildTiles.get(j));
              /* Display the tile while we wait for the child tiles to load */
              if (tileAvailable) tilesToRender.add(tileData);
            }
          }
        } else {
          /* Display the tile */
          if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > visible");
          if (tileAvailable) tilesToRender.add(tileData);
        }
      } else {
        /* Log */
        if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > not visible");
      }
    }
  }

  /**
   * Find tile indexes for a 3D view.
   * @param viewRequest the request parameters.
   * @param visibleTiles the list of visible tiles to add to.
   * @param availableTiles the set of available tiles.
   * @param visibleAvailableTiles the list if visible and available tiles to add to.
   */
  public renderView3D(
    viewRequest: AViewRequest,
    levelsToLoad: AList<Level>,
    blocksToLoad: AList<BlockIndex>,
    tilesToLoad: AList<TileIndex>,
    tilesToRender: AList<PointData>
  ): void {
    /* Log? */
    if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, "Finding pointcloud tiles to render");
    if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > dataBounds: " + this._dataBounds);
    //if (DEBUG) Message.print(MODULE," > view: "+viewRequest.getViewProjection());
    //if (DEBUG) Message.print(MODULE," > distance: "+viewRequest.getDistanceRange());
    //if (DEBUG) Message.print(MODULE," > model-transform: "+viewRequest.getModelTransform());
    /* Check all blocks */
    tilesToRender.clear();
    if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, "Checking " + this._rootBlocks.size() + " root blocks");
    for (
      let i: number = 0;
      i < this._rootBlocks.size();
      i++ // start from the root tiles
    ) {
      /* Visible? */
      let block: Block = this._rootBlocks.get(i);
      let blockIndex: BlockIndex = block.getBlockIndex();
      let level: Level = this._levels[blockIndex.level];
      /* Visible? */
      if (ViewTree.DEBUG)
        Message.print(
          ViewTree.MODULE,
          "Checking top-level block L" +
            blockIndex.level +
            " (" +
            blockIndex.gridIndex.x +
            "," +
            blockIndex.gridIndex.y +
            "," +
            blockIndex.gridIndex.z +
            ")"
        );
      let blockBounds: Bounds = block.getBlockBounds(level).getIntersection(this._dataBounds);
      if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > blockBounds: " + blockBounds);
      if (viewRequest.isVisibleBox(blockBounds)) {
        /* Add the tiles */
        if (ViewTree.DEBUG) Message.print(ViewTree.MODULE, " > visible");
        this.addTilesToView(
          viewRequest,
          level,
          block.getTiles(blocksToLoad),
          levelsToLoad,
          blocksToLoad,
          tilesToLoad,
          tilesToRender
        );
      }
    }
  }
}
