import { BackgroundMapType, BaseMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapCartoRectangle, Viewport } from "@itwin/core-frontend";
import { GoogleMapsMapLayerFormat } from "./GoogleMapsImageryFormat";
import { Angle } from "@itwin/core-geometry";

export const getGoogleMapsLayerCode = (bgMapType: BackgroundMapType) =>  {
  let layer = "y";  // default to hybrid
  switch (bgMapType) {
    case BackgroundMapType.Aerial:
      layer = "s";
      break;
    case BackgroundMapType.Street:
      layer = "m";
      break;
  }
  return layer;
};

export const enableLegacyGoogleMaps = (viewport: Viewport, bgMapType: BackgroundMapType) => {
  const displayStyle =  viewport.displayStyle;
  const googleLayer = getGoogleMapsLayerCode(bgMapType);
  displayStyle.backgroundMapBase = BaseMapLayerSettings.fromJSON({
    formatId: "TileURL",
    url: `https://mt0.google.com/vt/lyrs=${googleLayer}&hl=en&x={column}&y={row}&z={level}`,
    name: "google",
  });
};

export type GoogleMapsMapType =
  "roadmap"     // Roads, buildings, points of interest, and political boundaries
  | "satellite" // Photographic imagery taken from space
  | "terrain";  // A contour map that shows natural features such as vegetation

export interface CreateGoogleMapsSessionOptions {
  mapType: GoogleMapsMapType;
  language: string;       // https://en.wikipedia.org/wiki/IETF_language_tag (i.e. en-US)
  region: string;         // https://cldr.unicode.org/ (i.e. US)
  orientation?: number;   // 0 (the default), 90, 180, and 270
  layerTypes?: string[];  // i.e. ["layerRoadmap"]
};

export interface GoogleMapsSession {
  expiry: number;
  imageFormat: string;
  session: string;
  tileHeight: number;
  tileWidth: number;
};

export interface GoogleMapsMaxZoomRect {
  maxZoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

/**  Indicate which areas of given viewport have imagery, and at which zoom levels. */
export interface GoogleMapsViewportInfo {
  /**  Attribution string that you must display on your map when you display roadmap and satellite tiles. */
  copyright: string;

  /** Array of bounding rectangles that overlap with the current viewport. Also contains the maximum zoom level available within each rectangle.. */
  maxZoomRects: GoogleMapsMaxZoomRect[];
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const GoogleMaps = {

  apiKey: "",

  createSession: async (apiKey: string, opts: CreateGoogleMapsSessionOptions): Promise<GoogleMapsSession> => {
    const url = `https://tile.googleapis.com/v1/createSession?key=${apiKey}`;
    const request = new Request(url, {method: "POST", body: JSON.stringify(opts)});
    const response = await fetch (request);
    if (!response.ok) {
      throw new Error(`CreateSession request failed: ${response.status} -  ${response.statusText}`);
    }
    return response.json();
  },

  createBaseMapLayerSettings: (subLayerName: string, opts: CreateGoogleMapsSessionOptions) => {
    const registry = IModelApp.mapLayerFormatRegistry;
    if (!registry.isRegistered(GoogleMapsMapLayerFormat.formatId)) {
      registry.register(GoogleMapsMapLayerFormat);
    }

    const sessionOptsStr = JSON.stringify(opts);
    const settings = BaseMapLayerSettings.fromJSON({
      formatId: "GoogleMaps",
      url: `https://tile.googleapis.com/v1/2dtiles/{level}/{column}/{row}`,
      // url: `https://tile.googleapis.com/v1/2dtiles/{level}/{column}/{row}?session=${session}&key=${key}`,
      name: "GoogleMaps",
      subLayers: (subLayerName !== undefined ? [{name: subLayerName, visible: true, title: sessionOptsStr}] : undefined),
    });
    // settings.unsavedQueryParams = {session,key};
    return settings;
  },

  getViewportInfo: async (rectangle: MapCartoRectangle, zoom: number, session: string, key: string): Promise<GoogleMapsViewportInfo | undefined>=> {
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

