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

/** @internal */
export class ArcGISTileMap {
  private _cache = new Dictionary<string, boolean>((lhs, rhs) => compareStrings(lhs, rhs));
  private _restBaseUrl: string;
  private _requestContext: ClientRequestContext;
  constructor(restBaseUrl: string, context?: ClientRequestContext) {
    this._restBaseUrl = restBaseUrl;
    this._requestContext = context ?? new ClientRequestContext("");
  }

  public async getChildrenVisibility(parentQuadId: QuadId): Promise<boolean[]> {

    const row = parentQuadId.row * 2;
    const column = parentQuadId.column * 2;
    const level = parentQuadId.level + 1;
    // const available = [false, false, false, false];

    let childrenInCache = true;
    const childIds = parentQuadId.getChildIds();
    assert(Array.isArray(childIds) && childIds.length === 4);

    // Check children visibility from cache
    const available = childIds.map((childId) => {
      const avail = this._cache.get(childId.contentId);
      if (undefined === avail) {
        childrenInCache = false;
      }
      return avail ?? false;
    });
    if (childrenInCache) {
      // Children were already in cache, return cached visibility.
      return available;
    }

    // If we reach this point, that means at least one child was not found in cache, so make a new server request.
    try {
      let tileMapWidth = 32, tileMapHeight = 32;

      const json = await this.getTileMap(level, row, column, tileMapWidth, tileMapHeight);
      if (Array.isArray(json.data)){

        // Depending on the server architectural consideration, the response width and height
        // might be different than the requested dimensions.
        // Ref: https://developers.arcgis.com/rest/services-reference/enterprise/tile-map.htm
        if (json.adjusted) {
          // If tilemap was adjusted, I'm expecting to get adjusted size...
          // otherwise there is something really odd with this server.
          assert(json.location?.width !== undefined && json.location?.height !== undefined);
          if (json.location?.width !== undefined && json.location?.height !== undefined) {
            tileMapWidth = json.location?.width;
            tileMapHeight = json.location?.height;
          }
        }

        console.log (`Fetched successfully ${level},${row},${column}....`);
        for (let j = 0, k = 0; j < tileMapWidth; j++) {
          for (let i = 0; i < tileMapHeight; i++) {
            const avail = json.data[(j*tileMapWidth)+i] !== 0;
            const curColumn = column + i;
            const curRow = row + j;
            this._cache.set(QuadId.getTileContentId(level, curColumn, curRow), avail);

            // Check if actual tile is among the children we are looking for, if so update the
            // availability array.
            if ( curColumn >= childIds[0].column && curColumn <= childIds[3].column
              && curRow >= childIds[0].row && curRow <= childIds[3].row ) {
              if (level === 10) {
                console.log (`[${level},${curRow},${curColumn}] is ${avail}`);
              }
              available[k++] = avail;
            }

          }
        }
        console.log("---");

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

  protected async getTileMap(level: number, row: number, column: number, width: number, height: number): Promise<any> {
    return getJson(this._requestContext, `${this._restBaseUrl}/tilemap/${level}/${row}/${column}/${width}/${height}?f=json`);
  }

  // https://tiles.arcgis.com/tiles/IMCZpp2qXhYVmRXp/arcgis/rest/services/Stockholm_%C3%96P_Stadsutvecklingskartan/MapServer/tilemap/10/300/562/32/32?f=json
  // protected async getTileMap(_level: number, _row: number, _column: number, _width: number, _height: number): Promise<any> {
  //   return {adjusted:false,location:{left:562,top:300,width:32,height:32},data:[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
  // }
}
