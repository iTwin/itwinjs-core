/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisUtilities, ImageryMapLayerFormat, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation } from "@itwin/core-frontend";
import { ArcGisFeatureProvider } from "./ArcGisFeatureProvider";

/** @internal */
export class ArcGisFeatureMapLayerFormat extends ImageryMapLayerFormat {
  public static override formatId = "ArcGISFeature";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined { return new ArcGisFeatureProvider(settings); }
  public static override async validateSource(url: string, userName?: string, password?: string, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    const urlValidation = ArcGisUtilities.validateUrl(url, "FeatureServer");
    if (urlValidation !== MapLayerSourceStatus.Valid)
      return { status: urlValidation };

    return ArcGisUtilities.validateSource(url, this.formatId, ["query"], userName, password, ignoreCache);
  }
}
