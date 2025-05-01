/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { BaseMapLayerSettings, ImageMapLayerSettings } from "@itwin/core-common";
import { GoogleMapsCreateSessionOptions } from "./GoogleMapsSession.js";
import { GoogleMapsUtils } from "../internal/GoogleMapsUtils.js";


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
  },

  /**
   * Read the session options from the map layer settings.
   * @param settings Map layer settings
   * ```
   * @beta
  */
  getMapLayerSessionOptions: (settings: ImageMapLayerSettings) => {
    return GoogleMapsUtils.getSessionOptionsFromMapLayer(settings);
  },
};
