/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerProps, MapLayerProviderProperties } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { GoogleMapsMapLayerFormat } from "../GoogleMaps/GoogleMapsImageryFormat.js";
import { GoogleMapsCreateSessionOptions } from "../map-layers-formats.js";

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const GoogleMapsUtils = {

  /**
   * Register the google maps format if it is not already registered.
   * @internal
  */
  checkFormatRegistered: () => {
    if (!IModelApp.mapLayerFormatRegistry.isRegistered(GoogleMapsMapLayerFormat.formatId)) {
      throw new Error(`GoogleMaps format is not registered`);
    }
  },

  /**
 * Creates a Google Maps layer props.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @internal
*/
  createMapLayerProps: (name: string = "GoogleMaps", opts?: GoogleMapsCreateSessionOptions): ImageMapLayerProps => {
    GoogleMapsUtils.checkFormatRegistered();

    return {
      formatId: GoogleMapsMapLayerFormat.formatId,
      url: "",
      name,
      properties: GoogleMapsUtils.createPropertiesFromSessionOptions(opts ?? {mapType: "satellite", language: "en-US", region: "US:", layerTypes: ["layerRoadmap"]}),
    };
  },

    /**
   * Converts the session options to provider properties
   * @param opts Options to create the session
   * @internal
  */
  createPropertiesFromSessionOptions: (opts: GoogleMapsCreateSessionOptions): MapLayerProviderProperties => {
    const properties: MapLayerProviderProperties = {
      mapType: opts.mapType,
      language: opts.language,
      region: opts.region,
    }

    if (opts.layerTypes !== undefined) {
      properties.layerTypes = [...opts.layerTypes];
    }

    if (opts.scale !== undefined) {
      properties.scale = opts.scale;
    }

    if (opts.overlay !== undefined) {
      properties.overlay = opts.overlay;
    }

    if (opts.apiOptions !== undefined) {
      properties.apiOptions = [...opts.apiOptions];
    }

    return properties;
  },
}
