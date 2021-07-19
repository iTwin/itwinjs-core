/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle } from "@bentley/geometry-core";
import { MapSubLayerProps } from "@bentley/imodeljs-common";
import { getJson, request, RequestBasicCredentials, RequestOptions, Response } from "@bentley/itwin-client";
import { ArcGisBaseToken, ArcGisOAuth2Token, EsriOAuth2Endpoint, FrontendRequestContext } from "../../imodeljs-frontend";
import { MapLayerAuthType, MapLayerSourceValidation } from "../internal";
import { MapCartoRectangle } from "./MapCartoRectangle";
import { MapLayerSource, MapLayerSourceStatus } from "./MapLayerSources";
import { ArcGisTokenClientType } from "./ArcGisTokenGenerator";
import { ArcGisTokenManager } from "./ArcGisTokenManager";
import { EsriOAuth2, EsriOAuth2EndpointType } from "./EsriOAuth2";

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
    const capabilities = await getJson(new FrontendRequestContext(""), `${url}?f=pjson`);

    return capabilities;
  }
  public static async getNationalMapSources(): Promise<MapLayerSource[]> {
    const sources = new Array<MapLayerSource>();
    const services = await getJson(new FrontendRequestContext(""), "https://viewer.nationalmap.gov/tnmaccess/api/getMapServiceList");

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
    const json = await getJson(new FrontendRequestContext(""), `${url}?f=json`);
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
      const json = await getJson(new FrontendRequestContext(""), `${url}?f=json&q=(group:9d1199a521334e77a7d15abbc29f8144) AND (type:"Map Service")&bbox=${ArcGisUtilities.getBBoxString(range)}&sortOrder=desc&start=${start}&num=100`);
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

    let authMethod: MapLayerAuthType = MapLayerAuthType.None;
    let tokenEndpoint: EsriOAuth2Endpoint | undefined;
    const json = await this.getServiceJson(url, credentials, ignoreCache);
    if (json === undefined) {
      return { status: MapLayerSourceStatus.InvalidUrl };
    } else if (json.error !== undefined) {

      // If we got a 'Token Required' error, lets check what authentification methods this ESRI service offers
      // and return information needed to initiate the authentification process... the end-user
      // will have to provide his credentials before we can fully validate this source.
      if (json.error.code === ArcGisErrorCode.TokenRequired) {
        authMethod = MapLayerAuthType.EsriToken; // In case we failed to get the Oauth2 token endpoint, fall back to the legacy ESRI token method
        try {
          tokenEndpoint = await ArcGisUtilities.getOAuth2EndpointFromMapLayerUrl(url, EsriOAuth2EndpointType.Authorize);
          if (tokenEndpoint) {
            authMethod = MapLayerAuthType.EsriOAuth2;
          }
        } catch { }

        return { status: MapLayerSourceStatus.RequireAuth, authInfo: { authMethod, tokenEndpoint } };
      } else if (json.error.code === ArcGisErrorCode.InvalidCredentials)
        return { status: MapLayerSourceStatus.InvalidCredentials, authInfo: { authMethod: MapLayerAuthType.EsriToken } };
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
      let tokenParam = "";

      let oauth2Token: ArcGisOAuth2Token | undefined;
      try {
        oauth2Token = await EsriOAuth2.getOAuthTokenForMapLayerUrl(url);
      } catch { }

      if (credentials || oauth2Token !== undefined) {
        const token = (credentials ? await ArcGisTokenManager.getToken(url, credentials.user, credentials.password, { client: ArcGisTokenClientType.referer }) : oauth2Token);
        if (token?.token) {
          tokenParam = `&token=${token.token}`;
        } else if (token?.error)
          return token;   // An error occurred, return immediately
      }
      const finalUrl = `${url}?f=json${tokenParam}`;
      const data = await request(new FrontendRequestContext(""), finalUrl, options);
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
      let tokenParam = "";
      let oauth2Token: ArcGisOAuth2Token | undefined;
      try {
        oauth2Token = await EsriOAuth2.getOAuthTokenForMapLayerUrl(url);
      } catch { }

      if (credentials || oauth2Token) {
        const token: ArcGisBaseToken = (credentials ? await ArcGisTokenManager.getToken(url, credentials.user, credentials.password, { client: ArcGisTokenClientType.referer }) : oauth2Token);
        if (token?.token)
          tokenParam = `&token=${token.token}`;
      }
      const json = await getJson(new FrontendRequestContext(""), `${url}?f=json&option=footprints&outSR=4326${tokenParam}`);
      ArcGisUtilities._footprintCache.set(url, json);
      return json;
    } catch (_error) {
      ArcGisUtilities._footprintCache.set(url, undefined);
      return undefined;
    }
  }

  private static extractRestBaseUrl(url: string) {
    const searchStr = "/rest/";
    const restPos = url.indexOf(searchStr);
    return (restPos === -1 ? undefined : url.substr(0, restPos + searchStr.length));

  }

  public static async requestGetJson(url: string) {
    return request(new FrontendRequestContext(""), url, { method: "GET", responseType: "json" });
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

  // Test if Oauth2 endpoint is accessible and has an associated appId
  public static async validateOAuth2Endpoint(endpointUrl: string): Promise<boolean> {

    // Check if we got a matching appId for that endpoint, otherwise its not worth going further
    if (undefined === EsriOAuth2.getMatchingEnterpriseAppId(endpointUrl)) {
      return false;
    }

    let status: number | undefined;
    try {
      const data = await request(new FrontendRequestContext(""), endpointUrl, { method: "GET" });
      status = data.status;
    } catch (error) {
      status = error.status;
    }
    return status === 400;    // Oauth2 API returns 400 (Bad Request) when there are missing parameters
  }

  // Derive the Oauth URL from a typical MapLayerURL
  // i.e. 	  https://hostname/server/rest/services/NewYork/NewYork3857/MapServer
  //      =>  https://hostname/portal/sharing/oauth2/authorize
  private static _oauthAuthorizeEndPointsCache = new Map<string, any>();
  private static _oauthTokenEndPointsCache = new Map<string, any>();
  public static async getOAuth2EndpointFromMapLayerUrl(url: string, endpoint: EsriOAuth2EndpointType): Promise<EsriOAuth2Endpoint | undefined> {

    // Return from cache if available
    const cachedEndpoint = (endpoint === EsriOAuth2EndpointType.Authorize ? this._oauthAuthorizeEndPointsCache.get(url) : this._oauthTokenEndPointsCache.get(url));
    if (cachedEndpoint !== undefined) {
      return cachedEndpoint;
    }

    const cacheResult = (obj: EsriOAuth2Endpoint) => {
      if (endpoint === EsriOAuth2EndpointType.Authorize) {
        this._oauthAuthorizeEndPointsCache.set(url, obj);
      } else {
        this._oauthTokenEndPointsCache.set(url, obj);
      }
    };

    const endpointStr = (endpoint === EsriOAuth2EndpointType.Authorize ? "authorize" : "token");
    const urlObj = new URL(url);
    if (urlObj.hostname.toLowerCase().endsWith("arcgis.com")) {
      // ArcGIS Online (fixed)
      // Doc: https://developers.arcgis.com/documentation/mapping-apis-and-services/security/oauth-2.0/
      return new EsriOAuth2Endpoint(`https://www.arcgis.com/sharing/rest/oauth2/${endpointStr}`, true);
    } else {

      // First attempt: derive the Oauth2 token URL from the 'tokenServicesUrl', exposed by the 'info request'
      let restUrlFromTokenService: string | undefined;
      try {
        restUrlFromTokenService = await ArcGisUtilities.getRestUrlFromGenerateTokenUrl(url);
      } catch { }

      if (restUrlFromTokenService !== undefined) {
        // Validate the URL we just composed
        try {
          const oauth2Url = `${restUrlFromTokenService}oauth2/${endpointStr}`;
          if (await this.validateOAuth2Endpoint(oauth2Url)) {
            const oauthEndpoint = new EsriOAuth2Endpoint(oauth2Url, false);
            cacheResult(oauthEndpoint);
            return oauthEndpoint;
          }
        } catch { }
      }

      // If reach this point, that means we could not derive the token endpoint from 'tokenServicesUrl'
      // lets use another approach.
      // ArcGIS Enterprise Format https://<host>:<port>/<subdirectory>/sharing/rest/oauth2/authorize
      const regExMatch = url.match(new RegExp(/([^&\/]+)\/rest\/services\/.*/, "i"));
      if (regExMatch !== null && regExMatch.length >= 2) {
        const subdirectory = regExMatch[1];
        const port = (urlObj.port !== "80" && urlObj.port !== "443") ? `:${urlObj.port}` : "";
        const newUrlObj = new URL(`${urlObj.protocol}//${urlObj.hostname}${port}/${subdirectory}/sharing/rest/oauth2/${endpointStr}`);

        // Check again the URL we just composed
        try {
          const newUrl = newUrlObj.toString();
          if (await this.validateOAuth2Endpoint(newUrl)) {
            const oauthEndpoint = new EsriOAuth2Endpoint(newUrl, false);
            cacheResult(oauthEndpoint);
            return oauthEndpoint;
          }
        } catch { }
      }

    }
    return undefined;   // we could not find any valid oauth2 endpoint
  }

}
