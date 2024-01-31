/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle, Constant } from "@itwin/core-geometry";
import { MapSubLayerProps } from "@itwin/core-common";
import { MapCartoRectangle, MapLayerAccessClient, MapLayerAccessToken, MapLayerAccessTokenParams, MapLayerSource, MapLayerSourceStatus, MapLayerSourceValidation, ValidateSourceArgs} from "../internal";
import { IModelApp } from "../../IModelApp";
import { headersIncludeAuthMethod } from "../../request/utils";

/** @packageDocumentation
 * @module Tiles
 */

/**
 * Class representing an ArcGIS error code.
 * @internal
 */
export enum ArcGisErrorCode {
  InvalidCredentials = 401,
  InvalidToken = 498,
  TokenRequired = 499,
  UnknownError = 1000,
  NoTokenService = 1001,
}

/**
 * Class representing an ArcGIS service metadata.
 * @internal
 */
export interface ArcGISServiceMetadata {
  /** JSON content from the service */
  content: any;

  /** Indicates if an access token is required to access the service */
  accessTokenRequired: boolean;
}

/** Arguments for validating ArcGIS sources
 * @internal
 */
export interface ArcGisValidateSourceArgs extends ValidateSourceArgs {
  /** List of capabilities 'keyword' that needs to be advertised in the service's metadata in order to be valid.  For example: 'Map', 'Query', etc*/
  capabilitiesFilter: string[];
}

/** Arguments for fetching service metadata
 * @internal
 */
export interface ArcGisGetServiceJsonArgs  {
  url: string;
  formatId: string;
  userName?: string;
  password?: string;
  queryParams?: {[key: string]: string};
  ignoreCache?: boolean;
  requireToken?: boolean;
}

/**
 * Class containing utilities relating to ArcGIS services and coordinate systems.
 * @internal
 */
export class ArcGisUtilities {

  private static getBBoxString(range?: MapCartoRectangle) {
    if (!range)
      range = MapCartoRectangle.createMaximum();

    return `${range.low.x * Angle.degreesPerRadian},${range.low.y * Angle.degreesPerRadian},${range.high.x * Angle.degreesPerRadian},${range.high.y * Angle.degreesPerRadian}`;
  }

  public static async getNationalMapSources(): Promise<MapLayerSource[]> {
    const sources = new Array<MapLayerSource>();
    const response = await fetch("https://viewer.nationalmap.gov/tnmaccess/api/getMapServiceList", { method: "GET" });
    const services = await response.json();

    if (!Array.isArray(services))
      return sources;

    for (const service of services) {
      if (service.wmsUrl.length === 0)    // Exclude Wfs..
        continue;
      switch (service.serviceType) {
        case "ArcGIS":
          sources.push(MapLayerSource.fromJSON({ name: service.displayName, url: service.serviceLink, formatId: "ArcGIS" })!);
          break;
        default: {
          const wmsIndex = service.wmsUrl.lastIndexOf("/wms");
          if (wmsIndex > 0) {
            const url = service.wmsUrl.slice(0, wmsIndex + 4);
            sources.push(MapLayerSource.fromJSON({ name: service.displayName, url, formatId: "WMS" })!);
          }
          break;
        }
      }
    }
    return sources;
  }

  public static async getServiceDirectorySources(url: string, baseUrl?: string): Promise<MapLayerSource[]> {
    if (undefined === baseUrl)
      baseUrl = url;
    let sources = new Array<MapLayerSource>();
    const response = await fetch(`${url}?f=json`, { method: "GET" });
    const json = await response.json();
    if (json !== undefined) {
      if (Array.isArray(json.folders)) {
        for (const folder of json.folders) {
          sources = sources.concat(await ArcGisUtilities.getServiceDirectorySources(`${url}/${folder}`, url));
        }
      }
      if (Array.isArray(json.services)) {
        for (const service of json.services) {
          let source;
          if (service.type === "MapServer")
            source = MapLayerSource.fromJSON({ name: service.name, url: `${baseUrl}/${service.name}/MapServer`, formatId: "ArcGIS" });
          else if (service.type === "ImageServer")
            source = MapLayerSource.fromJSON({ name: service.name, url: `${baseUrl}/${service.name}/ImageServer`, formatId: "ArcGIS" });
          if (source)
            sources.push(source);
        }
      }
    }

    return sources;
  }

