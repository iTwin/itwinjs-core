/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { MapLayerImageryProvider } from "../../internal";

/** @internal */
export class AzureMapsLayerImageryProvider extends MapLayerImageryProvider {
  constructor(settings: ImageMapLayerSettings) { super(settings, true); }

  // construct the Url from the desired Tile
  public async constructUrl(y: number, x: number, zoom: number): Promise<string> {
    if (!this._settings.accessKey)
      return "";
    return `${this._settings.url}&${this._settings.accessKey.key}=${this._settings.accessKey.value}&api-version=2024-04-01&zoom=${zoom}&x=${x}&y=${y}`;
  }

  public override addLogoCards(cards: HTMLTableElement): void {
    if (!cards.dataset.azureMapsLogoCard) {
      cards.dataset.azureMapsLogoCard = "true";
      cards.appendChild(IModelApp.makeLogoCard({ heading: "Azure Maps", notice: IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap.AzureMapsCopyright") }));
    }
  }
}
