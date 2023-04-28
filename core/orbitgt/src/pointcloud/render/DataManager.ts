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
import { Transform } from "../../spatial/geom/Transform";
import { AList } from "../../system/collection/AList";
import { StringMap } from "../../system/collection/StringMap";
import { ALong } from "../../system/runtime/ALong";
import { ASystem } from "../../system/runtime/ASystem";
import { Message } from "../../system/runtime/Message";
import { ContentLoader } from "../../system/storage/ContentLoader";
import { BlockIndex } from "../model/BlockIndex";
import { Grid } from "../model/Grid";
import { PointCloudReader } from "../model/PointCloudReader";
import { PointData } from "../model/PointData";
import { TileIndex } from "../model/TileIndex";
import { Block } from "./Block";
import { FrameData } from "./FrameData";
import { Level } from "./Level";
import { ViewTree } from "./ViewTree";

/**
 * Class DataManager manages the (shared) data model part of the rendering in multiple layers (see the CLOUD-461 issue).
 *
 * @version 1.0 December 2017
 */
/** @internal */
export class DataManager {
  /** The name of this module */
  private static readonly MODULE: string = "DataManager";

  /** The maximum size of a single file-content request */
  private static readonly MAX_FILE_CONTENT_SIZE: int32 = 128 * 1024;
  /** The expire time to unload unused point data (seconds) */
  private static readonly POINT_DATA_EXIRE_TIME: float64 = 5 * 60.0;

  /** The reader of the pointcloud */
  private _pointCloudReader: PointCloudReader;
  /*** The CRS of the pointcloud */
  private _pointCloudCRS: string;
  /** The data format to read */
  private _dataFormat: int32;

  /** The spatial index */
  private _fileTileIndex: ViewTree;
  /** The data pool */
  private _dataPool: StringMap<PointData>;
  /** The set of levels we requested (index) */
  private _levelsLoading: StringMap<Level>;
  /** The set of levels we received (index) */
  private _levelsLoaded: StringMap<Level>;
  /** The set of blocks we requested (key) */
  private _blocksLoading: StringMap<BlockIndex>;
  /** The set of blocks we received (key) */
  private _blocksLoaded: StringMap<BlockIndex>;
  /** The set of tiles we requested (key) */
  private _tilesLoading: StringMap<TileIndex>;
  /** The set of tiles we received (key) */
  private _tilesLoaded: StringMap<TileIndex>;
  /** Is new data being loaded? */
  private _loadingData: boolean;
  /** The time when the data loading stopped */
  private _loadedDataTime: float64;
  /** The total size of data that has been loaded */
  private _dataLoadSize: ALong;

  /** The last garbage collection time */
  private _lastGarbageCollectTime: float64;

  /**
   * Create a new data model (to be shared between different views).
   * @param pointCloudReader the reader of the pointcloud file.
   * @param pointCloudCRS the CRS of the point cloud.
   * @param dataFormat the requested data format to load point data (PointDataRaw.TYPE for example).
   */
  public constructor(pointCloudReader: PointCloudReader, pointCloudCRS: string, dataFormat: int32) {
    /* Store the parameters */
    this._pointCloudReader = pointCloudReader;
    this._pointCloudCRS = pointCloudCRS;
    this._dataFormat = dataFormat;
    /* Initialize */
    if (this._pointCloudCRS == null) this._pointCloudCRS = this._pointCloudReader.getFileCRS();
    /* Clear */
    this._fileTileIndex = this.createSpatialIndex();
    this._dataPool = new StringMap<PointData>();
    this._levelsLoading = new StringMap<Level>();
    this._levelsLoaded = new StringMap<Level>();
    this._blocksLoading = new StringMap<BlockIndex>();
    this._blocksLoaded = new StringMap<BlockIndex>();
    this._tilesLoading = new StringMap<TileIndex>();
    this._tilesLoaded = new StringMap<TileIndex>();
    this._loadingData = false;
    this._loadedDataTime = 0.0;
    this._dataLoadSize = ALong.ZERO;
    this._lastGarbageCollectTime = 0.0;
    /* Log */
    Message.print(DataManager.MODULE, "Pointcloud CRS is " + this._pointCloudCRS);
  }

