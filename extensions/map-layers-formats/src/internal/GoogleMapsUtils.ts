/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerProps, ImageMapLayerSettings, MapLayerProviderProperties } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { GoogleMapsMapLayerFormat } from "../GoogleMaps/GoogleMapsImageryFormat.js";
import { GoogleMapsCreateSessionOptions, GoogleMapsLayerTypes, GoogleMapsMapTypes, GoogleMapsScaleFactors } from "../map-layers-formats.js";
import { BentleyError, BentleyStatus, Logger } from "@itwin/core-bentley";

const loggerCategory = "MapLayersFormats.GoogleMaps";

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

  /**
   * Read the session options from the map layer settings.
   * @param settings Map layer settings
   * ```
   * @internal
  */
  getSessionOptionsFromMapLayer: (settings: ImageMapLayerSettings): GoogleMapsCreateSessionOptions  => {
    const layerPropertyKeys = settings.properties ? Object.keys(settings.properties) : undefined;
    if (layerPropertyKeys === undefined ||
        !layerPropertyKeys.includes("mapType") ||
        !layerPropertyKeys.includes("language") ||
        !layerPropertyKeys.includes("region")) {
      const msg = "Missing session options";
      Logger.logError(loggerCategory, msg);
      throw new BentleyError(BentleyStatus.ERROR, msg);
    }

    const createSessionOptions: GoogleMapsCreateSessionOptions = {
      mapType: settings.properties!.mapType as GoogleMapsMapTypes,
      region: settings.properties!.region as string,
      language: settings.properties!.language as string,
    }

    if (Array.isArray(settings.properties?.layerTypes) && settings.properties.layerTypes.length > 0) {
      createSessionOptions.layerTypes = settings.properties.layerTypes as GoogleMapsLayerTypes[];
    }

    if (settings.properties?.scale !== undefined) {
      createSessionOptions.scale = settings.properties.scale as GoogleMapsScaleFactors;
    }

    if (settings.properties?.overlay !== undefined) {
      createSessionOptions.overlay = settings.properties.overlay as boolean;
    }

    if (settings.properties?.apiOptions !== undefined) {
      createSessionOptions.apiOptions = settings.properties.apiOptions as string[];
    }
    return createSessionOptions;
  }
}
