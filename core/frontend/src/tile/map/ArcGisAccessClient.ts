/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisTokenClientType, ArcGisTokenManager, ArcGisUtilities, EsriOAuth2, EsriOAuth2Endpoint,
  EsriOAuth2EndpointType, MapLayerAccessClient, MapLayerAccessToken, MapLayerTokenEndpoint } from "../internal";

/** @beta */
export class ArcGisAccessClient implements MapLayerAccessClient {

  public async getAccessToken(settings: ImageMapLayerSettings): Promise<MapLayerAccessToken|undefined> {
    // First lookup Oauth2 tokens, otherwise check legacy tokens
    try {
      const oauth2Token =  await EsriOAuth2.getOAuthTokenForMapLayerUrl(settings.url);
      if (oauth2Token)
        return oauth2Token;

      if (settings.userName && settings.password) {
        return await ArcGisTokenManager.getToken(settings.url, settings.userName, settings.password, { client: ArcGisTokenClientType.referer });
      }
    } catch {

    }
    return undefined;
  }

  public async getTokenServiceEndPoint(settings: ImageMapLayerSettings): Promise<MapLayerTokenEndpoint | undefined> {
    let tokenEndpoint: EsriOAuth2Endpoint | undefined;
    try {
      tokenEndpoint = await ArcGisUtilities.getOAuth2EndpointFromMapLayerUrl(settings.url, EsriOAuth2EndpointType.Authorize);
      if (tokenEndpoint) {

      }
    } catch { }
    return tokenEndpoint;
  }

  public invalidateToken(_settings: ImageMapLayerSettings): boolean {
    return false;
  }

}
