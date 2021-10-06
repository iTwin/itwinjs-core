/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ClientRequestContext, compareStrings, Dictionary } from "@bentley/bentleyjs-core";
import { getJson} from "@bentley/itwin-client";
import { QuadId } from "../internal";

const nonVisibleChildren = [false, false, false, false];
/** @internal */
export class ArcGISTileMap {
  private _callQueue = Promise.resolve<boolean[]>(nonVisibleChildren);
  private _callQueues: Array<Promise<boolean[]>> | undefined;
  public  tileMapRequestSize = 32;
  private _levelsCache = new Set<number>();
  private _tilesCache = new Dictionary<string, boolean>((lhs, rhs) => compareStrings(lhs, rhs));
  private _restBaseUrl: string;
  private _requestContext: ClientRequestContext;
  constructor(restBaseUrl: string, context?: ClientRequestContext, nbLods?: number) {
    this._restBaseUrl = restBaseUrl;
    if (nbLods !== undefined && nbLods > 0) {
      this._callQueues = new Array<Promise<boolean[]>>(nbLods).fill(Promise.resolve<boolean[]>(nonVisibleChildren));
    }

    this._requestContext = context ?? new ClientRequestContext("");
  }
  protected async fetchTileMapFromServer(level: number, row: number, column: number, width: number, height: number): Promise<any> {
    return getJson(this._requestContext, `${this._restBaseUrl}/tilemap/${level}/${row}/${column}/${width}/${height}?f=json`);
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

  // If we never encountered this tile level before, then a tilemap request must be made to get tiles visibility.
  // However, we dont want several overlapping large tilemap request being made simultaneously for tiles on the same level.
  // To avoid this from happening, we 'serialize' async calls so that we wait until the first tilemap request has completed
  // before making another one.
  // The trade off here is that we slightly slow down the display of the first tiles in order to avoid
  // flooding the server.
  public async getChildrenVisibility(parentQuadId: QuadId): Promise<boolean[]> {

    const childIds = parentQuadId.getChildIds();

    // We need to check cache again:
    // Tiles we are looking for may have been added to cache while we were waiting in the call queue.
    const cacheInfo = this.getAvailableTilesFromCache(childIds);
    if (cacheInfo.allTilesFound) {
      return cacheInfo.available;
    }

    const childLevel = parentQuadId.level+1;
    if (this._callQueues && childLevel < this._callQueues.length ) {
      const res = this._callQueues[childLevel].then(async () => this._getChildrenVisibilityFromServer(parentQuadId));
      this._callQueues[childLevel] = res.catch(() => {return nonVisibleChildren;});
      return res;
    } else {
      // We should not be in this case, probably because server info is missing lods?!
      return this._getChildrenVisibilityFromServer(parentQuadId);
    }

  }

  private async _getChildrenVisibilityFromServer(parentQuadId: QuadId): Promise<boolean[]> {

    const childIds = parentQuadId.getChildIds();

    // We need to check cache again:
    // Tiles we are looking for may have been added to cache while we were waiting in the call queue.
    const cacheInfo = this.getAvailableTilesFromCache(childIds);
    if (cacheInfo.allTilesFound) {
      return cacheInfo.available;
    }

    const available = cacheInfo.available;

    const row = parentQuadId.row * 2;
    const column = parentQuadId.column * 2;
    const level = parentQuadId.level + 1;

    // If we reach this point, that means at least one child was not found in cache, so make a new server request.
    try {
      let tileMapWidth = this.tileMapRequestSize, tileMapHeight = this.tileMapRequestSize;

      // Create offset that will place the current tile in the middle of the tilemap.
      // If we place it in the top-left corner (i.e. without offset), any future tile slightly above or on the left
      // will trigger a new request.
      const offset = (this.tileMapRequestSize/2.0)-1;

      const requestRow = Math.max(row - offset, 0);
      const requestColumn = Math.max(column - offset, 0);

      const json = await this.fetchTileMapFromServer(level, requestRow, requestColumn, tileMapWidth, tileMapHeight);
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
            const curColumn = requestColumn + i;
            const curRow = requestRow + j;
            this._tilesCache.set(QuadId.getTileContentId(level, curColumn, curRow), avail);

            // Check if actual tile is among the children we are looking for, if so update the
            // availability array.
            if ( curColumn >= childIds[0].column && curColumn <= childIds[3].column
              && curRow >= childIds[0].row && curRow <= childIds[3].row ) {
              available[k++] = avail;
            }

          }
        }
        assert (k===4);
      } else if (json?.error?.code === 422) {
        // The tile map response returns error code 422 when the bundle or level does not exist.
        // Ref: https://developers.arcgis.com/rest/services-reference/enterprise/tile-map.htm
        for (let j = 0; j < tileMapWidth; j++) {
          for (let i = 0; i < tileMapHeight; i++) {
            this._tilesCache.set(QuadId.getTileContentId(level, requestColumn + i, requestRow + j), false);
          }
        }
      }
    }

    // if (Array.isArray(json.data))
    //   for (let i = 0; i < 4; i++)
    //     available[i] = json.data[i] !== 0;
    catch  (_error) {
    }

    assert(available.length === 4);
    return available;
  }

  // https://tiles.arcgis.com/tiles/IMCZpp2qXhYVmRXp/arcgis/rest/services/Stockholm_%C3%96P_Stadsutvecklingskartan/MapServer/tilemap/10/300/562/32/32?f=json
  // protected async getTileMap(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any> {
  //   return {adjusted:false,location:{left:562,top:300,width:32,height:32},data:[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
  // }
}