  /**
   * Close the data model.
   */
  public close(): void {
    if (this._pointCloudReader != null) {
      this._pointCloudReader.close();
      this._pointCloudReader = null;
    }
    this._fileTileIndex = null;
    this._dataPool.clear();
    this._levelsLoading.clear();
    this._levelsLoaded.clear();
    this._blocksLoading.clear();
    this._blocksLoaded.clear();
    this._tilesLoading.clear();
    this._tilesLoaded.clear();
  }

  /**
   * Create a spatial index of a pointcloud.
   * @return the spatial index.
   */
  private createSpatialIndex(): ViewTree {
    /* Create the levels */
    Message.print(DataManager.MODULE, "Creating pointcloud spatial index");
    let levels: Array<Level> = new Array<Level>(this._pointCloudReader.getLevelCount());
    for (let i: number = 0; i < levels.length; i++) {
      /* Get the grids */
      let blockGrid: Grid = this._pointCloudReader.getLevelBlockGrid(i);
      let tileGrid: Grid = this._pointCloudReader.getLevelTileGrid(i);
      /* Get the blocks */
      let blockIndexes: Array<BlockIndex> = this._pointCloudReader.peekBlockIndexes(i);
      let blockList: Array<Block> = new Array<Block>(blockIndexes.length);
      for (let j: number = 0; j < blockList.length; j++) blockList[j] = new Block(blockIndexes[j]);
      /* Create the level */
      levels[i] = new Level(i, blockGrid, tileGrid, blockList);
      Message.print(DataManager.MODULE, "Level " + i + " has " + blockList.length + " blocks");
    }
    /* Get the data bounds */
    let dataBounds: Bounds = this._pointCloudReader.getFileBounds();
    Message.print(DataManager.MODULE, "The data bounds are " + dataBounds);
    /* Return a new spatial index */
    return new ViewTree(this, levels, dataBounds);
  }

  /**
   * Get the pointcloud reader.
   * @return the pointcloud reader.
   */
  public getPointCloudReader(): PointCloudReader {
    return this._pointCloudReader;
  }

  /**
   * Get the pointcloud CRS.
   * @return the pointcloud CRS.
   */
  public getPointCloudCRS(): string {
    return this._pointCloudCRS;
  }

  /**
   * Get the bounds of the data.
   * @return the bounds of the data.
   */
  public getPointCloudBounds(): Bounds {
    return this._pointCloudReader.getFileBounds();
  }

  /**
   * Get the spatial index.
   * @return the spatial index.
   */
  public getViewTree(): ViewTree {
    return this._fileTileIndex;
  }

  /**
   * Check if a tile has been loaded to the data pool.
   * @param tileIndex the index of the tile.
   * @return the point data if loaded, null otherwise.
   */
  public isTileLoaded(tileIndex: TileIndex): PointData {
    return this._dataPool.get(tileIndex.key);
  }

  /**
   * Is the model loading data?
   * @return true when loading data.
   */
  public isLoadingData(): boolean {
    return this._loadingData;
  }

  /**
   * Get the size of the loaded data.
   * @return the size of the loaded data.
   */
  public getDataLoadSize(): ALong {
    return this._dataLoadSize;
  }

