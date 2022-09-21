/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle, Constant } from "@itwin/core-geometry";
import { MapSubLayerProps } from "@itwin/core-common";
import { getJson, request, RequestBasicCredentials, RequestOptions, Response } from "../../request/Request";
import { MapCartoRectangle, MapLayerAccessClient, MapLayerAccessToken, MapLayerAccessTokenParams, MapLayerSource, MapLayerSourceStatus, MapLayerSourceValidation} from "../internal";
import { IModelApp } from "../../IModelApp";

/** @packageDocumentation
 * @module Tiles
 */
/** @internal */
export enum ArcGisErrorCode {
  InvalidCredentials = 401,
  InvalidToken = 498,
  TokenRequired = 499,
  UnknownError = 1000,
  NoTokenService = 1001,
}

/** @internal */
export class ArcGisUtilities {

  public static hasTokenError(response: Response): boolean {
    if (response.header && (response.header["content-type"] as string)?.toLowerCase().includes("json")) {
      try {
        // Tile response returns byte array, so we need to check the response data type and convert accordingly.
        const json = ((response.body instanceof ArrayBuffer) ? JSON.parse(Buffer.from(response.body).toString()) : response.body);
        return (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken);
      } catch (_err) {
        return false;  // that probably means we failed to convert byte array to JSON
      }
    }
    return false;
  }

  private static getBBoxString(range?: MapCartoRectangle) {
    if (!range)
      range = MapCartoRectangle.create();

    return `${range.low.x * Angle.degreesPerRadian},${range.low.y * Angle.degreesPerRadian},${range.high.x * Angle.degreesPerRadian},${range.high.y * Angle.degreesPerRadian}`;
  }
  public static async getEndpoint(url: string): Promise<any | undefined> {
    const capabilities = await request(`${url}?f=pjson`, {
      method: "GET",
      responseType: "json",
    });
    return capabilities.body;
  }

