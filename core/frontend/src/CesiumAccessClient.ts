/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { GuidString } from "@itwin/core-bentley";

/** Describes the endpoint for a resolved Cesium ion asset.
 * @beta
 */
export interface CesiumAssetEndpoint {
  /** Access token for authenticating tile requests. */
  accessToken?: string;
  /** Root URL for fetching tile data. */
  url?: string;
  /** When the access token expires. If not set, a 30-minute default is assumed. */
  expiresAt?: Date;
}

/** Pluggable resolver for Cesium ion asset endpoints. Implement this interface to supply
 * authentication for Cesium ion assets via the iTwin Platform Cesium Curated Content API
 * or any other mechanism.
 * @see [[TileAdmin.Props.cesiumAccess]] to configure this at startup.
 * @beta
 */
export interface CesiumAccessClient {
  /** Resolves the endpoint for a given Cesium ion asset.
   * @param assetId The numeric Cesium ion asset identifier.
   * @param iTwinId Optional iTwin identifier providing context, if available.
   */
  getAssetEndpoint(assetId: number, iTwinId?: GuidString): Promise<CesiumAssetEndpoint>;
}
