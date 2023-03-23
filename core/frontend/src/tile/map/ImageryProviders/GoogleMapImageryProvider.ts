/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerImageryProvider } from "../../internal";

/**  // {BASE_URL}?key={key}&zoom={zoom}&size={size}center={center}
 * @internal
 */

const zoom = "{zoom}";
const size = "{size}";
const center = "{center}";
const key="{key}";

export class GoogleMapImageryProvider extends MapLayerImageryProvider {
  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  // construct the Url from the desired Tile
  public async constructUrl(y: number, x: number, zoomLevel: number): Promise<string> {
    if (!this._settings.accessKey) {
      return "";
    }

    const tileSize=`${this.tileSize}x${this.tileSize}`;
    const url = this._settings.url;
    const mapKey=this._settings.accessKey.value;
    const bbox=this.getEPSG4326Extent(y,x,zoomLevel);
    let tileCenter=`0,0`;
    if(bbox){
      const lat= (bbox.latitudeBottom + bbox.latitudeTop)/2;
      const lon=(bbox.longitudeLeft + bbox.longitudeRight)/2;
      tileCenter=`${lat},${lon}`;
    }
    return url.replace(zoom, zoomLevel.toString()).replace(size, tileSize).replace(center, tileCenter).replace(key,mapKey);
  }
}

