/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { ImageMapLayerSettings } from "@itwin/core-common";

/** @beta */
export enum MapLayerAuthType {
  None = 1,
  Basic = 2,
  EsriToken = 3,
  EsriOAuth2 = 4,
}
/** @internal */
export interface MapLayerTokenEndpoint {
  getLoginUrl(stateData?: string): string|undefined;
  getUrl(): string;
}

/** @internal */
export interface MapLayerAuthenticationInfo {
  authMethod: MapLayerAuthType;
  tokenEndpoint?: MapLayerTokenEndpoint;
}

/** @internal */
export interface MapLayerAccessToken {
  // The generated token.
  token: string;
}

/** @beta */
export interface MapLayerAccessClient {
  getAccessToken(settings: ImageMapLayerSettings): Promise<MapLayerAccessToken|undefined>;
  getTokenServiceEndPoint?(settings: ImageMapLayerSettings): Promise<MapLayerTokenEndpoint | undefined>;
  invalidateToken?(settings: ImageMapLayerSettings): boolean;
}

