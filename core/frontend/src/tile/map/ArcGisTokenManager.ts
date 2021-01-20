/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ArcGisGenerateTokenOptions, ArcGisToken, ArcGisTokenGenerator } from "../../imodeljs-frontend";

/** @internal */
export class ArcGisTokenManager {
  private static readonly tokenExpiryThreshold = 300000  // 5 minutes in milliseconds
  private static _cache = new Map<string, ArcGisToken>();
  private static _generator: ArcGisTokenGenerator | undefined;

  public static async getToken(esriRestServiceUrl: string, options: ArcGisGenerateTokenOptions, saveSessionStorage: boolean = true): Promise<ArcGisToken | undefined> {
    if (!ArcGisTokenManager._generator)
      ArcGisTokenManager._generator = new ArcGisTokenGenerator();

    const tokenCacheKey = `${encodeURIComponent(options.userName)}@${esriRestServiceUrl}`;

    // First check in the session cache
    let cachedToken = ArcGisTokenManager._cache.get(tokenCacheKey);

    // Check in local storage if nothing found in session cache
    if (cachedToken === undefined) {
      const tokenFromStorageStr = sessionStorage.getItem(`arcgis:${tokenCacheKey}`)
      if (tokenFromStorageStr !== null) {
        cachedToken = JSON.parse(tokenFromStorageStr);
      }
    }

    // Check if token is in cached and is valid within the threshold, if not, generate a new token immediately.
    if (cachedToken !== undefined && (cachedToken.expires - (+new Date) > ArcGisTokenManager.tokenExpiryThreshold)) {
      return cachedToken;
    }

    // Nothing in cache, generate a new token
    const newToken = await ArcGisTokenManager._generator.generate(esriRestServiceUrl, options);
    if (newToken !== undefined) {
      ArcGisTokenManager._cache.set(tokenCacheKey, newToken);

      // Also store in the local storage.
      if (saveSessionStorage) {
        sessionStorage.setItem(`arcgis:${tokenCacheKey}`, JSON.stringify(newToken))
      }

    }

    return newToken;
  }
}
