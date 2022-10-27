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

/** @beta */
export class ArcGisAccessClient implements MapLayerAccessClient {
  public readonly onOAuthProcessEnd = new BeEvent();
  private _redirectUri: string | undefined;
  private _expiration: number | undefined;
  private _clientIds: ArcGisOAuthClientIds | undefined;

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
    try {
      const oauth2Token = await this.getOAuthTokenForMapLayerUrl(params.mapLayerUrl.toString());
      if (oauth2Token)
        return oauth2Token;

      if (params.userName && params.password) {
        return await ArcGisTokenManager.getToken(params.mapLayerUrl.toString(), params.userName, params.password, { client: ArcGisTokenClientType.referer });
      }
    } catch {

    }
    return undefined;
  }

  public async getTokenServiceEndPoint(mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined> {
    let tokenEndpoint: ArcGisOAuth2Endpoint | undefined;

    try {
      tokenEndpoint = await this.getOAuth2Endpoint(mapLayerUrl, ArcGisOAuth2EndpointType.Authorize);
      if (tokenEndpoint) {

      }
    } catch { }

    return tokenEndpoint;
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

  /**
  * Test if Oauth2 endpoint is accessible and has an associated appId
  * @return true/false if validation succeeded, undefined if validation could not be performed (i.e CORS/network error)
  * @internal
  */
  private async validateOAuth2Endpoint(endpointUrl: string): Promise<boolean | undefined> {

    // Check if we got a matching appId for that endpoint, otherwise its not worth going further
    if (undefined === this.getMatchingEnterpriseClientId(endpointUrl)) {
      return false;
    }

    let status: number | undefined;
    try {
      const data = await fetch(endpointUrl, { method: "GET" });
      status = data.status;
    } catch (error: any) {
      // fetch() throws when there is a CORS error, so in that case
      // we cannot confirm if the oauth2 endpoint is valid or not, we return undefined
      return undefined;
    }
    return status === 400;    // Oauth2 API returns 400 (Bad Request) when there are missing parameters
  }

  // Derive the Oauth URL from a typical MapLayerURL
  // i.e. 	  https://hostname/server/rest/services/NewYork/NewYork3857/MapServer
  //      =>  https://hostname/portal/sharing/oauth2/authorize
  private _oauthAuthorizeEndPointsCache = new Map<string, any>();
  private _oauthTokenEndPointsCache = new Map<string, any>();

  /**
 * Get OAuth2 endpoint that must be cause to get the Oauth2 token
 * @internal
 */
  private async getOAuth2Endpoint(url: string, endpoint: ArcGisOAuth2EndpointType): Promise<ArcGisOAuth2Endpoint | undefined> {

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
          const valid = await this.validateOAuth2Endpoint(oauth2Url);
          // We assume undefined means CORS error, that shouldn't prevent popup from displaying the login page.
          if (valid === undefined || valid) {
            const oauthEndpoint = new ArcGisOAuth2Endpoint(oauth2Url, this.constructLoginUrl(oauth2Url, false), false);
            cacheResult(oauthEndpoint);
            return oauthEndpoint;
          }
        } catch { }
      }

      // If reach this point, that means we could not derive the token endpoint from 'tokenServicesUrl', lets try something else.
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
