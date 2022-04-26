/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeEvent } from "@itwin/core-bentley";
import { ArcGisOAuth2Token, ArcGisTokenClientType, ArcGisTokenManager, MapLayerAccessClient, MapLayerAccessToken, MapLayerAccessTokenParams, MapLayerTokenEndpoint } from "@itwin/core-frontend";
import { ArcGisOAuth2Endpoint, ArcGisOAuth2EndpointType } from "./ArcGisOAuth2Endpoint";
import { ArcGisUrl } from "./ArcGisUrl";

/** @beta */
export interface ArcGisEnterpriseClientId {
  serviceBaseUrl: string;
  clientId: string;
}
/** @beta */
export interface EsriOAuthClientIds {
  arcgisOnlineClientId?: string;
  enterpriseClientIds?: ArcGisEnterpriseClientId[];
}

/** @beta */
export class ArcGisAccessClient implements MapLayerAccessClient {
  public readonly onOAuthProcessEnd =  new BeEvent();
  private _redirectUri: string|undefined;
  private _expiration: number|undefined;
  private  _clientIds: EsriOAuthClientIds|undefined;

  public constructor() {
  }

  public initialize(redirectUri: string, tokenExpiration?: number): boolean {
    this._redirectUri = redirectUri;
    this._expiration = tokenExpiration;

    (window as any).esriOAuth2Callback = (redirectLocation?: Location) => {
      let eventSuccess = false;
      let decodedState;

      if (redirectLocation && redirectLocation.hash.length > 0) {
        const locationHash = redirectLocation.hash;
        const hashParams = new URLSearchParams(locationHash.substring(1));
        const token = hashParams.get("access_token") ?? undefined;
        const expiresInStr = hashParams.get("expires_in") ?? undefined;
        const userName = hashParams.get("username") ?? undefined;
        const ssl = hashParams.get("ssl") === "true";
        const state = hashParams.get("state") ?? undefined;
        const persist = hashParams.get("persist") === "true";
        if ( token !== undefined && expiresInStr !== undefined && userName !== undefined && ssl !== undefined && state !== undefined) {
          decodedState = decodeURIComponent(state);
          const stateUrl = new URL(decodedState);
          const expiresIn = Number(expiresInStr);
          const expiresAt = (expiresIn * 1000) + (+new Date());   // Converts the token expiration delay (seconds) into a timestamp (UNIX time)
          ArcGisTokenManager.setOAuth2Token(stateUrl.origin, {token, expiresAt, ssl, userName, persist});
          eventSuccess = true;
        }
      }
      this.onOAuthProcessEnd.raiseEvent(eventSuccess, decodedState);
    };
    return true;
  }

  public unInitialize() {
    this._redirectUri = undefined;
    this._expiration = undefined;
    (window as any).esriOAuth2Callback = undefined;
  }

