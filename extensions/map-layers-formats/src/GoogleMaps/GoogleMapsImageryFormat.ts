/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { ImageryMapLayerFormat, MapLayerImageryProvider } from "@itwin/core-frontend";
import { GoogleMapsImageryProvider } from "./GoogleMapsImageryProvider";

export class GoogleMapsMapLayerFormat extends ImageryMapLayerFormat {
  public static override formatId = "GoogleMaps";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new GoogleMapsImageryProvider(settings);
  }
}
