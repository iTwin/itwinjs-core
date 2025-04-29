/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { Logger } from "@itwin/core-bentley";
import { BaseMapLayerSettings, ImageMapLayerProps, ImageMapLayerSettings, MapLayerProviderProperties } from "@itwin/core-common";
import { IModelApp, MapCartoRectangle, MapLayerSessionClient, MapLayerSessionManager } from "@itwin/core-frontend";
import { Angle } from "@itwin/core-geometry";
import { GoogleMapsMapLayerFormat } from "./GoogleMapsImageryFormat.js";
import { GoogleMapsCreateSessionOptions, ViewportInfo, ViewportInfoRequestParams } from "./GoogleMapsSession.js";

 // eslint-disable-next-line @typescript-eslint/naming-convention
 const GoogleMapsUtils = {


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


/*
* Google Maps session manager that uses standard API key to create a session.
* @beta
// */
// export class NativeGoogleMapsSessionManager extends GoogleMapsSessionManager {
//   public readonly apiKey: string;

//   constructor(apiKey: string) {
//     super();
//     this.apiKey = apiKey;
//   }

//   public async createSession(sessionOptions: GoogleMapsCreateSessionOptions): Promise<GoogleMapsSession> {
//     const json = await GoogleMapsUtils.createSession(this.apiKey, sessionOptions);
//     return new NativeGoogleMapsSession(json, this.apiKey);
//   }
// }


/**
 * Google Maps API
 * @beta
*/
// eslint-disable-next-line @typescript-eslint/naming-convention
export const GoogleMaps = {
/**
 * Creates Google Maps map-layer settings.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 *
 * The following examples illustrates how a Googles Map layer can be attached to a viewport:
 * ```ts
 * [[include:GoogleMaps_AttachMapLayerSimple]]
 * ```
 * ```ts
 * [[include:GoogleMaps_AttachMapLayerOpts]]
 * ```
 * @beta
*/
  createMapLayerSettings: (name?: string, opts?: GoogleMapsCreateSessionOptions) => {
    return ImageMapLayerSettings.fromJSON(GoogleMapsUtils.createMapLayerProps(name, opts));
  },

/**
 * Creates Google Maps base layer settings.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 *
 * The following examples illustrates how a Google Maps base layer can be set on a viewport:
 * ```ts
 * [[include:GoogleMaps_BaseMapSimple]]
 * ```
 * ```ts
 * [[include:GoogleMaps_BaseMapOpts]]
 * ```
 * @beta
*/
  createBaseLayerSettings: (opts?: GoogleMapsCreateSessionOptions) => {
    return BaseMapLayerSettings.fromJSON(GoogleMapsUtils.createMapLayerProps("GoogleMaps", opts));
  }
};
