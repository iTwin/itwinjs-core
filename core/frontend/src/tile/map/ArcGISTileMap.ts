/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { getJson} from "@bentley/itwin-client";
import { assert, compareStrings, Dictionary } from "@itwin/core-bentley";
import { QuadId } from "../internal";

const nonVisibleChildren = [false, false, false, false];
/** @internal */
export class ArcGISTileMap {
  public  tileMapRequestSize = 32;
  public  fallbackTileMapRequestSize = 2;

  private _callQueues: Array<Promise<boolean[]>> | undefined;
  private _tilesCache = new Dictionary<string, boolean>((lhs, rhs) => compareStrings(lhs, rhs));
  private _restBaseUrl: string;
  constructor(restBaseUrl: string, nbLods?: number) {
    this._restBaseUrl = restBaseUrl;
    if (nbLods !== undefined && nbLods > 0) {
      this._callQueues = new Array<Promise<boolean[]>>(nbLods).fill(Promise.resolve<boolean[]>(nonVisibleChildren));
    }

  }
  protected async fetchTileMapFromServer(level: number, row: number, column: number, width: number, height: number): Promise<any> {
    return getJson(`${this._restBaseUrl}/tilemap/${level}/${row}/${column}/${width}/${height}?f=json`);
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

    // We need to check cache again:
    // Tiles we are looking for may have been added to cache while we were waiting in the call queue.
    const cacheInfo = this.getAvailableTilesFromCache(childIds);
    if (cacheInfo.allTilesFound) {
      return cacheInfo.available;
    }

    // If we never encountered this tile level before, then a tilemap request must be made to get tiles visibility.
    // However, we dont want several overlapping large tilemap request being made simultaneously for tiles on the same level.
    // To avoid this from happening, we 'serialize' async calls so that we wait until the first tilemap request has completed
    // before making another one.
    const childLevel = childIds[0].level+1;
    if (this._callQueues && childLevel < this._callQueues.length ) {
      const res = this._callQueues[childLevel].then(async () => this.getChildrenAvailabilityFromServer(childIds));
      this._callQueues[childLevel] = res.catch(() => {return nonVisibleChildren;});
      return res;
    } else {
      // We should not be in this case, probably because server info is missing LODs in the capabilities?!
      return this.getChildrenAvailabilityFromServer(childIds);
    }
  }

  // Query tiles are tiles that we need to check availability
  // The array is assumed to be in in row major orientation, i.e.: [TileRow0Col0, TileRow0Col1, TileRow1Col0, TileRow1Col1,]
  protected async fetchAndReadTilemap(queryTiles: QuadId[], reqWidth: number, reqHeight: number) {
    let available: boolean[] = [];
    if (queryTiles.length === 0) {
      return available;
    }

    const row = queryTiles[0].row;
    const column = queryTiles[0].column;
    const level = queryTiles[0].level;

    let reqRow, reqColumn;
    if (reqWidth === this.fallbackTileMapRequestSize && reqHeight === this.fallbackTileMapRequestSize){
      reqRow = row;
      reqColumn = column;
    } else {
      // If tile map if big enough. create offset that will place the current tile in the middle of the tilemap.
      // If we place the first query tile in the top-left corner (i.e. without offset), any query for a tile located above or on the left
      // will trigger a new request.
      const offsetRow = (reqHeight/2.0)-1;
      const offsetColumn = (reqWidth/2.0)-1;
      reqRow = Math.max(row - offsetRow, 0);
      reqColumn = Math.max(column - offsetColumn, 0);
    }

    try {
      // console.log(`Tilemap request: ${level},${reqRow},${reqColumn},${reqWidth},${reqHeight}`);
      const json = await this.fetchTileMapFromServer(level, reqRow, reqColumn, reqWidth, reqHeight);
      let tileMapWidth = reqWidth;
      let tileMapHeight = reqHeight;
      if (Array.isArray(json.data)){

        // The response width and height might be different than the requested dimensions.
        // Ref: https://developers.arcgis.com/rest/services-reference/enterprise/tile-map.htm
        if (json.adjusted) {
          // If tilemap size got adjusted, I'm expecting to get adjusted size...
          // otherwise there is something really odd with this server.
          assert(json.location?.width !== undefined && json.location?.height !== undefined);
          if (json.location?.width !== undefined && json.location?.height !== undefined) {
            tileMapWidth = json.location?.width;
            tileMapHeight = json.location?.height;
          }
        }
        let k = 0;
        for (let j = 0; j < tileMapWidth; j++) {
          for (let i = 0; i < tileMapHeight; i++) {
            const avail = json.data[(j*tileMapWidth)+i] !== 0;
            const curColumn = reqColumn + i;
            const curRow = reqRow + j;
            // console.log(`Tilemap tile:: ${level},${curRow},${curColumn} => ${avail}`);
            this._tilesCache.set(QuadId.getTileContentId(level, curColumn, curRow), avail);

            // Check if actual tile is among the children we are looking for, if so update the availability array.
            if ( curColumn >= queryTiles[0].column && curColumn <= queryTiles[queryTiles.length-1].column
                && curRow >= queryTiles[0].row && curRow <= queryTiles[queryTiles.length-1].row ) {
              available[k++] = avail;
            }

          }
        }
      } else {
        // If server returns data (i.e. error 422), thats fine we assume all tiles of tilemap are not available.
        available = queryTiles.map(()=>false);

        // Mark all tilemap tiles to non-available in the cache too
        for (let j = 0; j < tileMapWidth; j++) {
          for (let i = 0; i < tileMapHeight; i++) {
            this._tilesCache.set(QuadId.getTileContentId(level, reqColumn + i, reqRow + j), false);
          }
        }
      }
    } catch (_error) {
      available = queryTiles.map(()=>false);
    }

    return available;
  }

  protected async getChildrenAvailabilityFromServer(childIds: QuadId[]): Promise<boolean[]> {
    // We need to check cache again:
    // Tiles we are looking for may have been added to cache while we were waiting in the call queue.
    const cacheInfo = this.getAvailableTilesFromCache(childIds);
    if (cacheInfo.allTilesFound) {
      return cacheInfo.available;
    }

    let available;
    try {
      available = await this.fetchAndReadTilemap(childIds, this.tileMapRequestSize, this.tileMapRequestSize);
      if (available.length !== childIds.length) {
        if (this.tileMapRequestSize > this.fallbackTileMapRequestSize) {
        // Maybe we were unlucky and the tilemap got adjusted our the tiles we are looking for got clipped,
        // so let try we a smaller tilemap
          available = await this.fetchAndReadTilemap(childIds, this.fallbackTileMapRequestSize, this.fallbackTileMapRequestSize);
        }

        if (available.length < childIds.length) {
          // Could not all tiles children tiles, returns what we got and fill any gaps with false.
          const tmpAvail = childIds.map(()=>false);
          for (let i=0; i<available.length;i++ ) {
            tmpAvail[i] = available[i];
          }
          available = tmpAvail;
        }
      }
    } catch (_error) {
      // if any error occurs, we assume tiles not to be visible
      available = childIds.map(()=>false);
    }

    return available;
  }
}