  public static async getNationalMapSources(): Promise<MapLayerSource[]> {
    const sources = new Array<MapLayerSource>();
    const services = await getJson("https://viewer.nationalmap.gov/tnmaccess/api/getMapServiceList");

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
    const json = await getJson(`${url}?f=json`);
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
  public static async getSourcesFromQuery(range?: MapCartoRectangle, url = "https://usgs.maps.arcgis.com/sharing/rest/search"): Promise<MapLayerSource[]> {
    const sources = new Array<MapLayerSource>();
    for (let start = 1; start > 0;) {
      const json = await getJson(`${url}?f=json&q=(group:9d1199a521334e77a7d15abbc29f8144) AND (type:"Map Service")&bbox=${ArcGisUtilities.getBBoxString(range)}&sortOrder=desc&start=${start}&num=100`);
      if (!json) break;
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

  public static async validateSource(url: string, capabilitiesFilter: string[], userName?: string, password?: string, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    const json = await this.getServiceJson(url, userName, password, ignoreCache);
    if (json === undefined) {
      return { status: MapLayerSourceStatus.InvalidUrl };
    } else if (json.error !== undefined) {

      // If we got a 'Token Required' error, lets check what authentification methods this ESRI service offers
      // and return information needed to initiate the authentification process... the end-user
      // will have to provide his credentials before we can fully validate this source.
      if (json.error.code === ArcGisErrorCode.TokenRequired) {
        return { status: MapLayerSourceStatus.RequireAuth};
      } else if (json.error.code === ArcGisErrorCode.InvalidCredentials)
        return { status: MapLayerSourceStatus.InvalidCredentials};
    }

    // Check this service support the expected queries
    let hasCapabilities = false;
    try {
      if (json.capabilities && typeof json.capabilities === "string" ) {
        const capabilities: string = json.capabilities;
        const capsArray: string[] = capabilities.split(",").map((entry) => entry.toLowerCase());
        const filtered = capsArray.filter((element, _index, _array) => capabilitiesFilter.includes(element));
        hasCapabilities = (filtered.length === capabilitiesFilter.length);
      }
    }catch { }
    if (!hasCapabilities) {
      return { status: MapLayerSourceStatus.InvalidFormat};
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

  private static _serviceCache = new Map<string, any>();

  public static async getServiceJson(url: string, userName?: string, password?: string, ignoreCache?: boolean): Promise<any> {
    if (!ignoreCache) {
      const cached = ArcGisUtilities._serviceCache.get(url);
      if (cached !== undefined)
        return cached;
    }

    try {
      const options: RequestOptions = {
        method: "GET",
        responseType: "json",
      };

      const tmpUrl = new URL(url);
      tmpUrl.searchParams.append("f", "json");
      const accessClient = IModelApp.mapLayerFormatRegistry.getAccessClient("ArcGIS");
      if (accessClient) {
        await ArcGisUtilities.appendSecurityToken(tmpUrl, accessClient, {mapLayerUrl: new URL(url), userName, password});
      }
      const data = await request(tmpUrl.toString(), options);
      const json = data.body ?? undefined;

      // Cache the response only if it doesn't contain a token error.
      if (!ArcGisUtilities.hasTokenError(data)) {
        ArcGisUtilities._serviceCache.set(url, json);
      }

      return json;
    } catch (_error) {
      ArcGisUtilities._serviceCache.set(url, undefined);
      return undefined;
    }
  }

  private static _footprintCache = new Map<string, any>();
  public static async getFootprintJson(url: string, credentials?: RequestBasicCredentials): Promise<any> {
    const cached = ArcGisUtilities._footprintCache.get(url);
    if (cached !== undefined)
      return cached;

    try {
      const tmpUrl = new URL(url);
      tmpUrl.searchParams.append("f", "json");
      tmpUrl.searchParams.append("option", "footprints");
      tmpUrl.searchParams.append("outSR", "4326");
      const accessClient = IModelApp.mapLayerFormatRegistry.getAccessClient("ArcGIS");
      if (accessClient) {
        await ArcGisUtilities.appendSecurityToken(tmpUrl, accessClient, {mapLayerUrl: new URL(url), userName: credentials?.user, password: credentials?.password });
      }

      const json = await getJson(tmpUrl.toString());
      ArcGisUtilities._footprintCache.set(url, json);
      return json;
    } catch (_error) {
      ArcGisUtilities._footprintCache.set(url, undefined);
      return undefined;
    }
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
  public static computeZoomLevelsScales(startZoom: number = 0, endZoom: number = 20, latitude: number = 0, tileSize: number = 256, screenDpi = 96 ): {zoom: number, resolution: number, scale: number}[] {
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
   * Match the provided minScale,maxScale values to corresponding wgs84 zoom levels
   * @param defaultMaxLod Value of the last LOD (i.e 22)
   * @param tileSize Size of a tile in pixels (i.e 256)
   * @param minScale Minimum scale value that needs to be matched to a LOD level
   * @param maxScale Maximum  scale value that needs to be matched to a LOD level
  * @returns minLod: LOD value matching minScale,  maxLod: LOD value matching maxScale
   */
  public static getZoomLevelsScales( defaultMaxLod: number, tileSize: number, minScale?: number, maxScale?: number): {minLod?: number, maxLod?: number} {

    let minLod: number|undefined, maxLod: number|undefined;

    const zoomScales = ArcGisUtilities.computeZoomLevelsScales(0, defaultMaxLod, 0 /* latitude 0 = Equator*/, tileSize);

    if (zoomScales.length > 0) {

      if (minScale) {
        minLod = 0;
        // We are looking for the largest scale value with a scale value smaller than minScale
        for (; minLod < zoomScales.length && zoomScales[minLod].scale > minScale; minLod++);

      }

      if (maxScale) {
        maxLod = defaultMaxLod;
        // We are looking for the smallest scale value with a value greater than maxScale
        for (; maxLod >= 0 && zoomScales[maxLod].scale < maxScale; maxLod--);
      }
    }
    return {minLod, maxLod};
  }

}
