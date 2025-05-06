/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { ImageryMapLayerFormat, MapLayerImageryProvider } from "@itwin/core-frontend";
import { GoogleMapsImageryProvider } from "./GoogleMapsImageryProvider.js";
import { MapLayersFormats } from "../mapLayersFormats.js";

/**
 * Google Maps imagery layer format.
 * @public
 */
export class GoogleMapsMapLayerFormat extends ImageryMapLayerFormat {
  /** Google Maps imagery layer format.
   * @public
   */
  public static override formatId = "GoogleMaps";

  /** @internal */
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new GoogleMapsImageryProvider(settings, MapLayersFormats.googleMapsOpts?.sessionManager);
  }
}
