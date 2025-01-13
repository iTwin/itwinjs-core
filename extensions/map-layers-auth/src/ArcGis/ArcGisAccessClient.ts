/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeEvent } from "@itwin/core-bentley";
import { MapLayerAccessClient, MapLayerAccessToken, MapLayerAccessTokenParams, MapLayerTokenEndpoint } from "@itwin/core-frontend";
import { ArcGisOAuth2Token, ArcGisTokenClientType } from "./ArcGisTokenGenerator";
import { ArcGisOAuth2Endpoint, ArcGisOAuth2EndpointType } from "./ArcGisOAuth2Endpoint";
import { ArcGisTokenManager } from "./ArcGisTokenManager";
import { ArcGisUrl } from "./ArcGisUrl";

/** @beta */
export interface ArcGisEnterpriseClientId {
  /* Oauth API endpoint base URL (i.e. https://hostname/portal/sharing/oauth2/authorize)
  used to identify uniquely each enterprise server. */
  serviceBaseUrl: string;

  /* Application's clientId for this enterprise server.*/
  clientId: string;
}

/** @beta */
export interface ArcGisOAuthClientIds {
  /* Application's OAuth clientId in ArcGIS online */
  arcgisOnlineClientId?: string;

  /* Application's OAuth clientId for each enterprise server used. */
  enterpriseClientIds?: ArcGisEnterpriseClientId[];
}

/** @beta
 * ArcGIS OAuth configurations parameters.
 * See https://developers.arcgis.com/documentation/mapping-apis-and-services/security/arcgis-identity/serverless-web-apps/
 * more details.
*/
export interface ArcGisOAuthConfig {
  /* URL to which a user is sent once they complete sign in authorization.
    Must match a URI you define in the developer dashboard, otherwise, the authorization will be rejected.
  */
  redirectUri: string;

  /* Optional expiration after which the token will expire. Defined in minutes with a maximum of two weeks (20160 minutes)*/
  tokenExpiration?: number;

  /* Application client Ids */
  clientIds: ArcGisOAuthClientIds;
}

interface EndPointsCacheEntry {
  authorizeEndpoint?: ArcGisOAuth2Endpoint;
  tokenEndpoint?: ArcGisOAuth2Endpoint;
}

type MapLayerUrl = string;

/** @beta */
export class ArcGisAccessClient implements MapLayerAccessClient {
  public readonly onOAuthProcessEnd = new BeEvent();
  private _redirectUri: string | undefined;
  private _expiration: number | undefined;
  private _clientIds: ArcGisOAuthClientIds | undefined;

  // Should be kept to 'false'. Debugging purposes only.
  private _forceLegacyToken = false;

  public constructor() {
  }

  public initialize(oAuthConfig?: ArcGisOAuthConfig): boolean {
    if (oAuthConfig) {
      this._redirectUri = oAuthConfig.redirectUri;
      this._expiration = oAuthConfig.tokenExpiration;
      this._clientIds = oAuthConfig.clientIds;

      this.initOauthCallbackFunction();
    }
    return true;
  }

  private initOauthCallbackFunction() {
    (window as any).arcGisOAuth2Callback = (redirectLocation?: Location) => {
      let eventSuccess = false;
      let stateData;

      if (redirectLocation && redirectLocation.hash.length > 0) {
        const locationHash = redirectLocation.hash;
        const hashParams = new URLSearchParams(locationHash.substring(1));
        const token = hashParams.get("access_token") ?? undefined;
        const expiresInStr = hashParams.get("expires_in") ?? undefined;
        const userName = hashParams.get("username") ?? undefined;
        const ssl = hashParams.get("ssl") === "true";
        const stateStr = hashParams.get("state") ?? undefined;
        const persist = hashParams.get("persist") === "true";
        if (token !== undefined && expiresInStr !== undefined && userName !== undefined && ssl !== undefined && stateStr !== undefined) {
          let endpointOrigin;
          try {
            const state = JSON.parse(stateStr);
            stateData = state?.customData;
            endpointOrigin = state?.endpointOrigin;

          } catch {
          }
          const expiresIn = Number(expiresInStr);
          const expiresAt = (expiresIn * 1000) + (+new Date());   // Converts the token expiration delay (seconds) into a timestamp (UNIX time)
          if (endpointOrigin !== undefined) {
            ArcGisTokenManager.setOAuth2Token(endpointOrigin, { token, expiresAt, ssl, userName, persist });
            eventSuccess = true;
          }

        }
      }
      this.onOAuthProcessEnd.raiseEvent(eventSuccess, stateData);
    };
  }

  public unInitialize() {
    this._redirectUri = undefined;
    this._expiration = undefined;
    (window as any).arcGisOAuth2Callback = undefined;
  }

