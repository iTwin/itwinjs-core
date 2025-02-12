/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { GoogleMapsMapLayerFormat } from "../GoogleMaps/GoogleMapsImageryFormat";
import { Logger } from "@itwin/core-bentley";
import { ImageMapLayerProps, MapLayerProviderProperties } from "@itwin/core-common";
import { Angle } from "@itwin/core-geometry";
import { CreateSessionOptions, GoogleMapsSession, ViewportInfo, ViewportInfoRequestParams } from "../GoogleMaps/GoogleMaps";

const loggerCategory = "MapLayersFormats.GoogleMaps";

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const GoogleMapsUtils = {
  /**
   * Creates a Google Maps session.
   * @param apiKey Google Cloud API key
   * @param opts Options to create the session
   * @internal
  */
  createSession: async (apiKey: string, opts: CreateSessionOptions): Promise<GoogleMapsSession> => {
    const url = `https://tile.googleapis.com/v1/createSession?key=${apiKey}`;
    const request = new Request(url, {method: "POST", body: JSON.stringify(opts)});
    const response = await fetch (request);
    if (!response.ok) {
      throw new Error(`CreateSession request failed: ${response.status} - ${response.statusText}`);
    }
    Logger.logInfo(loggerCategory, `Session created successfully`);
    return response.json();
  },

  /**
   * Register the google maps format if it is not already registered.
   * @internal
  */
  registerFormatIfNeeded: () => {
    if (!IModelApp.mapLayerFormatRegistry.isRegistered(GoogleMapsMapLayerFormat.formatId)) {
      IModelApp.mapLayerFormatRegistry.register(GoogleMapsMapLayerFormat);
    }
  },

  /**
 * Creates a Google Maps layer props.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @internal
*/
  createMapLayerProps: (name: string = "GoogleMaps", opts?: CreateSessionOptions): ImageMapLayerProps => {
    GoogleMapsUtils.registerFormatIfNeeded();

    return {
      formatId: GoogleMapsMapLayerFormat.formatId,
      url: "",
      name,
      properties: GoogleMapsUtils.createPropertiesFromSessionOptions(opts ?? {mapType: "satellite", language: "en-US", region: "US:", layerTypes: ["layerRoadmap"]}),
    };
  },

  /**
  * Retrieves the maximum zoom level available within a bounding rectangle.
  * @param rectangle The bounding rectangle
  * @returns The maximum zoom level available within the bounding rectangle.
  * @internal
  */
  getViewportInfo: async (params: ViewportInfoRequestParams): Promise<ViewportInfo | undefined>=> {
    const {rectangle, session, key, zoom} = params;
    const north = Angle.radiansToDegrees(rectangle.north);
    const south = Angle.radiansToDegrees(rectangle.south);
    const east = Angle.radiansToDegrees(rectangle.east);
    const west = Angle.radiansToDegrees(rectangle.west);
    const url = `https://tile.googleapis.com/tile/v1/viewport?session=${session}&key=${key}&zoom=${zoom}&north=${north}&south=${south}&east=${east}&west=${west}`;
    const request = new Request(url, {method: "GET"});
    const response = await fetch (request);
    if (!response.ok) {
      return undefined;
    }
    const json = await response.json();
    return json as ViewportInfo;;
  },

    /**
   * Converts the session options to provider properties
   * @param opts Options to create the session
   * @internal
  */
  createPropertiesFromSessionOptions: (opts: CreateSessionOptions): MapLayerProviderProperties => {
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