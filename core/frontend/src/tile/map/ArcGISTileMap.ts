/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareStrings, Dictionary, Logger } from "@itwin/core-bentley";
import { QuadId } from "../internal";
import { ImageMapLayerSettings } from "@itwin/core-common";
const loggerCategory = "ArcGISTileMap";

/** @internal */
export type FetchFunction = (url: URL, options?: RequestInit) => Promise<Response>;

const nonVisibleChildren = [false, false, false, false];

/** @internal */
export class ArcGISTileMap {

  // For similar reasons as the corner offset, we need to keep the tile map size not too big to avoid covering multiple bundles.
  public tileMapRequestSize = 8;
  private static maxLod = 30;

  // We want to query a tile map that covers an area all around the top-lef missing tile, we offset the top-left corner position of the tilemap.
  // We used to create a 32x32 tiles area around the missing tiles, but this was causing the tilemap top-left position
  // to fall outside the dataset bundle of the remote server, thus giving invalid response.
  public get tileMapOffset() {return (this.tileMapRequestSize * 0.5);}

  public  fallbackTileMapRequestSize = 2;

  private _callQueues: Array<Promise<boolean[]>> | undefined;
  private _tilesCache = new Dictionary<string, boolean>((lhs, rhs) => compareStrings(lhs, rhs));
  private _restBaseUrl: string;
  private _fetchFunc: FetchFunction;
  private _settings: ImageMapLayerSettings;

  constructor(restBaseUrl: string, settings: ImageMapLayerSettings, fetchFunc: FetchFunction ){
    this._restBaseUrl = restBaseUrl;
    this._fetchFunc = fetchFunc;
    this._settings = settings;
    this._callQueues = new Array<Promise<boolean[]>>(ArcGISTileMap.maxLod).fill(Promise.resolve<boolean[]>(nonVisibleChildren));

  }
  protected async fetchTileMapFromServer(level: number, row: number, column: number, width: number, height: number): Promise<any> {
    const tmpUrl = `${this._restBaseUrl}/tilemap/${level}/${row}/${column}/${width}/${height}?f=json`;
    const response = await this._fetchFunc(new URL(tmpUrl));
    return response.json();
  }

  protected getAvailableTilesFromCache(tiles: QuadId[]): {allTilesFound: boolean, available: boolean[]} {
    let allTilesFound = true;

    // Check children visibility from cache
    const available = tiles.map((tileId) => {
      const avail = this._tilesCache.get(tileId.contentId);
      if (undefined === avail) {
        allTilesFound = false;
      }
      return avail ?? false;
    });

    return {allTilesFound, available};
  }

  public async getChildrenAvailability(childIds: QuadId[]): Promise<boolean[]> {
    if (!childIds.length)
      return [];

    // Before entering the queue for a backend request,
    // let check if cache doesn't already contain what we are looking for.
    const cacheInfo = this.getAvailableTilesFromCache(childIds);
    if (cacheInfo.allTilesFound) {

      if (cacheInfo.available.includes(false))
        return cacheInfo.available;

      return cacheInfo.available;
    }

    // If we never encountered this tile level before, then a tilemap request must be made to get tiles visibility.
    // However, we dont want several overlapping large tilemap request being made simultaneously for tiles on the same level.
    // To avoid this from happening, we 'serialize' async calls so that we wait until the first tilemap request has completed
    // before making another one.
    const childLevel = childIds[0].level+1;
    if (this._callQueues && childLevel < this._callQueues.length ) {
      const res = this._callQueues[childLevel].then(async () => {
        return this.getChildrenAvailabilityFromServer(childIds);
      });
      this._callQueues[childLevel] = res.catch(() => nonVisibleChildren);
      return res;
    } else {
      // We should not be in this case, probably because server info is missing LODs in the capabilities?!
      Logger.logWarning(loggerCategory, `Skipped request queue for child level ${childLevel}`);
      return this.getChildrenAvailabilityFromServer(childIds);
    }
  }

