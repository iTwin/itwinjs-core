/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle } from "@itwin/core-geometry";
import { ImageMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { getJson, request, RequestBasicCredentials, RequestOptions, Response } from "../../request/Request";
import {MapCartoRectangle, MapLayerAccessClient, MapLayerAccessToken, MapLayerAuthType, MapLayerSource, MapLayerSourceStatus, MapLayerSourceValidation} from "../internal";
import { IModelApp } from "../../IModelApp";
import { MapLayerAccessTokenParams } from "../internal";

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

  public static async validateSource(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {

    // const authMethod: MapLayerAuthType = MapLayerAuthType.None;
    // let tokenEndpoint: EsriOAuth2Endpoint | undefined;
    const json = await this.getServiceJson(url, credentials, ignoreCache);
    if (json === undefined) {
      return { status: MapLayerSourceStatus.InvalidUrl };
    } else if (json.error !== undefined) {

      // If we got a 'Token Required' error, lets check what authentification methods this ESRI service offers
      // and return information needed to initiate the authentification process... the end-user
      // will have to provide his credentials before we can fully validate this source.
      if (json.error.code === ArcGisErrorCode.TokenRequired) {
        // authMethod = MapLayerAuthType.EsriToken; // In case we failed to get the Oauth2 token endpoint, fall back to the legacy ESRI token method
        // try {
        //   tokenEndpoint = await ArcGisUtilities.getOAuth2EndpointFromMapLayerUrl(url, EsriOAuth2EndpointType.Authorize);
        //   if (tokenEndpoint) {
        //     authMethod = MapLayerAuthType.EsriOAuth2;
        //   }
        // } catch { }

        // return { status: MapLayerSourceStatus.RequireAuth, authInfo: { authMethod, tokenEndpoint } };
        return { status: MapLayerSourceStatus.RequireAuth};
      } else if (json.error.code === ArcGisErrorCode.InvalidCredentials)
        return { status: MapLayerSourceStatus.InvalidCredentials, authInfo: { authMethod: MapLayerAuthType.EsriToken } };
    }

    // Check this service support map queries
    let hasMapCapability = false;
    try {
      if (json.capabilities
        && typeof json.capabilities === "string"
        && json.capabilities.toLowerCase().includes("map")) {
        hasMapCapability = true;
      }
    } catch { }
    if (!hasMapCapability) {
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

  public static async getServiceJson(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<any> {
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
        await ArcGisUtilities.appendSecurityToken(tmpUrl, accessClient, {mapLayerUrl: tmpUrl, userName: credentials?.user, password: credentials?.password });
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
        await ArcGisUtilities.appendSecurityToken(tmpUrl, accessClient, {mapLayerUrl: tmpUrl, userName: credentials?.user, password: credentials?.password });
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

  private static extractRestBaseUrl(url: string) {
    const searchStr = "/rest/";
    const restPos = url.indexOf(searchStr);
    return (restPos === -1 ? undefined : url.substr(0, restPos + searchStr.length));

  }

  public static async requestGetJson(url: string) {
    return request(url, { method: "GET", responseType: "json" });
  }

  public static async getRestUrlFromGenerateTokenUrl(url: string): Promise<string | undefined> {
    const restUrl = ArcGisUtilities.extractRestBaseUrl(url);
    if (restUrl === undefined) {
      return undefined;
    }

    // First attempt: derive the Oauth2 token URL from the 'tokenServicesUrl', exposed by the 'info request'
    const infoUrl = `${restUrl}info?f=json`;
    let data;
    try {
      data = await this.requestGetJson(infoUrl);
    } catch { }

    const tokenServicesUrl = data?.body?.authInfo?.tokenServicesUrl;
    if (tokenServicesUrl === undefined) {
      return undefined;
    }
    return ArcGisUtilities.extractRestBaseUrl(tokenServicesUrl);
  }

}
