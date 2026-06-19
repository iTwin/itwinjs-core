/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { GuidString } from "@itwin/core-bentley";

/** Describes the endpoint for accessing a Cesium Ion asset.
 * @see [[CesiumAccessClient.getAssetEndpoint]]
 * @beta
 */
export interface CesiumAssetEndpoint {
  /** The access token to use for authenticated requests to [[url]]. */
  accessToken: string;
  /** The endpoint URL for the asset, used together with [[accessToken]] to fetch its tiles.
   * The exact shape depends on the asset type:
   * - For terrain assets, this is the base URL to which callers append resource paths (e.g. `layer.json`);
   *   a trailing `/` is added automatically if not already present.
   * - For 3D Tiles assets, this is the URL of the tileset's root document (e.g. `tileset.json`), requested
   *   directly, with child resources resolved relative to it.
   */
  url: string;
  /** The time at which [[accessToken]] expires, if known.
   * Used by callers to schedule proactive token refresh before expiry.
   */
  expiresAt?: Date;
}

/** Provides access tokens and endpoint URLs for [Cesium Ion](https://cesium.com/platform/cesium-ion/) assets.
 * Supply an implementation via [[TileAdmin.Props.cesiumAccess]] to control how Cesium assets are resolved.
 *
 * Two authentication paths:
 * - **Direct Cesium Ion**: set [[TileAdmin.Props.cesiumIonKey]] — uses a built-in client that
 *   authenticates directly with Cesium Ion. Suitable for apps with their own Cesium Ion subscription.
 * - **Custom / iTwin Platform proxy**: supply a `CesiumAccessClient` implementation — for example, one that
 *   calls the [iTwin Platform Cesium Curated Content API](https://developer.bentley.com/apis/cesium-curated-content/overview/)
 *   using an iTwin access token.
 *
 * If both `cesiumIonKey` and `cesiumAccess` are supplied, `cesiumAccess` takes precedence. Note that this
 * precedence applies when resolving an asset by id; reality models persisted with a legacy key-bearing URL
 * (e.g. `$CesiumIonAsset=<id>:<key>`) continue to authenticate directly with the embedded key and are not
 * routed through a registered `cesiumAccess` client.
 * @see [[TileAdmin.Props.cesiumAccess]]
 * @see [[TileAdmin.Props.cesiumIonKey]]
 * @beta
 */
export interface CesiumAccessClient {
  /** Obtain an endpoint URL and access token for the specified Cesium Ion asset.
   * @param assetId The Cesium Ion asset identifier (e.g. `"1"` for Cesium World Terrain).
   * @param iTwinId Optional iTwin context identifier. May be used by implementations to scope requests
   * to a specific iTwin context, but is not required by the iTwin Platform Cesium Curated Content API.
   * @returns The resolved endpoint, or `undefined` if the asset cannot be accessed.
   */
  getAssetEndpoint(assetId: string, iTwinId?: GuidString): Promise<CesiumAssetEndpoint | undefined>;
}
