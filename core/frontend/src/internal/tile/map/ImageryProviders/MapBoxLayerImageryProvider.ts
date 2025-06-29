/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp } from "../../../../IModelApp";
import { MapLayerImageryProvider } from "../../../../tile/internal";
import { ScreenViewport } from "../../../../Viewport";


/** Base class imagery map layer formats.  Subclasses should override formatId and [[MapLayerFormat.createImageryProvider]].
 */
export class MapBoxLayerImageryProvider extends MapLayerImageryProvider {
  private _zoomMin: number;
  private _zoomMax: number;
  private _baseUrl: string;

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
    this._baseUrl = settings.url;
    this._zoomMin = 1;
    this._zoomMax = 20;
  }

  public get tileWidth(): number { return 256; }
  public get tileHeight(): number { return 256; }
  public override get minimumZoomLevel(): number { return this._zoomMin; }
  public override get maximumZoomLevel(): number { return this._zoomMax; }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {
    if (!this._settings.accessKey) {
      return "";
    }

    // from the template url, construct the tile url.
    // format: {baseUrl}/{tileSize}/{level}/{column}/{row}?access_token={token}
    let url: string = this._baseUrl.concat(this.tileWidth.toString());
    url = url.concat(`/${zoomLevel.toString()}/${column.toString()}/${row.toString()}`);
    url = url.concat(`?${this._settings.accessKey.key}=${this._settings.accessKey.value}`);

    return url;
  }

   /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [addAttributions] instead. */
  public override addLogoCards(cards: HTMLTableElement): void {
    if (!cards.dataset.mapboxLogoCard) {
      cards.dataset.mapboxLogoCard = "true";
      cards.appendChild(IModelApp.makeLogoCard({ heading: "Mapbox", notice: IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap.MapBoxCopyright") }));
    }
  }

  public override async addAttributions (cards: HTMLTableElement, _vp: ScreenViewport): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return Promise.resolve(this.addLogoCards(cards));
  }

  // no initialization needed for MapBoxImageryProvider.
  public override async initialize(): Promise<void> { }
}
