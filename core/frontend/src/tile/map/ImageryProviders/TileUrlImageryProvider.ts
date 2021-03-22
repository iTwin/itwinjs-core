/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { MapLayerSettings } from "@bentley/imodeljs-common";
import { MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation } from "../../internal";

const levelToken = "{level}";
const rowToken = "{row}";
const columnToken = "{column}";

/**  Provide tiles from a url template in the a generic format ... i.e. https://b.tile.openstreetmap.org/{level}/{column}/{row}.png
* @internal
*/
export class TileUrlImageryProvider extends MapLayerImageryProvider {
  constructor(settings: MapLayerSettings) {
    super(settings, true);
  }
  public static validateUrlTemplate(template: string): MapLayerSourceValidation {
    return { status: (template.indexOf(levelToken) > 0 && template.indexOf(columnToken) > 0 && template.indexOf(rowToken) > 0) ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl };
  }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, level: number): Promise<string> {
    let url = this._settings.url;
    if (TileUrlImageryProvider.validateUrlTemplate(url).status !== MapLayerSourceStatus.Valid) {
      if (url.lastIndexOf("/") !== url.length - 1)
        url = `${url}/`;
      url = `${url}{level}/{column}/{row}.png`;
    }

    return url.replace(levelToken, level.toString()).replace(columnToken, column.toString()).replace(rowToken, row.toString());
  }
}
