/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ByteStream, GuidString, Id64String, Logger, StopWatch } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import {
  BatchType, computeChildTileProps, ContentIdProvider, CurrentImdlVersion, iModelTileTreeIdToString, TileMetadata, TileMetadataReader, TileProps,
} from "@itwin/core-common";
import { IModelDb, SpatialModel } from "@itwin/core-backend";
import { ConcurrencyQueue } from "./ConcurrencyQueue";

interface TileTreeInfo {
  treeId: string;
  treeType: BatchType;
  modelId: Id64String;
  is2d: boolean;
  guid?: GuidString;
}

export interface TileGenParams {
  maxConcurrentTrees: number;
  maxConcurrentTiles: number;
  maxTileDepth: number;
  reportTileStats: boolean;
  reportTileMetadata: boolean;
}

export interface TileStats {
  treeId: string;
  contentId: string;
  sizeInBytes?: number;
  elapsedTime?: number;
  metadata?: string;
}

export interface Stats {
  modelCount: number;
  rootTileCount: number;
  tileCount: number;
  emptyTileCount: number;
  tileTreePropsTime: number;
  totalTileSize: number;
  totalTileTime: number;
  totalTime: number;
  tileStats: TileStats[];
}

const kEmptyTileSize = 332; // bytes
const loggerCategory = "TileGenerationPerformance";

export class BackendTileGenerator {
  private readonly _iModel: IModelDb;
  private readonly _maxDepth: number;
  private readonly _treeQueue: ConcurrencyQueue<void>;
  private readonly _tileQueue: ConcurrencyQueue<void>;
  private readonly _getTileStats: boolean;
  private readonly _getTileMetadata: boolean;
  private readonly _options = {
    maximumMajorTileFormatVersion: CurrentImdlVersion.Major,
    enableInstancing: true,
    enableImprovedElision: true,
    useProjectExtents: true,
    disableMagnification: false,
    ignoreAreaPatterns: false,
    enableExternalTextures: true,
    alwaysSubdivideIncompleteTiles: false,
    optimizeBRepProcessing: true,
  };
  private readonly _stats: Stats = {
    modelCount: 0,
    rootTileCount: 0,
    tileCount: 0,
    emptyTileCount: 0,
    totalTileSize: 0,
    totalTileTime: 0,
    tileTreePropsTime: 0,
    totalTime: 0,
    tileStats: [],
  };

  public constructor(iModel: IModelDb, params: TileGenParams) {
    this._iModel = iModel;
    this._maxDepth = params.maxTileDepth;
    this._treeQueue = new ConcurrencyQueue(params.maxConcurrentTrees);
    this._tileQueue = new ConcurrencyQueue(params.maxConcurrentTiles);
    this._getTileStats = params.reportTileStats;
    this._getTileMetadata = params.reportTileMetadata;
  }

  private async getSpatialModels(): Promise<TileTreeInfo[]> {
    const models: TileTreeInfo[] = [];
    const queryParams = { from: SpatialModel.classFullName, limit: 100 };
    for (const modelId of this._iModel.queryEntityIds(queryParams)) {
      try {
        const model = this._iModel.models.getModel<SpatialModel>(modelId);
        const treeId = iModelTileTreeIdToString(modelId, { type: BatchType.Primary, edgesRequired: false }, this._options);
        models.push({ treeId, modelId, guid: model.geometryGuid, is2d: false, treeType: BatchType.Primary });
      } catch (err) {
        Logger.logError(loggerCategory, `Failed to load model "${modelId}": ${err}`);
      }
    }
    return models;
  }

  public async generateTilesForAllModels(): Promise<Stats> {
    Logger.logInfo(loggerCategory, `Started generating all tiles { maxDepth: ${this._maxDepth} }`);

    const totalTime = new StopWatch(undefined, true);
    const models = await this.getSpatialModels();
    this._stats.modelCount = models.length;

    for (const model of models) {
      this._treeQueue.push(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
        Logger.logInfo(loggerCategory, `Started generating tiles for model "${model.treeId}"`);
        const modelTimer = new StopWatch(undefined, true);
        await this.generateAllTilesForModel(model);
        modelTimer.stop();
        Logger.logInfo(loggerCategory, `Finished generating tiles for model "${model.treeId}" { timeElapsed(s): ${modelTimer.elapsedSeconds} }`);
      });
    }
    await this._treeQueue.drain();