  /**
   * Filter the list of blocks and tiles that should be loaded.
   * @param levelsToLoad the list of levels to load.
   * @param blocksToLoad the list of blocks to load.
   * @param tilesToLoad the list of tiles to load.
   * @param levelList the filtered list of levels to load.
   * @param blockList the filtered list of blocks to load.
   * @param tileList the filtered list of tiles to load.
   */
  public filterLoadList(
    levelsToLoad: AList<Level>,
    blocksToLoad: AList<BlockIndex>,
    tilesToLoad: AList<TileIndex>,
    levelList: AList<Level>,
    blockList: AList<BlockIndex>,
    tileList: AList<TileIndex>
  ): void {
    /* Filter the levels to load */
    for (let i: number = 0; i < levelsToLoad.size(); i++) {
      /* Do not request the same level twice */
      let level: Level = levelsToLoad.get(i);
      if (this._levelsLoading.contains(level.getKey())) continue;
      if (this._levelsLoaded.contains(level.getKey())) continue;
      /* Add the level */
      levelList.add(level);
    }
    levelsToLoad.clear();
    /* Filter the blocks to load */
    for (let i: number = 0; i < blocksToLoad.size(); i++) {
      /* Do not request the same block twice */
      let blockIndex: BlockIndex = blocksToLoad.get(i);
      if (this._blocksLoading.contains(blockIndex.key)) continue;
      if (this._blocksLoaded.contains(blockIndex.key)) continue;
      /* Add the block */
      blockList.add(blockIndex);
    }
    blocksToLoad.clear();
    /* Filter the tiles to load */
    for (let i: number = 0; i < tilesToLoad.size(); i++) {
      /* Do not request the same tile twice */
      let tileIndex: TileIndex = tilesToLoad.get(i);
      if (this._tilesLoading.contains(tileIndex.key)) continue;
      if (this._tilesLoaded.contains(tileIndex.key)) continue;
      /* Add the tile */
      tileList.add(tileIndex);
    }
    tilesToLoad.clear();
  }

