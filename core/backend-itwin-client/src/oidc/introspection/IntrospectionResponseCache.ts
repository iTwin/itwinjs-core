/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Introspection
 */

import { IntrospectionResponse } from "./IntrospectionResponse";

/**
 * @alpha
 * The class UserTokenCache is a simple dictionary of tokens that are currently in use. The entries
 * will removed automatically if their tokens expire.
 */
export abstract class IntrospectionResponseCache {
  /**
   * Adds the given token to the cache. The token will removed automatically from the cache if
   * it's about to expire.
   * @param key       Key of the token entry.
   * @param token     UserToken that is associated with the key.
   */
  public async add(key: string, response: IntrospectionResponse): Promise<void> {
    if (!response.exp) // do not cache any response without a known expiration time
      return;

    const currentTimeInSeconds = new Date().getTime() / 1000; // UTC time in seconds since 1970-01-01
    const secondsUntilExpiration = response.exp - currentTimeInSeconds;
    if (secondsUntilExpiration > 0) {
      setTimeout(async () => this.remove(key), secondsUntilExpiration * 1000);
      await this.storeResponse(key, response);
    }
  }

  protected abstract storeResponse(key: string, response: IntrospectionResponse): Promise<void>;

  /**
   * Gets the User token for the given key.
   * @param key       Key of the token entry.
   * @returns         The Token if it can be found or undefined if not.
   */
  public async get(key: string): Promise<IntrospectionResponse | undefined> {
    return this.getResponse(key);
  }

  protected abstract getResponse(key: string): Promise<IntrospectionResponse | undefined>;

  /**
   * Removes the token with the given key from the cache.
   * @param key       Key of the token entry.
   */
  private async remove(key: string): Promise<void> {
    await this.deleteResponse(key);
  }

  protected abstract deleteResponse(key: string): Promise<void>;
}

/** @alpha */
export class MemoryIntrospectionResponseCache extends IntrospectionResponseCache {
  private readonly _cache: { [key: string]: IntrospectionResponse } = {};

  protected async storeResponse(key: string, response: IntrospectionResponse): Promise<void> {
    this._cache[key] = response;
  }

  protected async getResponse(key: string): Promise<IntrospectionResponse | undefined> {
    return this._cache[key];
  }

  protected async deleteResponse(key: string): Promise<void> {
    delete this._cache[key];
  }
}
