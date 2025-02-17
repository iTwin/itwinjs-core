/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { BaseMapLayerSettings, ImageMapLayerSettings } from "@itwin/core-common";
import { MapCartoRectangle } from "@itwin/core-frontend";
import { GoogleMapsUtils } from "../internal/GoogleMapsUtils";


/** @beta*/
export type LayerTypes = "layerRoadmap" | "layerStreetview";
/** @beta*/
export type MapTypes =  "roadmap"|"satellite"|"terrain";
/** @beta*/
export type ScaleFactors =  "scaleFactor1x" | "scaleFactor2x" | "scaleFactor4x";

/**
* Represents the options to create a Google Maps session.
* @beta
*/
export interface CreateSessionOptions {
    /**
   * The type of base map.
   *
   * `roadmap`: The standard Google Maps painted map tiles.
   *
   * `satellite`: Satellite imagery.
   *
   * `terrain`: Terrain imagery. When selecting `terrain` as the map type, you must also include the `layerRoadmap` layer type.
   * @beta
   * */
  mapType: MapTypes,
  /**
   * An {@link https://en.wikipedia.org/wiki/IETF_language_tag | IETF language tag} that specifies the language used to display information on the tiles. For example, `en-US` specifies the English language as spoken in the United States.
   */
  language: string;
    /**
    * A {@link https://cldr.unicode.org/ | Common Locale Data Repository}  region identifier (two uppercase letters) that represents the physical location of the user. For example, `US`.
    */
  region: string;

  /**
   * An array of values that specifies the layer types added to the map.
   *
   * `layerRoadmap`: Required if you specify terrain as the map type. Can also be optionally overlaid on the satellite map type. Has no effect on roadmap tiles.
   *
   * `layerStreetview`: Shows Street View-enabled streets and locations using blue outlines on the map.
   *
   * @beta
   * */
  layerTypes?: LayerTypes[];

  /**
   * Scales-up the size of map elements (such as road labels), while retaining the tile size and coverage area of the default tile.
   * Increasing the scale also reduces the number of labels on the map, which reduces clutter.
   *
   * `scaleFactor1x`: The default.
   *
   * `scaleFactor2x`: Doubles label size and removes minor feature labels.
   *
   * `scaleFactor4x`: Quadruples label size and removes minor feature labels.
   * @beta
   * */
  scale?: ScaleFactors

  /**
   * A boolean value that specifies whether layerTypes should be rendered as a separate overlay, or combined with the base imagery.
   * When true, the base map isn't displayed. If you haven't defined any layerTypes, then this value is ignored.
   * Default is false.
   * @beta
   * */
    overlay? : boolean;

    /**
     * An array of values specifying additional options to apply.
     * @beta
     * */
    apiOptions?: string[];
};

/**
* Structure representing a Google Maps session.
* @beta
*/
export interface GoogleMapsSession {
  /** A session token value that you must include in all of your Map Tiles API requests. */
  session: string;

  /**  string that contains the time (in seconds since the epoch) at which the token expires. A session token is valid for two weeks from its creation time, but this policy might change without notice. */
  expiry: number;

  /** The width of the tiles measured in pixels. */
  tileWidth: number;

  /** he height of the tiles measured in pixels. */
  tileHeight: number;

  /** The image format, which can be either `png` or `jpeg`. */
  imageFormat: string;
};

/**
 * Represents the maximum zoom level available within a bounding rectangle.
* @beta
*/
export interface MaxZoomRectangle {
  maxZoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Indicate which areas of given viewport have imagery, and at which zoom levels.
 * @beta
*/
export interface ViewportInfo {
  /**  Attribution string that you must display on your map when you display roadmap and satellite tiles. */
  copyright: string;

  /** Array of bounding rectangles that overlap with the current viewport. Also contains the maximum zoom level available within each rectangle.. */
  maxZoomRects: MaxZoomRectangle[];
}

/**
 * Request parameters for the getViewportInfo method.
 * @beta
*/
export interface ViewportInfoRequestParams {
  /** Bounding rectangle */
  rectangle: MapCartoRectangle;

  /** Session token */
  session: string;

  /** The Google Cloud API key */
  key: string;

  /** Zoom level of the viewport */
  zoom: number;
}


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
 * @example
 * const ds = IModelApp.viewManager.selectedView.displayStyle;
 * ds.attachMapLayer({
 *    mapLayerIndex: {index: 0, isOverlay: false},
 *    settings: GoogleMaps.createMapLayerSettings("GoogleMaps")});
 * @beta
*/
  createMapLayerSettings: (name?: string, opts?: CreateSessionOptions) => {
    return ImageMapLayerSettings.fromJSON(GoogleMapsUtils.createMapLayerProps(name, opts));
  },

/**
 * Creates Google Maps base layer settings.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @example
 * const ds = IModelApp.viewManager.selectedView.displayStyle;
 * ds.backgroundMapBase = GoogleMaps.createBaseLayerSettings();
 * @beta
*/
  createBaseLayerSettings: (opts?: CreateSessionOptions) => {
    return BaseMapLayerSettings.fromJSON(GoogleMapsUtils.createMapLayerProps("GoogleMaps", opts));
  }
};