  /**
   * Get map layer sources from an ArcGIS query.
   * @param range Range for the query.
   * @param url URL for the query.
   * @returns List of map layer sources.
   */
  public static async getSourcesFromQuery(range?: MapCartoRectangle, url = "https://usgs.maps.arcgis.com/sharing/rest/search"): Promise<MapLayerSource[]> {
    const sources = new Array<MapLayerSource>();
    for (let start = 1; start > 0;) {
      const response = await fetch(`${url}?f=json&q=(group:9d1199a521334e77a7d15abbc29f8144) AND (type:"Map Service")&bbox=${ArcGisUtilities.getBBoxString(range)}&sortOrder=desc&start=${start}&num=100`, { method: "GET" });
      const json = await response.json();
      if (!json)
        break;

      start = json.nextStart ? json.nextStart : -1;
      if (json !== undefined && Array.isArray(json.results)) {
        for (const result of json.results) {
          const source = MapLayerSource.fromJSON({ name: result.name ? result.name : result.title, url: result.url, formatId: "ArcGIS" });
          if (source)
            sources.push(source);
        }
      }
    }

    return sources;
  }

  /**
   * Parse the URL to check if it represents a valid ArcGIS service
   * @param url URL to validate.
   * @param serviceType Service type to validate (i.e FeatureServer, MapServer)
   * @return Validation Status.
   */
  public static validateUrl(url: string, serviceType: string): MapLayerSourceStatus {
    const urlObj = new URL(url.toLowerCase());
    if (urlObj.pathname.includes("/rest/services/")) {
      // This seem to be an ArcGIS URL, lets check the service type
      if (urlObj.pathname.endsWith(`${serviceType.toLowerCase()}`)) {
        return MapLayerSourceStatus.Valid;
      } else {
        return MapLayerSourceStatus.IncompatibleFormat;
      }
    } else {
      return MapLayerSourceStatus.InvalidUrl;
    }
  }

  /**
   * Attempt to access an ArcGIS service, and validate its service metadata.
   * @param source Source to validate.
   * @param opts Validation options
  */
  public static async validateSource(args: ArcGisValidateSourceArgs): Promise<MapLayerSourceValidation> {
    const {source, ignoreCache, capabilitiesFilter} = args;
    const metadata = await this.getServiceJson({url: source.url, formatId: source.formatId, userName: source.userName, password: source.password, queryParams: source.collectQueryParams(), ignoreCache});
    const json = metadata?.content;
    if (json === undefined) {
      return { status: MapLayerSourceStatus.InvalidUrl };
    } else if (json.error !== undefined) {

      // If we got a 'Token Required' error, lets check what authentification methods this ESRI service offers
      // and return information needed to initiate the authentification process... the end-user
      // will have to provide his credentials before we can fully validate this source.
      if (json.error.code === ArcGisErrorCode.TokenRequired) {
        return (source.userName || source.password) ? {status: MapLayerSourceStatus.InvalidCredentials} : {status: MapLayerSourceStatus.RequireAuth};
      } else if (json.error.code === ArcGisErrorCode.InvalidCredentials)
        return { status: MapLayerSourceStatus.InvalidCredentials};
    }

    // Check this service support the expected queries
    let hasCapabilities = false;
    let capsArray: string[] = [];
    if (json.capabilities && typeof json.capabilities === "string" ) {
      const capabilities: string = json.capabilities;
      capsArray = capabilities.split(",").map((entry) => entry.toLowerCase());

      const filtered = capsArray.filter((element, _index, _array) => capabilitiesFilter.includes(element));
      hasCapabilities = (filtered.length === capabilitiesFilter.length);
    }
    if (!hasCapabilities) {
      return { status: MapLayerSourceStatus.InvalidFormat};
    }

    // Only EPSG:3857 is supported with pre-rendered tiles.
    if (json.tileInfo && capsArray.includes("tilesonly") && !ArcGisUtilities.isEpsg3857Compatible(json.tileInfo)) {
      return { status: MapLayerSourceStatus.InvalidCoordinateSystem};
    }

    let subLayers;
    if (json.layers) {

      subLayers = new Array<MapSubLayerProps>();

      for (const layer of json.layers) {
        const parent = layer.parentLayerId < 0 ? undefined : layer.parentLayerId;
        const children = Array.isArray(layer.subLayerIds) ? layer.subLayerIds : undefined;
        subLayers.push({ name: layer.name, visible: layer.defaultVisibility !== false, id: layer.id, parent, children });
      }
    }
    return { status: MapLayerSourceStatus.Valid, subLayers };
  }

