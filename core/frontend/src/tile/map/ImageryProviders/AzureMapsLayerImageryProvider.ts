/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
<<<<<<< HEAD:core/frontend/src/tile/map/ImageryProviders/AzureMapsLayerImageryProvider.ts
import { IModelApp } from "../../../IModelApp";
import { MapLayerImageryProvider } from "../../internal";
=======
import { IModelApp } from "../../../../IModelApp";
import { MapLayerImageryProvider } from "../../../../tile/internal";
import { ScreenViewport } from "../../../../Viewport";

>>>>>>> ce418d16d8 (GoogleMaps support (#7604)):core/frontend/src/internal/tile/map/ImageryProviders/AzureMapsLayerImageryProvider.ts

/** @internal */
export class AzureMapsLayerImageryProvider extends MapLayerImageryProvider {
  constructor(settings: ImageMapLayerSettings) { super(settings, true); }

  // construct the Url from the desired Tile
  public async constructUrl(y: number, x: number, zoom: number): Promise<string> {
    if (!this._settings.accessKey)
      return "";
    return `${this._settings.url}&${this._settings.accessKey.key}=${this._settings.accessKey.value}&api-version=2.0&zoom=${zoom}&x=${x}&y=${y}`;
  }

  /** @deprecated in 5.0 Use [addAttributions] instead. */
  public override addLogoCards(cards: HTMLTableElement): void {
    if (!cards.dataset.azureMapsLogoCard) {
      cards.dataset.azureMapsLogoCard = "true";
      cards.appendChild(IModelApp.makeLogoCard({ heading: "Azure Maps", notice: IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap.AzureMapsCopyright") }));
    }
  }

  public override async addAttributions(cards: HTMLTableElement, _vp: ScreenViewport): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return Promise.resolve(this.addLogoCards(cards));
  }
}
