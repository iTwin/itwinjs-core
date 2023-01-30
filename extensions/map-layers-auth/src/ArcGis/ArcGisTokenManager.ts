/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { MapLayerAccessToken } from "@itwin/core-frontend";
import { ArcGisGenerateTokenOptions, ArcGisOAuth2Token, ArcGisToken, ArcGisTokenGenerator } from "./ArcGisTokenGenerator";

/** @internal */
interface ArcGisTokenProps {
  [hostname: string]: ArcGisOAuth2Token;
}

/** @internal */
export class ArcGisTokenManager {
  private static readonly tokenExpiryThreshold = 300000;  // 5 minutes in milliseconds
  private static _cache = new Map<string, ArcGisToken>();
  private static _oauth2Cache: Map<string, ArcGisOAuth2Token> | undefined;
  private static _generator: ArcGisTokenGenerator | undefined;
  private static readonly _browserStorageKey = "arcGisOAuth";

  public static async getToken(arcGisRestServiceUrl: string, userName: string, password: string, options: ArcGisGenerateTokenOptions): Promise<ArcGisToken | undefined> {
    if (!ArcGisTokenManager._generator)
      ArcGisTokenManager._generator = new ArcGisTokenGenerator();

    const tokenCacheKey = `${encodeURIComponent(userName)}@${arcGisRestServiceUrl}`;

    // First check in the session cache
    const cachedToken = ArcGisTokenManager._cache.get(tokenCacheKey);

    // Check if token is in cached and is valid within the threshold, if not, generate a new token immediately.
    if (cachedToken !== undefined && (cachedToken.expires - (+new Date()) > ArcGisTokenManager.tokenExpiryThreshold)) {
      return cachedToken;
    }

    // Nothing in cache, generate a new token
    const newToken = await ArcGisTokenManager._generator.generate(arcGisRestServiceUrl, userName, password, options);
    if (newToken.token) {
      const token = newToken as ArcGisToken;
      ArcGisTokenManager._cache.set(tokenCacheKey, token);
      return token;
    }

    return undefined;
  }

  public static invalidateToken(token: MapLayerAccessToken): boolean {

    for (const [key, value] of ArcGisTokenManager._cache) {
      if (value.token === token.token)
        return ArcGisTokenManager._cache.delete(key);
    }

    return false;
  }

  public static getOAuth2Token(key: string): ArcGisOAuth2Token | undefined {
    if (ArcGisTokenManager._oauth2Cache === undefined) {
      ArcGisTokenManager._oauth2Cache = new Map<string, ArcGisOAuth2Token>();
      ArcGisTokenManager.loadFromBrowserStorage();
    }

    const cachedToken = ArcGisTokenManager._oauth2Cache.get(key);

    // If cached token has expired (or about to expire), invalidate don't return it.
    if (cachedToken !== undefined && (cachedToken.expiresAt - (+new Date()) < ArcGisTokenManager.tokenExpiryThreshold)) {
      ArcGisTokenManager._oauth2Cache.delete(key);
      return undefined;
    }

    return cachedToken;
  }

  public static invalidateOAuth2Token(token: MapLayerAccessToken) {

    if (ArcGisTokenManager._oauth2Cache) {
      for (const [key, value] of ArcGisTokenManager._oauth2Cache) {
        if (value.token === token.token){
          const deleted = ArcGisTokenManager._oauth2Cache.delete(key);
          ArcGisTokenManager.saveToBrowserStorage();
          return deleted;
        }
      }
    }

    return false;
  }

  public static setOAuth2Token(key: string, token: ArcGisOAuth2Token) {

    if (ArcGisTokenManager._oauth2Cache === undefined) {
      ArcGisTokenManager._oauth2Cache = new Map<string, ArcGisOAuth2Token>();

    }
    ArcGisTokenManager._oauth2Cache.set(key, token);

    ArcGisTokenManager.saveToBrowserStorage();
  }

  public static loadFromBrowserStorage() {
    if (ArcGisTokenManager._oauth2Cache === undefined) {
      return;
    }

    const loadEntries = (json: string | undefined) => {
      if (json && ArcGisTokenManager._oauth2Cache !== undefined) {
        const tokens: ArcGisTokenProps | undefined = JSON.parse(json);
        if (tokens) {
          for (const [key, value] of Object.entries(tokens)) {
            ArcGisTokenManager._oauth2Cache.set(key, value);
          }
        }
      }
    };

    loadEntries(window.sessionStorage.getItem(this._browserStorageKey) ?? undefined);
    loadEntries(window.localStorage.getItem(this._browserStorageKey) ?? undefined);
  }

  public static saveToBrowserStorage() {

    if (ArcGisTokenManager._oauth2Cache === undefined) {
      return;
    }
    const sessionTokens: ArcGisTokenProps = {};
    const storageTokens: ArcGisTokenProps = {};

    ArcGisTokenManager._oauth2Cache.forEach((value: ArcGisOAuth2Token, key: string) => {
      // ignore the persist flag for now, and only save to session storage
      // if (value.persist === true) {
      //   storageTokens[key] = value;
      // } else {
      //   sessionTokens[key] = value;
      // }
      sessionTokens[key] = value;
    });
    window.sessionStorage.setItem(this._browserStorageKey, JSON.stringify(sessionTokens));
    window.localStorage.setItem(this._browserStorageKey, JSON.stringify(storageTokens));
  }

}