  /** Validate MapService tiling metadata and checks if the tile tree is 'Google Maps' compatible. */
  public static isEpsg3857Compatible(tileInfo: any) {
    if (tileInfo.spatialReference?.latestWkid !== 3857 || !Array.isArray(tileInfo.lods))
      return false;

    const zeroLod = tileInfo.lods[0];
    return zeroLod.level === 0 && Math.abs(zeroLod.resolution - 156543.03392800014) < .001;
  }

  private static _serviceCache = new Map<string, ArcGISServiceMetadata|undefined>();

  /**
   * Fetches an ArcGIS service metadata, and returns its JSON representation.
   * If an access client has been configured for the specified formatId,
   * it will be used to apply required security token.
   * By default, response for each URL are cached.
   * @param url URL of the ArcGIS service
   * @param formatId Format ID of the service
   * @param userName Username to use for legacy token based security
   * @param password Password to use for legacy token based security
   * @param ignoreCache Flag to skip cache lookup (i.e. force a new server request)
   * @param requireToken Flag to indicate if a token is required
   */

  public static async getServiceJson(args: ArcGisGetServiceJsonArgs): Promise<ArcGISServiceMetadata|undefined> {
    const {url, formatId, userName, password, queryParams, ignoreCache, requireToken} = args;
    if (!ignoreCache) {
      const cached = ArcGisUtilities._serviceCache.get(url);
      if (cached !== undefined)
        return cached;
    }
    const appendParams = (urlObj: URL, params?: {[key: string]: string}) => {
      if (params) {
        Object.keys(params).forEach((paramKey) => {
          if (!urlObj.searchParams.has(paramKey))
            urlObj.searchParams.append(paramKey, params[paramKey]);
        });
      }
    };

    const createUrlObj = () => {
      const tmpUrl = new URL(url);
      tmpUrl.searchParams.append("f", "json");
      appendParams(tmpUrl, queryParams);
      return tmpUrl;
    };

    let accessTokenRequired = false;
    try {
      let tmpUrl = createUrlObj();

      // In some cases, caller might already know token is required, so append it immediately
      if (requireToken) {
        const accessClient = IModelApp.mapLayerFormatRegistry.getAccessClient(formatId);
        if (accessClient) {
          accessTokenRequired = true;
          await ArcGisUtilities.appendSecurityToken(tmpUrl, accessClient, {mapLayerUrl: new URL(url), userName, password});
        }
      }
      let response = await fetch(tmpUrl.toString(), { method: "GET" });
      if (response.status === 401 && !requireToken && headersIncludeAuthMethod(response.headers, ["ntlm", "negotiate"])) {
        // We got a http 401 challenge, lets try again with SSO enabled (i.e. Windows Authentication)
        response = await fetch(url, {method: "GET", credentials: "include" });
      }

      // Append security token when corresponding error code is returned by ArcGIS service
      let errorCode = await ArcGisUtilities.checkForResponseErrorCode(response);
      if (!accessTokenRequired
        && errorCode !== undefined
        && errorCode === ArcGisErrorCode.TokenRequired ) {
        accessTokenRequired = true;
        // If token required
        const accessClient = IModelApp.mapLayerFormatRegistry.getAccessClient(formatId);
        if (accessClient) {
          tmpUrl = createUrlObj();
          await ArcGisUtilities.appendSecurityToken(tmpUrl, accessClient, {mapLayerUrl: new URL(url), userName, password});
          response = await fetch(tmpUrl.toString(), { method: "GET" });
          errorCode = await ArcGisUtilities.checkForResponseErrorCode(response);
        }
      }

      const json = await response.json();
      const info = {content: json, accessTokenRequired};
      // Cache the response only if it doesn't contain any error.
      ArcGisUtilities._serviceCache.set(url, (errorCode === undefined ? info : undefined));
      return info;  // Always return json, even though it contains an error code.

    } catch (_error) {
      ArcGisUtilities._serviceCache.set(url, undefined);
      return undefined;
    }
  }

