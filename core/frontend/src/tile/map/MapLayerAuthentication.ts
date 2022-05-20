/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { BeEvent, Listener } from "@itwin/core-bentley";

/** @beta */
export interface MapLayerTokenEndpoint {
  getLoginUrl(stateData?: any): string|undefined;
  getUrl(): string;
}

/** @beta */
export interface MapLayerAuthenticationInfo {
  tokenEndpoint?: MapLayerTokenEndpoint;
}

/** @beta */
export interface MapLayerAccessToken {
  // The generated token.
  token: string;
}

/** @beta */
export interface MapLayerAccessTokenParams {
  mapLayerUrl: URL;

  // credentials are used to generate non-oauth tokens (i.e ArcGIS legacy tokens)
  userName?: string;
  password?: string;
}

/** @beta */
export interface MapLayerAccessClient {
  getAccessToken(params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken|undefined>;
  getTokenServiceEndPoint?(mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined>;
  invalidateToken?(token: MapLayerAccessToken): boolean;

  onOAuthProcessEnd?: BeEvent<Listener>;
}

