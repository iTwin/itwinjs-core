/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ImageryMapLayerFormat, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, ValidateSourceArgs } from "@itwin/core-frontend";
import { OgcFeaturesProvider } from "./OgcFeaturesProvider";

/** @internal */
export class OgcFeaturesMapLayerFormat extends ImageryMapLayerFormat {
  public static override formatId = "OgcFeatures";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined { return new OgcFeaturesProvider(settings); }

  public static override async validate(_args: ValidateSourceArgs): Promise<MapLayerSourceValidation> {
    // TODO: implement proper validation
    return {status: MapLayerSourceStatus.Valid};
  }
}
