/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ArcGisGenerateTokenOptions, ArcGisOAuth2Token, ArcGisToken, ArcGisTokenGenerator } from "../../imodeljs-frontend";

interface ArcGisTokenProps {
  [hostname: string]: ArcGisOAuth2Token;
}
/** @internal */
export class ArcGisTokenManager {
  private static readonly tokenExpiryThreshold = 300000;  // 5 minutes in milliseconds
  private static _cache = new Map<string, ArcGisToken>();
  private static _oauth2Cache: Map<string, ArcGisOAuth2Token>|undefined;
  private static _generator: ArcGisTokenGenerator | undefined;
  private static readonly _browserStorageKey = "esriOAuth";

  public static async getToken(esriRestServiceUrl: string, userName: string, password: string, options: ArcGisGenerateTokenOptions): Promise<any> {
    if (!ArcGisTokenManager._generator)
      ArcGisTokenManager._generator = new ArcGisTokenGenerator();

    const tokenCacheKey = `${encodeURIComponent(userName)}@${esriRestServiceUrl}`;

    // First check in the session cache
    const cachedToken = ArcGisTokenManager._cache.get(tokenCacheKey);

    // Check if token is in cached and is valid within the threshold, if not, generate a new token immediately.
    if (cachedToken !== undefined && (cachedToken.expires - (+new Date()) > ArcGisTokenManager.tokenExpiryThreshold)) {
      return cachedToken;
    }

    // Nothing in cache, generate a new token
    const newToken = await ArcGisTokenManager._generator.generate(esriRestServiceUrl, userName, password, options);
    if (newToken.token) {
      ArcGisTokenManager._cache.set(tokenCacheKey, newToken as ArcGisToken);
    }

    return newToken;
  }

  public static invalidateToken(esriRestServiceUrl: string, userName: string): boolean {
    const tokenCacheKey = `${userName}@${esriRestServiceUrl}`;
    return ArcGisTokenManager._cache.delete(tokenCacheKey);
  }

  public static getOAuth2Token(key: string): ArcGisToken|undefined {
    if (ArcGisTokenManager._oauth2Cache === undefined) {
      ArcGisTokenManager._oauth2Cache = new Map<string, ArcGisOAuth2Token>();
      ArcGisTokenManager.loadFromBrowserStorage();
    }
    return ArcGisTokenManager._oauth2Cache.get(key);
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

    const loadEntries = (json: string|undefined) => {
      if (json && ArcGisTokenManager._oauth2Cache !== undefined) {
        const tokens: ArcGisTokenProps|undefined = JSON.parse(json);
        if (tokens) {
          for (const [key, value] of Object.entries(tokens)) {
            ArcGisTokenManager._oauth2Cache.set(key, value);
          }
        }
      }
    };

    loadEntries(window.sessionStorage.getItem(this._browserStorageKey)??undefined);
    loadEntries(window.localStorage.getItem(this._browserStorageKey)??undefined);
  }

  public static saveToBrowserStorage() {

    if (ArcGisTokenManager._oauth2Cache === undefined) {
      return;
    }
    const sessionTokens: ArcGisTokenProps = {};
    const storageTokens: ArcGisTokenProps = {};

    ArcGisTokenManager._oauth2Cache.forEach((value: ArcGisOAuth2Token, key: string) => {
      if (value.persist === true) {
        storageTokens[key] = value;
      } else {
        sessionTokens[key] = value;
      }
    });
    window.sessionStorage.setItem(this._browserStorageKey, JSON.stringify(sessionTokens));
    window.localStorage.setItem(this._browserStorageKey, JSON.stringify(storageTokens));
  }

}
