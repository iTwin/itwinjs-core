import { ImageMapLayerProps, ImageMapLayerSettings, MapLayerProviderProperties } from "@itwin/core-common";
import { IModelApp, MapCartoRectangle } from "@itwin/core-frontend";
import { GoogleMapsMapLayerFormat } from "./GoogleMapsImageryFormat";
import { Angle } from "@itwin/core-geometry";
import { Logger } from "@itwin/core-bentley";

const loggerCategory = "MapLayersFormats.GoogleMaps";

export type LayerTypesType = "layerRoadmap" | "layerStreetview" | "layerTraffic";
export type MapTypesType =  "roadmap"|"satellite"|"terrain";
export type ImageFormatsType = "jpeg" | "png";

/**
* Represents the options to create a Google Maps session.
*/
export interface CreateGoogleMapsSessionOptions {
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
  mapType: MapTypesType,
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
   * `layerTraffic`: Displays current traffic conditions.
   * @beta
   * */
  layerTypes?: LayerTypesType[];
  /**
   * Specifies the file format to return. Valid values are either jpeg or png. JPEG files don't support transparency, therefore they aren't recommended for overlay tiles. If you don't specify an imageFormat, then the best format for the tile is chosen automatically.
   */
  imageFormat?: ImageFormatsType;
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
export interface GoogleMapsMaxZoomRect {
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
export interface GoogleMapsViewportInfo {
  /**  Attribution string that you must display on your map when you display roadmap and satellite tiles. */
  copyright: string;

  /** Array of bounding rectangles that overlap with the current viewport. Also contains the maximum zoom level available within each rectangle.. */
  maxZoomRects: GoogleMapsMaxZoomRect[];
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


// eslint-disable-next-line @typescript-eslint/naming-convention
export const GoogleMaps = {
/**
 * Creates a Google Maps session.
 * @param apiKey Google Cloud API key
 * @param opts Options to create the session
 * @beta
*/
  createSession: async (apiKey: string, opts: CreateGoogleMapsSessionOptions): Promise<GoogleMapsSession> => {
    const url = `https://tile.googleapis.com/v1/createSession?key=${apiKey}`;
    const request = new Request(url, {method: "POST", body: JSON.stringify(opts)});
    const response = await fetch (request);
    if (!response.ok) {
      throw new Error(`CreateSession request failed: ${response.status} -  ${response.statusText}`);
    }
    Logger.logInfo(loggerCategory, `Session created successfully`);
    return response.json();
  },

  /**
 * Converts the session options to provider properties
 * @param opts Options to create the session
 * @beta
*/
  createPropertiesFromSessionOptions: (opts: CreateGoogleMapsSessionOptions): MapLayerProviderProperties => {
    const properties: MapLayerProviderProperties = {
      mapType: opts.mapType,
      language: opts.mapType,
    }

    if (opts.layerTypes !== undefined) {
      properties.layerTypes = opts.layerTypes;
    }
    if (opts.region !== undefined) {
      properties.region = opts.region;
    }
    return properties
  },

/**
 * Creates a Google Maps layer settings.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @beta
*/
  createMapLayerSettings: (name?: string, opts?: CreateGoogleMapsSessionOptions): ImageMapLayerSettings => {
    return ImageMapLayerSettings.fromJSON(GoogleMaps.createMapLayerProps(name, opts));
  },

  /**
 * Creates a Google Maps layer props.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @beta
*/
  createMapLayerProps: (name: string = "GoogleMaps", opts?: CreateGoogleMapsSessionOptions): ImageMapLayerProps => {
    if (!IModelApp.mapLayerFormatRegistry.isRegistered(GoogleMapsMapLayerFormat.formatId)) {
      IModelApp.mapLayerFormatRegistry.register(GoogleMapsMapLayerFormat);
    }
    return {
      formatId: GoogleMapsMapLayerFormat.formatId,
      url: "",
      name,
      properties: GoogleMaps.createPropertiesFromSessionOptions(opts ?? {mapType: "satellite", language: "en-US", region: "US:", layerTypes: ["layerRoadmap"]}),
    };
  },

  /**
  * Retrieves the maximum zoom level available within a bounding rectangle.
  * @param rectangle The bounding rectangle
  * @returns The maximum zoom level available within the bounding rectangle.
   * @beta
  */
  getViewportInfo: async (params: ViewportInfoRequestParams): Promise<GoogleMapsViewportInfo | undefined>=> {
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
    return json as GoogleMapsViewportInfo;;
  },
};
