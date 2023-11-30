/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisUtilities, ImageryMapLayerFormat, MapLayerImageryProvider, MapLayerSource, MapLayerSourceStatus, MapLayerSourceValidation, ValidateSourceArgs } from "@itwin/core-frontend";
import { ArcGisFeatureProvider } from "./ArcGisFeatureProvider";

/** @internal */
export class ArcGisFeatureMapLayerFormat extends ImageryMapLayerFormat {
  public static override formatId = "ArcGISFeature";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined { return new ArcGisFeatureProvider(settings); }
  public static override async validateSource(url: string, userName?: string, password?: string, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    const urlValidation = ArcGisUtilities.validateUrl(url, "FeatureServer");
    if (urlValidation !== MapLayerSourceStatus.Valid)
      return { status: urlValidation };

    const source = MapLayerSource.fromJSON({name: "", url, formatId: this.formatId});
    if (!source)
      return {status: MapLayerSourceStatus.InvalidFormat};
    source.userName = userName;
    source.password = password;

    return ArcGisUtilities.validateSource({source, capabilitiesFilter: ["query"], ignoreCache});
  }

  public static override async validate(args: ValidateSourceArgs): Promise<MapLayerSourceValidation> {

    const urlValidation = ArcGisUtilities.validateUrl(args.source.url, "FeatureServer");
    if (urlValidation !== MapLayerSourceStatus.Valid)
      return {status: urlValidation};

    // Some Map service supporting only tiles don't include the 'Map' capabilities, thus we can't make it mandatory.
    return ArcGisUtilities.validateSource({...args, capabilitiesFilter: ["query"]});
  }
}