  /** Read a response from ArcGIS server and check for error code in the response. */
  public static async checkForResponseErrorCode(response: Response) {
    const tmpResponse = response;
    if (response.headers && tmpResponse.headers.get("content-type")?.toLowerCase().includes("json")) {

      try {
        // Note:
        // Since response stream can only be read once (i.e. calls to .json() method)
        // we have to clone the response object in order to check for potential error code,
        // but still keep the response stream as unread.
        const clonedResponse = tmpResponse.clone();
        const json = await clonedResponse.json();
        if (json?.error?.code !== undefined)
          return json?.error?.code as number;
      } catch { }

    }
    return undefined;
  }

  // return the appended access token if available.
  public static async appendSecurityToken(url: URL, accessClient: MapLayerAccessClient, accessTokenParams: MapLayerAccessTokenParams): Promise<MapLayerAccessToken|undefined> {

    // Append security token if available
    let accessToken: MapLayerAccessToken|undefined;
    try {
      accessToken = await accessClient.getAccessToken(accessTokenParams);
    } catch {}

    if (accessToken?.token) {
      url.searchParams.append("token", accessToken.token);
      return accessToken;
    }

    return undefined;
  }

  /**
   * Compute scale, resolution values for requested zoom levels (WSG 84)
   * Use a scale of 96 dpi for Google Maps scales
   * Based on this article: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Resolution_and_Scale
   * @param startZoom Zoom level where scales begins to be computed
   * @param endZoom Zoom level where scales ends to be computed
   * @param latitude Latitude in degrees to use to compute scales (i.e 0 for Equator)
   * @param tileSize Size of a tile in pixels (i.e 256)
   * @param screenDpi Monitor resolution in dots per inch (i.e. typically 96dpi is used by Google Maps)
   * @returns An array containing resolution and scale values for each requested zoom level
   */
  public static computeZoomLevelsScales(startZoom: number = 0, endZoom: number = 20, latitude: number = 0, tileSize: number = 256, screenDpi = 96): {zoom: number, resolution: number, scale: number}[] {
    // Note: There is probably a more direct way to compute this, but I prefer to go for a simple and well documented approach.
    if (startZoom <0 || endZoom < startZoom || tileSize < 0 || screenDpi < 1  || latitude < -90 || latitude > 90)
      return [];

    const inchPerMeter = 1 / 0.0254;
    const results: {zoom: number, resolution: number, scale: number}[] = [];
    const equatorLength = Constant.earthRadiusWGS84.equator * 2  * Math.PI;
    const zoom0Resolution = equatorLength / tileSize; // in meters per pixel

    const cosLatitude = Math.cos(latitude);
    for (let zoom = startZoom;  zoom<= endZoom; zoom++) {
      const resolution = zoom0Resolution * cosLatitude / Math.pow(2, zoom);
      const scale =  screenDpi * inchPerMeter *  resolution;
      results.push({zoom, resolution, scale});
    }

    return results;
  }

  /**
   * Match the provided minScale, maxScale values to corresponding wgs84 zoom levels
   * @param defaultMaxLod Value of the last LOD (i.e 22)
   * @param tileSize Size of a tile in pixels (i.e 256)
   * @param minScale Minimum scale value that needs to be matched to a LOD level
   * @param maxScale Maximum  scale value that needs to be matched to a LOD level
   * @returns minLod: LOD value matching minScale,  maxLod: LOD value matching maxScale
   */
  public static getZoomLevelsScales( defaultMaxLod: number, tileSize: number, minScale?: number, maxScale?: number, tolerance: number = 0): {minLod?: number, maxLod?: number} {

    let minLod: number|undefined, maxLod: number|undefined;

    const zoomScales = ArcGisUtilities.computeZoomLevelsScales(0, defaultMaxLod, 0 /* latitude 0 = Equator*/, tileSize);

    if (zoomScales.length > 0) {

      if (minScale) {
        minLod = 0;
        // We are looking for the largest scale value with a scale value smaller than minScale
        for (; minLod < zoomScales.length && (zoomScales[minLod].scale > minScale && Math.abs(zoomScales[minLod].scale - minScale) > tolerance); minLod++)
          ;

      }

      if (maxScale) {
        maxLod = defaultMaxLod;
        // We are looking for the smallest scale value with a value greater than maxScale
        for (; maxLod >= 0 && zoomScales[maxLod].scale < maxScale && Math.abs(zoomScales[maxLod].scale - maxScale) > tolerance; maxLod--)
          ;
      }
    }
    return {minLod, maxLod};
  }

}