  public async getAccessToken(params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken|undefined> {
    // First lookup Oauth2 tokens, otherwise check try "legacy tokens" if credentials were provided
    try {
      const oauth2Token = await this.getOAuthTokenForMapLayerUrl(params.mapLayerUrl.toString());
      if (oauth2Token)
        return oauth2Token;

      if (params.userName && params.password) {
        const token = await ArcGisTokenManager.getToken(params.mapLayerUrl.toString(), params.userName, params.password, { client: ArcGisTokenClientType.referer });
        if (token?.token) {
          return token?.token;
        } else if (token?.error)
          return undefined;
      }
    } catch {

    }
    return undefined;
  }

  public async getTokenServiceEndPoint(mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined> {
    let tokenEndpoint: ArcGisOAuth2Endpoint | undefined;
    try {
      tokenEndpoint = await this.getOAuth2EndpointFromMapLayerUrl(mapLayerUrl, ArcGisOAuth2EndpointType.Authorize);
      if (tokenEndpoint) {

      }
    } catch { }
    return tokenEndpoint;
  }

  public invalidateToken(token: MapLayerAccessToken): boolean {
    let  found =  ArcGisTokenManager.invalidateToken(token);
    if (!found) {
      found =  ArcGisTokenManager.invalidateOAuth2Token(token);
    }
    return found;
  }

  /// //////////
  /** @internal */
  public  async getOAuthTokenForMapLayerUrl(mapLayerUrl: string): Promise<ArcGisOAuth2Token|undefined> {
    try {
      const oauthEndpoint = await this.getOAuth2EndpointFromMapLayerUrl(mapLayerUrl, ArcGisOAuth2EndpointType.Authorize);
      if (oauthEndpoint !== undefined) {
        const oauthEndpointUrl = new URL(oauthEndpoint.getUrl());
        return ArcGisTokenManager.getOAuth2Token(oauthEndpointUrl.origin);
      }
    } catch {}
    return undefined;
  }

  public get redirectUri() {
    return this._redirectUri;
  }

  public getMatchingEnterpriseClientId(url: string) {
    let clientId: string|undefined;
    const clientIds = this.arcGisEnterpriseClientIds;
    if (!clientIds) {
      return undefined;
    }
    for (const entry of clientIds) {
      if (url.toLowerCase().startsWith(entry.serviceBaseUrl)) {
        clientId = entry.clientId;
      }
    }
    return clientId;
  }

  public get expiration() {
    return this._expiration;
  }

  public get arcGisOnlineClientId() {
    return this._clientIds?.arcgisOnlineClientId;
  }

  public set arcGisOnlineClientId(clientId: string|undefined) {
    if (this._clientIds === undefined) {
      this._clientIds  = {arcgisOnlineClientId: clientId };
    }
    this._clientIds.arcgisOnlineClientId = clientId;
  }

  public get arcGisEnterpriseClientIds() {
    return this._clientIds?.enterpriseClientIds;
  }

  public setEnterpriseClientId(serviceBaseUrl: string, clientId: string) {

    if (this._clientIds?.enterpriseClientIds) {
      const foundIdx = this._clientIds.enterpriseClientIds.findIndex((entry)=>entry.serviceBaseUrl === serviceBaseUrl);
      if (foundIdx !== -1) {
        this._clientIds.enterpriseClientIds[foundIdx].clientId = clientId;
      } else {
        this._clientIds.enterpriseClientIds.push({serviceBaseUrl, clientId});
      }
    } else {
      if (this._clientIds === undefined) {
        this._clientIds  = {};
      }
      this._clientIds.enterpriseClientIds = [{serviceBaseUrl, clientId}];
    }
  }

  public removeEnterpriseClientId(clientId: ArcGisEnterpriseClientId) {

    if (this._clientIds?.enterpriseClientIds) {
      this._clientIds.enterpriseClientIds = this._clientIds?.enterpriseClientIds?.filter((item) => item.serviceBaseUrl !== clientId.serviceBaseUrl);
    }

  }

  // Test if Oauth2 endpoint is accessible and has an associated appId
  public async validateOAuth2Endpoint(endpointUrl: string): Promise<boolean> {

    // Check if we got a matching appId for that endpoint, otherwise its not worth going further
    if (undefined === this.getMatchingEnterpriseClientId(endpointUrl)) {
      return false;
    }

    let status: number | undefined;
    try {
      const data = await fetch(endpointUrl, { method: "GET" });
      status = data.status;
    } catch (error: any) {
      status = error.status;
    }
    return status === 400;    // Oauth2 API returns 400 (Bad Request) when there are missing parameters
  }

  // Derive the Oauth URL from a typical MapLayerURL
  // i.e. 	  https://hostname/server/rest/services/NewYork/NewYork3857/MapServer
  //      =>  https://hostname/portal/sharing/oauth2/authorize
  private _oauthAuthorizeEndPointsCache = new Map<string, any>();
  private _oauthTokenEndPointsCache = new Map<string, any>();

  public async getOAuth2EndpointFromMapLayerUrl(url: string, endpoint: ArcGisOAuth2EndpointType): Promise<ArcGisOAuth2Endpoint | undefined> {

    // Return from cache if available
    const cachedEndpoint = (endpoint === ArcGisOAuth2EndpointType.Authorize ? this._oauthAuthorizeEndPointsCache.get(url) : this._oauthTokenEndPointsCache.get(url));
    if (cachedEndpoint !== undefined) {
      return cachedEndpoint;
    }

    const cacheResult = (obj: ArcGisOAuth2Endpoint) => {
      if (endpoint === ArcGisOAuth2EndpointType.Authorize) {
        this._oauthAuthorizeEndPointsCache.set(url, obj);
      } else {
        this._oauthTokenEndPointsCache.set(url, obj);
      }
    };

    const endpointStr = (endpoint === ArcGisOAuth2EndpointType.Authorize ? "authorize" : "token");
    const urlObj = new URL(url);
    if (urlObj.hostname.toLowerCase().endsWith("arcgis.com")) {
      // ArcGIS Online (fixed)
      // Doc: https://developers.arcgis.com/documentation/mapping-apis-and-services/security/oauth-2.0/

      if (this.arcGisOnlineClientId === undefined) {
        return undefined;
      }

      const oauth2Url = `https://www.arcgis.com/sharing/rest/oauth2/${endpointStr}`;
      return new ArcGisOAuth2Endpoint(url, this.constructLoginUrl(oauth2Url, true), true);
    } else {

      // First attempt: derive the Oauth2 token URL from the 'tokenServicesUrl', exposed by the 'info request'
      let restUrlFromTokenService: URL | undefined;
      try {
        restUrlFromTokenService = await ArcGisUrl.getRestUrlFromGenerateTokenUrl(urlObj);
      } catch { }

      if (restUrlFromTokenService !== undefined) {
        // Validate the URL we just composed
        try {
          const oauth2Url = `${restUrlFromTokenService.toString()}oauth2/${endpointStr}`;
          if (await this.validateOAuth2Endpoint(oauth2Url)) {
            const oauthEndpoint = new ArcGisOAuth2Endpoint(oauth2Url, this.constructLoginUrl(oauth2Url, false), false);
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
            const oauthEndpoint = new ArcGisOAuth2Endpoint(newUrl, this.constructLoginUrl(newUrl, false), false);
            cacheResult(oauthEndpoint);
            return oauthEndpoint;
          }
        } catch { }
      }

    }
    return undefined;   // we could not find any valid oauth2 endpoint
  }

  private constructLoginUrl(url: string, isArcgisOnline: boolean) {
    const urlObj = new URL(url);

    // Set the client id
    if (isArcgisOnline) {
      const clientId = this.arcGisOnlineClientId;
      assert(clientId !== undefined);
      if (clientId !== undefined) {
        urlObj.searchParams.set("client_id", clientId);
      }

    } else {
      const clientId = this.getMatchingEnterpriseClientId(url);
      assert(clientId !== undefined);
      if (undefined !== clientId) {
        urlObj.searchParams.set("client_id", clientId);
      }
    }

    urlObj.searchParams.set("response_type", "token");
    if (this.expiration !== undefined) {
      urlObj.searchParams.set("expiration", `${this.expiration}`);
    }

    if (this.redirectUri)
      urlObj.searchParams.set("redirect_uri", this.redirectUri);

    return urlObj.toString();
  }

}
