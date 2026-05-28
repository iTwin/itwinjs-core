/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { ImageMapLayerSettings, type ImageSource, type MapLayerKey } from "@itwin/core-common";
import { IModelApp, MapLayerImageryProvider, MapLayerImageryProviderStatus, NotifyMessageDetails, OutputMessagePriority, ScreenViewport } from "@itwin/core-frontend";

/** @internal */
export const azureMapsSubscriptionKeyParameter = "subscription-key";

/** @internal */
export function getAzureMapsSubscriptionKey(accessKey: MapLayerKey | undefined, fallbackSubscriptionKey?: string): string | undefined {
  if (accessKey !== undefined)
    return accessKey.key === azureMapsSubscriptionKeyParameter && accessKey.value.length > 0 ? accessKey.value : undefined;

  return fallbackSubscriptionKey !== undefined && fallbackSubscriptionKey.length > 0 ? fallbackSubscriptionKey : undefined;
}

class AzureMapsRequireAuthError extends Error {
  public constructor() {
    super(`Azure Maps requires a non-empty ${azureMapsSubscriptionKeyParameter} credential`);
  }
}

/**
 * Azure Maps imagery provider.
 * @beta
 */
export class AzureMapsLayerImageryProvider extends MapLayerImageryProvider {
  public constructor(settings: ImageMapLayerSettings, private readonly _subscriptionKey?: string) {
    super(settings, true);
  }

  private reportAzureAuthFailure(): void {
    this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
    if (this._hasSuccessfullyFetchedTile) {
      const msg = IModelApp.localization.getLocalizedString("iModelJs:MapLayers.Messages.LoadTileTokenError", { layerName: this._settings.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
    }
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    try {
      const tileUrl = await this.constructUrl(row, column, zoomLevel);
      if (tileUrl.length === 0)
        return undefined;

      const tileResponse = await this.makeTileRequest(tileUrl);
      if (tileResponse.status === 401 || tileResponse.status === 403) {
        this.reportAzureAuthFailure();
        return undefined;
      }

      if (!this._hasSuccessfullyFetchedTile)
        this._hasSuccessfullyFetchedTile = true;

      return await this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error) {
      if (error instanceof AzureMapsRequireAuthError || (error as { status?: number } | undefined)?.status === 401)
        this.reportAzureAuthFailure();

      return undefined;
    }
  }

  public override async constructUrl(y: number, x: number, zoom: number): Promise<string> {
    const subscriptionKey = getAzureMapsSubscriptionKey(this._settings.accessKey, this._subscriptionKey);
    if (undefined === subscriptionKey)
      throw new AzureMapsRequireAuthError();

    return `${this._settings.url}&${azureMapsSubscriptionKeyParameter}=${encodeURIComponent(subscriptionKey)}&api-version=2.0&zoom=${zoom}&x=${x}&y=${y}`;
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [addAttributions] instead. */
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
