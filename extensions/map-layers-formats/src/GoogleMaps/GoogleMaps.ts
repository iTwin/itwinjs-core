import { BaseMapLayerSettings, ImageMapLayerProps, ImageMapLayerSettings, MapLayerProviderProperties } from "@itwin/core-common";
import { IModelApp, MapCartoRectangle } from "@itwin/core-frontend";
import { GoogleMapsMapLayerFormat } from "./GoogleMapsImageryFormat";
import { Angle } from "@itwin/core-geometry";
import { Logger } from "@itwin/core-bentley";

const loggerCategory = "MapLayersFormats.GoogleMaps";

/** @beta*/
export type LayerTypes = "layerRoadmap" | "layerStreetview" | "layerTraffic";
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
   * `layerTraffic`: Displays current traffic conditions.
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


// eslint-disable-next-line @typescript-eslint/naming-convention
export const GoogleMaps = {
/**
 * Creates a Google Maps session.
 * @param apiKey Google Cloud API key
 * @param opts Options to create the session
 * @beta
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
 * Converts the session options to provider properties
 * @param opts Options to create the session
 * @beta
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
    return properties;
  },

/**
 * Creates a Google Maps layer settings.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @beta
*/
  createMapLayerSettings: (name?: string, opts?: CreateSessionOptions): ImageMapLayerSettings => {
    return ImageMapLayerSettings.fromJSON(GoogleMaps.createMapLayerProps(name, opts));
  },

  createBaseLayerSettings: (name?: string, opts?: CreateSessionOptions): ImageMapLayerSettings => {
    return BaseMapLayerSettings.fromJSON(GoogleMaps.createMapLayerProps(name, opts));
  },


  /**
 * Creates a Google Maps layer props.
 * @param name Name of the layer (Defaults to "GoogleMaps")
 * @param opts Options to create the session  (Defaults to satellite map type, English language, US region, and roadmap layer type)
 * @beta
*/
  createMapLayerProps: (name: string = "GoogleMaps", opts?: CreateSessionOptions): ImageMapLayerProps => {
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
};