  /**
   * Load blocks and tiles.
   * @param layer the layer requesting the load.
   * @param levelList the filtered list of levels to load.
   * @param blockList the filtered list of blocks to load.
   * @param tileList the filtered list of tiles to load.
   * @return the data model.
   */
  public async loadData(frameData: FrameData): Promise<FrameData> {
    /* No data to load? */
    if (frameData.hasMissingData() == false) return frameData;
    /* Do not make overlapping load requests */
    if (this._loadingData) return frameData;
    this._loadingData = true;
    /* Log */
    let levelList: AList<Level> = frameData.levelsToLoad;
    let blockList: AList<BlockIndex> = frameData.blocksToLoad;
    let tileList: AList<TileIndex> = frameData.tilesToLoad;
    //		Message.print(MODULE,"Loading "+levelList.size()+" levels, "+blockList.size()+" blocks and "+tileList.size()+" tiles");
    //		Message.print(MODULE,"Already loaded "+this._blocksLoaded.size()+" blocks");
    //		Message.print(MODULE,"Already loading "+this._blocksLoading.size()+" blocks");
    //		Message.print(MODULE,"Already loaded "+this._tilesLoaded.size()+" tiles");
    //		Message.print(MODULE,"Already loading "+this._tilesLoading.size()+" tiles");
    /* Define the content we are going to need */
    let loadTime: float64 = ASystem.time();
    let fileContents: ContentLoader = new ContentLoader(
      this._pointCloudReader.getFileStorage(),
      this._pointCloudReader.getFileName()
    );
    /* Prepare the loading of the levels */
    for (let i: number = 0; i < levelList.size(); i++) {
      /* Prepare to load the block */
      let level: Level = levelList.get(i);
      this._levelsLoading.set(level.getKey(), level);
      this._pointCloudReader.readBlockIndexes(level.getIndex(), fileContents);
      Message.print(DataManager.MODULE, "Loading level " + level.getIndex());
    }
    /* Prepare the loading of the blocks */
    for (let i: number = 0; i < blockList.size(); i++) {
      /* Prepare to load the block */
      let blockIndex: BlockIndex = blockList.get(i);
      this._blocksLoading.set(blockIndex.key, blockIndex);
      this._pointCloudReader.readTileIndexes(blockIndex, fileContents);
    }
    /* Prepare the loading of the tiles */
    let loadTileCount: int32 = 0;
    for (let i: number = 0; i < tileList.size(); i++) {
      /* Prepare to load the tile */
      let tileIndex: TileIndex = tileList.get(i);
      this._tilesLoading.set(tileIndex.key, tileIndex);
      this._pointCloudReader.readPointData(tileIndex, this._dataFormat, loadTime, fileContents);
      loadTileCount++;
      /* Do not load too many tiles at once */
      if (fileContents.getTotalRequestSize() > DataManager.MAX_FILE_CONTENT_SIZE) {
        /* Stop loading tiles */
        Message.print(
          DataManager.MODULE,
          "Limited pointcloud content load request to " + fileContents.getTotalRequestSize() + " bytes"
        );
        break;
      }
    }
    /* Log */
    Message.print(
      DataManager.MODULE,
      "Loading of " +
        blockList.size() +
        " blocks, " +
        loadTileCount +
        "/" +
        tileList.size() +
        " tiles, " +
        fileContents.getTotalRequestSize() +
        " bytes"
    );
    /* Load the data */
    this._dataLoadSize = this._dataLoadSize.addInt(fileContents.getTotalRequestSize());
    fileContents = await fileContents.load();
    //Message.print(MODULE,"Creating "+blockList.size()+" blocks and "+tileList.size()+" tiles");
    /* Load the levels */
    for (let i: number = 0; i < levelList.size(); i++) {
      /* Load the block list */
      let level: Level = levelList.get(i);
      this._levelsLoaded.set(level.getKey(), level);
      this._levelsLoading.remove(level.getKey());
      let blockIndexes: Array<BlockIndex> = this._pointCloudReader.readBlockIndexes(level.getIndex(), fileContents);
      /* Add the blocks */
      this._fileTileIndex.setLevelBlocks(level, blockIndexes);
    }
    /* Load the blocks */
    for (let i: number = 0; i < blockList.size(); i++) {
      /* Load the block */
      let blockIndex: BlockIndex = blockList.get(i);
      this._blocksLoaded.set(blockIndex.key, blockIndex);
      this._blocksLoading.remove(blockIndex.key);
      let tileIndexes: Array<TileIndex> = this._pointCloudReader.readTileIndexes(blockIndex, fileContents);
      /* Add the block */
      this._fileTileIndex.setBlockTiles(blockIndex, tileIndexes);
    }
    /* Load the tiles */
    let newTiles: AList<TileIndex> = new AList<TileIndex>();
    for (let i: number = 0; i < loadTileCount; i++) {
      /* Get the next tile */
      let tileIndex: TileIndex = tileList.get(i);
      newTiles.add(tileIndex);
      /* Load the tile */
      this._tilesLoaded.set(tileIndex.key, tileIndex);
      this._tilesLoading.remove(tileIndex.key);
      let pointData: PointData = this._pointCloudReader.readPointData(
        tileIndex,
        this._dataFormat,
        loadTime,
        fileContents
      );
      /* Add the tile */
      this._dataPool.set(tileIndex.key, pointData);
    }
    /* We stopped loading */
    this._loadingData = false;
    this._loadedDataTime = ASystem.time();
    /* Log */
    Message.print(DataManager.MODULE, "Created " + blockList.size() + " blocks and " + loadTileCount + " tiles");
    /* Return the frame data */
    return frameData;
  }

  /**
   * Do a garbage collect (this method can be called often, it throttles itself to once per minute).
   * @param time the current time.
   */
  public doGarbageCollect(time: float64): void {
    /* First call? */
    if (this._lastGarbageCollectTime == 0.0) this._lastGarbageCollectTime = time;
    /* Throttle to one per minute */
    if (time < this._lastGarbageCollectTime + 60.0) return;
    this._lastGarbageCollectTime = time;
    /* Define the expire time */
    let expireTime: float64 = time - DataManager.POINT_DATA_EXIRE_TIME;
    /* Check all loaded tiles */
    let dropCount: int32 = 0;
    let dataKeys: AList<string> = this._dataPool.keys();
    for (let i: number = 0; i < dataKeys.size(); i++) {
      /* Get the next tile */
      let tileKey: string = dataKeys.get(i);
      let pointData: PointData = this._dataPool.get(tileKey);
      /* Expired? */
      if (pointData.tileIndex.accessTime < expireTime) {
        this._dataPool.remove(tileKey);
        this._tilesLoaded.remove(tileKey);
        dropCount++;
      }
    }
    /* Log? */
    if (dropCount > 0) Message.print(DataManager.MODULE, "Dropped the point data of " + dropCount + " tiles");
  }
}