    totalTime.stop();
    this._stats.totalTime = totalTime.elapsedSeconds;
    Logger.logInfo(loggerCategory, `Finished generating all tiles { timeElapsed(s): ${totalTime.elapsedSeconds} }`);
    return this._stats;
  }

  private async generateAllTilesForModel(info: TileTreeInfo): Promise<void> {
    let treeProps;
    const tilePropsTime = new StopWatch(undefined, true);

    try {
      treeProps = await this._iModel.tiles.requestTileTreeProps(info.treeId);
    } catch (err) {
      Logger.logInfo(loggerCategory, `Failed to get "${info.treeId}" tile tree props: ${err}`);
      return;
    }
    tilePropsTime.stop();

    // Ignore empty tile trees
    if (0 === treeProps.rootTile.maximumSize && true === treeProps.rootTile.isLeaf) {
      Logger.logInfo(loggerCategory, `"${info.treeId}" tile tree is empty`);
      return;
    }

    ++this._stats.rootTileCount;
    this._stats.tileTreePropsTime += tilePropsTime.elapsedSeconds;

    const idProvider = ContentIdProvider.create(true, this._options);
    treeProps.rootTile.contentId = idProvider.rootContentId;
    const tilesToLoad = [treeProps.rootTile];
    return this.generateAllTilesFromDepth(tilesToLoad, info, 0, idProvider);
  }

  private skipUndisplayableTile(treeInfo: TileTreeInfo, tile: TileProps): TileMetadata {
    Logger.logInfo(loggerCategory, `Skipped undisplayable tile { contentId: ${tile.contentId}, treeId: ${treeInfo.treeId} }`);
    const { contentId, sizeMultiplier } = tile;
    const range = Range3d.fromJSON(tile.range);
    const contentRange = (tile.contentRange) ? Range3d.fromJSON(tile.contentRange) : range;
    const emptySubRangeMask = 0;
    const isLeaf = !!tile.isLeaf;
    return { contentId, sizeMultiplier, range, contentRange, emptySubRangeMask, isLeaf };
  }

  private async generateTile(treeInfo: TileTreeInfo, tile: TileProps, reader: TileMetadataReader): Promise<TileMetadata> {
    const tileTime = new StopWatch(undefined, true);
    let content;
    try {
      content = (await this._iModel.tiles.requestTileContent(treeInfo.treeId, tile.contentId)).content;
    } catch (err) {
      throw err;
    }

    tileTime.stop();
    Logger.logInfo(loggerCategory, `Tile loaded { contentId: ${tile.contentId}, treeId: ${treeInfo.treeId}, size: ${content.byteLength}, timeElapsed(ms): ${tileTime.elapsed.milliseconds} }`);

    this._stats.tileCount++;
    this._stats.totalTileSize += content.byteLength;
    this._stats.totalTileTime += tileTime.elapsed.milliseconds;
    if (content.length <= kEmptyTileSize)
      this._stats.emptyTileCount++;

    const metadata = reader.read(new ByteStream(content.buffer), tile);
    if (this._getTileStats || this._getTileMetadata) {
      const stats: TileStats = { treeId: treeInfo.treeId, contentId: tile.contentId };
      if (this._getTileStats) {
        stats.sizeInBytes = content.byteLength;
        stats.elapsedTime = tileTime.elapsed.milliseconds;
      }
      if (this._getTileMetadata) {
        stats.metadata = JSON.stringify(metadata);
      }
      this._stats.tileStats.push(stats);
    }
    return metadata;
  }

  private async generateAllTilesFromDepth(tilesAtDepth: TileProps[], treeInfo: TileTreeInfo, depth: number, idProvider: ContentIdProvider): Promise<void> {
    if (depth >= this._maxDepth || 0 === tilesAtDepth.length)
      return;

    const tilesAtNextDepth: TileProps[] = [];
    const promises: Array<Promise<void>> = [];
    const reader = new TileMetadataReader(treeInfo.treeType, treeInfo.is2d, this._options);

    const levelTimer = new StopWatch(undefined, true);

    for (const tile of tilesAtDepth) {
      promises.push(this._tileQueue.push(async () => {
        try {
          const metadata = (tile.maximumSize > 0) ? await this.generateTile(treeInfo, tile, reader) : this.skipUndisplayableTile(treeInfo, tile);
          if (depth < this._maxDepth - 1) {
            const children = computeChildTileProps(metadata, idProvider, treeInfo).children;
            for (const child of children)
              tilesAtNextDepth.push(child);
          }
        } catch (err) {
          Logger.logError(loggerCategory, `Failed to generate tile { contentId: ${tile.contentId}, treeId: ${treeInfo.treeId} }: ${err}`);
        }
      }));
    }

    await Promise.all(promises);
    levelTimer.stop();

    Logger.logInfo(loggerCategory, `Finished generating level ${depth} tiles for model { treeId: ${treeInfo.treeId}, timeElapsed(ms): ${levelTimer.elapsed.milliseconds} }`);
    return this.generateAllTilesFromDepth(tilesAtNextDepth, treeInfo, depth + 1, idProvider);
  }
}