  private isCacheMissingTile(level: number, startRow: number, startColumn: number, endRow: number, endColumn: number) {
    let missingTileFound = false;

    if (endRow <= startRow || endColumn <= startColumn)
      return missingTileFound;

    for (let j = startColumn; j <= endColumn && !missingTileFound; j++) {
      for (let i = startRow; i<=endRow && !missingTileFound; i++) {
        if (j >= 0 && i >= 0) {
          const contentId = QuadId.getTileContentId(level, j, i);
          if (this._tilesCache.get(contentId) === undefined) {
            missingTileFound = true;
          }
        }
      }
    }
    return missingTileFound;
  }

  private collectTilesMissingFromCache( missingQueryTiles: QuadId[]) {
    const missingTiles: QuadId[]  = [];
    for (const quad of missingQueryTiles) {
      const contentId = QuadId.getTileContentId(quad.level, quad.column, quad.row);
      const avail = this._tilesCache.get(contentId);
      if (avail === undefined)
        missingTiles.push(quad);

    }
    return missingTiles;
  }

  // Query tiles are tiles that we need to check availability
  // The array is assumed to be in in row major orientation, i.e.: [TileRow0Col0, TileRow0Col1, TileRow1Col0, TileRow1Col1,]
  public async fetchAndReadTilemap(queryTiles: QuadId[], reqWidth: number, reqHeight: number) {
    let available = queryTiles.map(()=>false);
    if (queryTiles.length === 0 ) {
      return available;
    }

    // console.log(`queryTiles: ${queryTiles.map((quad) => quad.contentId)}`);

    // Find the top-left most corner of the extent covering the query tiles.
    const getTopLeftCorner = (tiles: QuadId[]): {row: number|undefined, column: number|undefined} => {
      let row: number|undefined;
      let column: number|undefined;
      for (const quad of tiles) {
        if (row === undefined || quad.row <= row )
          row = quad.row;
        if (column === undefined || quad.column <= column) {
          column = quad.column ;
        }
      }
      return {row, column};
    };

    const level = queryTiles[0].level; // We assume all tiles to be on the same level

    let missingQueryTiles = this.collectTilesMissingFromCache(queryTiles);
    let gotAdjusted = false;
    let nbAttempt = 0; // Safety: We should never be making more requests than the number of queries tiles (otherwise something is wrong)
    while (missingQueryTiles.length > 0
      && (nbAttempt++ < queryTiles.length) ) {
      const tileMapTopLeft = getTopLeftCorner(missingQueryTiles);
      if (tileMapTopLeft.row === undefined || tileMapTopLeft.column === undefined)
        return available;   // Should not occurs since missingQueryTiles is non empty

      let tileMapRow = tileMapTopLeft.row;
      let tileMapColumn = tileMapTopLeft.column;

      const logLocationOffset = (newRow: number, newCol: number) =>  `[Row:${newRow !== tileMapTopLeft.row ? `${tileMapTopLeft.row}->${newRow}` : `${newRow}`} Column:${newCol !== tileMapTopLeft.column ? `${tileMapTopLeft.column}->${newCol}` : `${newCol}`}]`;

      // Position the top-left missing tile in the middle of the tilemap; minimizing requests if sibling tiles are requested right after
      // If previous response got adjusted, don't try to optimize tile map location
      if (queryTiles.length < this.tileMapRequestSize && !gotAdjusted) {
        const tileMapOffset = this.tileMapOffset - Math.floor(Math.sqrt(queryTiles.length) * 0.5);
        const missingTileBufferSize = Math.ceil(tileMapOffset * 0.5);
        if (this.isCacheMissingTile(level, tileMapRow-missingTileBufferSize, tileMapColumn-missingTileBufferSize, tileMapRow-1, tileMapColumn-1)) {
          tileMapRow = Math.max(tileMapRow - tileMapOffset, 0);
          tileMapColumn = Math.max(tileMapColumn - tileMapOffset, 0);
          Logger.logTrace(loggerCategory, `Offset applied to location in top-left direction: ${logLocationOffset(tileMapRow, tileMapColumn)}`);
        } else {
          const leftMissingTiles = this.isCacheMissingTile(level, tileMapRow, tileMapColumn-missingTileBufferSize, tileMapRow+missingTileBufferSize, tileMapColumn-1);
          const topMissingTiles = this.isCacheMissingTile(level, tileMapRow-missingTileBufferSize, tileMapColumn, tileMapRow-1, tileMapColumn+missingTileBufferSize);
          if (leftMissingTiles && topMissingTiles) {
            tileMapRow = Math.max(tileMapRow - tileMapOffset, 0);
            tileMapColumn = Math.max(tileMapColumn- tileMapOffset, 0);
            Logger.logTrace(loggerCategory, `Offset applied to location in top-left direction. ${logLocationOffset(tileMapRow, tileMapColumn)}`);
          } else if (leftMissingTiles) {
            tileMapColumn = Math.max(tileMapColumn - tileMapOffset, 0);
            Logger.logTrace(loggerCategory, `Offset applied to location in left direction. ${logLocationOffset(tileMapRow, tileMapColumn)}`);
          } else if (topMissingTiles)  {
            tileMapRow = Math.max(tileMapRow - tileMapOffset, 0);
            Logger.logTrace(loggerCategory, `Offset applied to location in top direction: ${logLocationOffset(tileMapRow, tileMapColumn)}`);
          } else
            Logger.logTrace(loggerCategory, `No offset applied to location: ${logLocationOffset(tileMapRow, tileMapColumn)}`);
        }
      }

      const json = await this.fetchTileMapFromServer(level, tileMapRow, tileMapColumn, reqWidth, reqHeight);
      let tileMapWidth = reqWidth;
      let tileMapHeight = reqHeight;
      if (Array.isArray(json.data)) {
        // The response width and height might be different than the requested dimensions.
        // Ref: https://developers.arcgis.com/rest/services-reference/enterprise/tile-map.htm
        if (json.adjusted) {
          gotAdjusted = true;
          // If tilemap size got adjusted, I'm expecting to get adjusted size...
          // otherwise there is something really odd with this server.
          assert(json.location?.width !== undefined && json.location?.height !== undefined);
          if (json.location?.width !== undefined && json.location?.height !== undefined) {
            tileMapWidth = json.location?.width;
            tileMapHeight = json.location?.height;
          }
        }
        // Build cache from tile map response
        for (let j = 0; j < tileMapHeight; j++) {
          for (let i = 0; i < tileMapWidth; i++) {
            const avail = json.data[(j*tileMapWidth)+i] !== 0;
            const curColumn = tileMapColumn + i;
            const curRow = tileMapRow + j;
            this._tilesCache.set(QuadId.getTileContentId(level, curColumn, curRow), avail);
          }
        }

        // Collect tile missing from the cache
        // There are 2 reasons why the tile map response would not cover all the missing tiles:
        // 1. The requested tile map size is not large enough to cover all tiles
        // 2. The tile map size has been adjusted by the server (i.e. data bundle limits)
        missingQueryTiles = this.collectTilesMissingFromCache(missingQueryTiles);
        if (missingQueryTiles.length > 0)
          Logger.logTrace(loggerCategory, `There are ${missingQueryTiles.length} missing tiles from previous request`);
      } else {
        missingQueryTiles = [];
        // Mark all tilemap tiles to non-available in the cache too.
        for (let j = 0; j < tileMapWidth; j++) {
          for (let i = 0; i < tileMapHeight; i++) {
            this._tilesCache.set(QuadId.getTileContentId(level, tileMapColumn + i, tileMapRow + j), false);
          }
        }
      }
    }  // end loop missing tiles

    if (nbAttempt > queryTiles.length) {
      Logger.logError(loggerCategory, `Request loop was terminated; unable to get missing tiles; `);
    }
    // Create final output array from cache
    available = queryTiles.map((quad)=>this._tilesCache.get(quad.contentId) ?? false);

    if (available.includes(false))
      return available;

    return available;
  }

  protected async getChildrenAvailabilityFromServer(childIds: QuadId[]): Promise<boolean[]> {

    let available;
    try {
      available = await this.fetchAndReadTilemap(childIds, this.tileMapRequestSize, this.tileMapRequestSize);
    } catch (err) {
      // if any error occurs, we assume tiles not to be visible
      Logger.logError(loggerCategory, `Error while fetching tile map data : ${err}`);
      available = childIds.map(()=>false);
    }

    return available;
  }
}