  public async getAccessToken(params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken | undefined> {
    // First lookup Oauth2 tokens, otherwise check try "legacy tokens" if credentials were provided

    if (!this._forceLegacyToken) {
      const oauth2Token = await this.getOAuthTokenForMapLayerUrl(params.mapLayerUrl.toString());
      if (oauth2Token)
        return oauth2Token;
    }

    if (params.userName && params.password) {
      return ArcGisTokenManager.getToken(params.mapLayerUrl.toString(), params.userName, params.password, { client: ArcGisTokenClientType.referer });
    }

    return undefined;
  }

  /** @internal */
  public static async validateOAuth2Endpoint(endpointUrl: string): Promise<boolean> {
    const data = await fetch(endpointUrl, { method: "GET" });
    return data.status === 400;    // Oauth2 API returns 400 (Bad Request) when there are missing parameters
  }

  public async getTokenServiceEndPoint(mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined> {
    if (!this._forceLegacyToken) {
      return this.getOAuth2Endpoint(mapLayerUrl, ArcGisOAuth2EndpointType.Authorize);
    }

    return undefined;
  }

  public invalidateToken(token: MapLayerAccessToken): boolean {
    let found = ArcGisTokenManager.invalidateToken(token);
    if (!found) {
      found = ArcGisTokenManager.invalidateOAuth2Token(token);
    }
    return found;
  }

  public get redirectUri() {
    return this._redirectUri;
  }

  public getMatchingEnterpriseClientId(url: string) {
    const clientIds = this.arcGisEnterpriseClientIds;
    if (!clientIds) {
      return undefined;
    }

    let clientId: string | undefined;
    let defaultClientId: string | undefined;
    for (const entry of clientIds) {
      if (entry.serviceBaseUrl === "") {
        defaultClientId = entry.clientId;
      } else {
        if (url.toLowerCase().startsWith(entry.serviceBaseUrl)) {
          clientId = entry.clientId;
        }
      }
    }

    // If we could not find a match with serviceBaseUrl, and a default clientId
    // was specified (i.e empty url), then use default clientId
    if (clientId === undefined && defaultClientId !== undefined) {
      clientId = defaultClientId;
    }
    return clientId;
  }

  public get expiration() {
    return this._expiration;
  }

  public get arcGisOnlineClientId() {
    return this._clientIds?.arcgisOnlineClientId;
  }

  public set arcGisOnlineClientId(clientId: string | undefined) {
    if (this._clientIds === undefined) {
      this._clientIds = { arcgisOnlineClientId: clientId };
    }
    this._clientIds.arcgisOnlineClientId = clientId;
  }

  public get arcGisEnterpriseClientIds() {
    return this._clientIds?.enterpriseClientIds;
  }

  public setEnterpriseClientId(serviceBaseUrl: string, clientId: string) {

    if (this._clientIds?.enterpriseClientIds) {
      const foundIdx = this._clientIds.enterpriseClientIds.findIndex((entry) => entry.serviceBaseUrl === serviceBaseUrl);
      if (foundIdx !== -1) {
        this._clientIds.enterpriseClientIds[foundIdx].clientId = clientId;
      } else {
        this._clientIds.enterpriseClientIds.push({ serviceBaseUrl, clientId });
      }
    } else {
      if (this._clientIds === undefined) {
        this._clientIds = {};
      }
      this._clientIds.enterpriseClientIds = [{ serviceBaseUrl, clientId }];
    }
  }

  public removeEnterpriseClientId(clientId: ArcGisEnterpriseClientId) {

    if (this._clientIds?.enterpriseClientIds) {
      this._clientIds.enterpriseClientIds = this._clientIds?.enterpriseClientIds?.filter((item) => item.serviceBaseUrl !== clientId.serviceBaseUrl);
    }

  }

  /// //////////
  /** @internal */
  private async getOAuthTokenForMapLayerUrl(mapLayerUrl: string): Promise<ArcGisOAuth2Token | undefined> {
    try {
      const oauthEndpoint = await this.getOAuth2Endpoint(mapLayerUrl, ArcGisOAuth2EndpointType.Authorize);
      if (oauthEndpoint !== undefined) {
        const oauthEndpointUrl = new URL(oauthEndpoint.getUrl());
        return ArcGisTokenManager.getOAuth2Token(oauthEndpointUrl.origin);
      }
    } catch { }
    return undefined;
  }

  // Mapping between a map-layer URL and its corresponding Oauth endpoint
  // i.e. 	  https://hostname/server/rest/services/NewYork/NewYork3857/MapServer
  //      =>  https://hostname/portal/sharing/oauth2/authorize

  private _endPointsCache = new Map<MapLayerUrl, EndPointsCacheEntry>();

  /**
 * Get OAuth2 endpoint that must be cause to get the Oauth2 token
 * @internal
 */
  private cacheEndpoint(url: MapLayerUrl, endpointType: ArcGisOAuth2EndpointType, endPoint: ArcGisOAuth2Endpoint) {
    const entry = endpointType === ArcGisOAuth2EndpointType.Authorize ? {authorizeEndpoint: endPoint} : {tokenEndpoint: endPoint};
    this._endPointsCache.set(url, entry);
  }

  /**
 * Get OAuth2 endpoint that must be cause to get the Oauth2 token
 * @internal
 */
  private async createEndpoint(mapLayerUrl: MapLayerUrl, oauthEndpointUrl: string, endpointType: ArcGisOAuth2EndpointType): Promise<ArcGisOAuth2Endpoint | undefined> {
    // Validate the URL we just composed
    const oauthEndpoint = new ArcGisOAuth2Endpoint(oauthEndpointUrl, this.constructLoginUrl(oauthEndpointUrl, false), false);
    this.cacheEndpoint(mapLayerUrl, endpointType, oauthEndpoint);
    return oauthEndpoint;
  }

  /**
  * Returns whether the ArcGis host is valid
  * @internal
  */
  private isArcGisHostValid(url: URL): boolean {
    const allowedHosts = [
      "arcgis.com",
    ];

    return allowedHosts.some((host: string) => url.hostname.toLowerCase().endsWith(host));
  }

  private async validateEndpointUrl(url: string) {
    let valid: boolean|undefined;
    try {
      valid = await ArcGisAccessClient.validateOAuth2Endpoint(url.toString());
    } catch {
      // If we reach here, this means we could not validate properly the endpoint;
      // we cannot conclude the endpoint is invalid though; it might happen endpoint doesn't support CORS requests,
      // but still valid for Oauth process.
    }
    return valid;
  }

  /**
 * Get OAuth2 endpoint that must be cause to get the Oauth2 token
 * @internal
 */
  private async getOAuth2Endpoint(mapLayerUrl: string, endpointType: ArcGisOAuth2EndpointType): Promise<ArcGisOAuth2Endpoint | undefined> {
    // Return from cache if available
    const cachedEndpoint = this._endPointsCache.get(mapLayerUrl);
    if (cachedEndpoint !== undefined) {
      return (endpointType === ArcGisOAuth2EndpointType.Authorize ? cachedEndpoint.authorizeEndpoint : cachedEndpoint.authorizeEndpoint);
    }

    const endpointStr = (endpointType === ArcGisOAuth2EndpointType.Authorize ? "authorize" : "token");

    const urlObj = new URL(mapLayerUrl);

    if (this.isArcGisHostValid(urlObj)) {
      // ArcGIS Online (fixed)
      // Doc: https://developers.arcgis.com/documentation/mapping-apis-and-services/security/oauth-2.0/

      if (this.arcGisOnlineClientId === undefined) {
        return undefined;
      }

      const oauth2Url = `https://www.arcgis.com/sharing/rest/oauth2/${endpointStr}`;
      return new ArcGisOAuth2Endpoint(oauth2Url, this.constructLoginUrl(oauth2Url, true), true);
    } else {

      // First attempt: derive the Oauth2 token URL from the 'tokenServicesUrl', exposed by the 'info request'
      try {
        const restUrlFromTokenService = await ArcGisUrl.getRestUrlFromGenerateTokenUrl(urlObj);

        if (restUrlFromTokenService === undefined) {
          // We could not derive the token endpoint from 'tokenServicesUrl'.
          // ArcGIS Enterprise Format https://<host>:<port>/<subdirectory>/sharing/rest/oauth2/authorize
          const regExMatch = mapLayerUrl.match(new RegExp(/([^&\/]+)\/rest\/services\/.*/, "i"));
          if (regExMatch !== null && regExMatch.length >= 2) {
            const subdirectory = regExMatch[1];
            const port = (urlObj.port !== "80" && urlObj.port !== "443") ? `:${urlObj.port}` : "";
            const newUrlObj = new URL(`${urlObj.protocol}//${urlObj.hostname}${port}/${subdirectory}/sharing/rest/oauth2/${endpointStr}`);

            // Check again the URL we just composed
            const isValidUrl = await this.validateEndpointUrl(newUrlObj.toString());
            if (isValidUrl === undefined || isValidUrl ) {
              const endpoint = await this.createEndpoint(mapLayerUrl, newUrlObj.toString(), endpointType);
              if (endpoint)
                return endpoint;
            }
          }
        } else {
          const oauthEndpointUrl = `${restUrlFromTokenService.toString()}oauth2/${endpointStr}`;
          const isValidUrl = await this.validateEndpointUrl(oauthEndpointUrl);
          if (isValidUrl === undefined || isValidUrl ) {
            const endpoint = await this.createEndpoint(mapLayerUrl, oauthEndpointUrl, endpointType);
            if (endpoint)
              return endpoint;
          }
        }
      } catch {
      }
    }

    // If we reach here, we were not successful creating an endpoint
    this._endPointsCache.set(mapLayerUrl, {});  // Cache an empty entry, and avoid making repeated failing requests.

    return undefined;   // we could not find any valid oauth2 endpoint
  }

  /**
 * Construct the complete Authorize url to starts the Oauth process
 * @internal
 */
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
