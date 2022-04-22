/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeEvent } from "@itwin/core-bentley";
import { ArcGisTokenClientType, ArcGisTokenManager, MapLayerAccessClient, MapLayerAccessToken, MapLayerAccessTokenParams, MapLayerTokenEndpoint } from "@itwin/core-frontend";
import { EsriOAuth2, EsriOAuth2Endpoint, EsriOAuth2EndpointType } from "./EsriOAuth2";
/*
import { ArcGisTokenClientType, ArcGisTokenManager, ArcGisUtilities, EsriOAuth2, EsriOAuth2Endpoint,
  EsriOAuth2EndpointType, MapLayerAccessClient, MapLayerAccessToken, MapLayerTokenEndpoint } from "../internal";*/

/** @beta */
export class ArcGisAccessClient implements MapLayerAccessClient {
  public readonly onOAuthProcessEnd =  new BeEvent();

  public constructor() {
    (window as any).esriOAuth2Callback = (redirectLocation?: Location) => {
      let eventSuccess = false;
      let decodedState;

      if (redirectLocation && redirectLocation.hash.length > 0) {
        const locationHash = redirectLocation.hash;
        const hashParams = new URLSearchParams(locationHash.substr(1));
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
  }

  public async getAccessToken(params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken|undefined> {
    // First lookup Oauth2 tokens, otherwise check try "legacy tokens" if credentials were provided
    try {
      const oauth2Token =  await EsriOAuth2.getOAuthTokenForMapLayerUrl(params.mapLayerUrl.toString());
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
    let tokenEndpoint: EsriOAuth2Endpoint | undefined;
    try {
      tokenEndpoint = await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(mapLayerUrl, EsriOAuth2EndpointType.Authorize);
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

}
