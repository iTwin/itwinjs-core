/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { ImageryMapLayerFormat, IModelApp, MapLayerImageryProvider, MapLayerSourceStatus, type MapLayerSourceValidation, type ValidateSourceArgs } from "@itwin/core-frontend";
import { MapLayersFormats } from "../mapLayersFormats.js";
import { AzureMapsLayerImageryProvider, getAzureMapsSubscriptionKey } from "./AzureMapsImageryProvider.js";

/**
 * Azure Maps imagery layer format.
 * @beta
 */
export class AzureMapsMapLayerFormat extends ImageryMapLayerFormat {
  /** Azure Maps imagery layer format.
   * @beta
   */
  public static override formatId = "AzureMaps";

  private static validateAzureSourceUrl(url: string): MapLayerSourceStatus {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return MapLayerSourceStatus.InvalidUrl;
    }

    if (!parsedUrl.protocol.startsWith("http"))
      return MapLayerSourceStatus.InvalidUrl;

    if (parsedUrl.hostname !== "atlas.microsoft.com" || parsedUrl.pathname !== "/map/tile")
      return MapLayerSourceStatus.IncompatibleFormat;

    return parsedUrl.searchParams.has("tilesetId") ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl;
  }

  public static override async validate(args: ValidateSourceArgs): Promise<MapLayerSourceValidation> {
    const urlStatus = AzureMapsMapLayerFormat.validateAzureSourceUrl(args.source.url);
    if (urlStatus !== MapLayerSourceStatus.Valid)
      return { status: urlStatus };

    const accessKey = IModelApp.mapLayerFormatRegistry.configOptions.AzureMaps;
    if (undefined === getAzureMapsSubscriptionKey(accessKey, MapLayersFormats.azureMapsOpts?.subscriptionKey))
      return { status: MapLayerSourceStatus.RequireAuth };

    return { status: MapLayerSourceStatus.Valid };
  }

  /** @internal */
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new AzureMapsLayerImageryProvider(settings, MapLayersFormats.azureMapsOpts?.subscriptionKey);
  }
}
