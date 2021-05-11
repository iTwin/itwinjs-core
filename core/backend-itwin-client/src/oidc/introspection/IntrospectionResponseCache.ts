/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Introspection
 */

import { IntrospectionResponse } from "./IntrospectionResponse";

/** The IntrospectionResponseCache is a simple dictionary of [[IntrospectionResponse]] that are currently in use.
 * The entries will removed automatically if their tokens expire.
 * @alpha
 */
export abstract class IntrospectionResponseCache {
  /** Adds the given response to the cache. The response will be added if it has not yet expired.
   * @param key       A unique string to identify the response within the cache.
   * @param response  A response associated with the key.
   */
  public async add(key: string, response: IntrospectionResponse): Promise<void> {
    if (!response.exp) // do not cache any response without a known expiration time
      return;

    const currentTimeInSeconds = new Date().getTime() / 1000; // UTC time in seconds since 1970-01-01
    const secondsUntilExpiration = response.exp - currentTimeInSeconds;
    if (secondsUntilExpiration > 0)
      await this.storeResponse(key, response);
  }

  protected abstract storeResponse(key: string, response: IntrospectionResponse): Promise<void>;

  /** Gets the [[IntrospectionResponse]] for the given key.
   *
   * Note: Removes the response if it has already expired.
   *
   * @param key Key of the token entry.
   * @returns   If the key exists and has not yet expired, the IntrospectionResponse associated with the provided key.  Otherwise, undefined.
   */
  public async get(key: string): Promise<IntrospectionResponse | undefined> {
    const response = await this.getResponse(key);
    if (undefined === response)
      return undefined;

    const currentTimeInSeconds = new Date().getTime() / 1000; // UTC time in seconds since 1970-01-01
    const secondsUntilExpiration = response.exp! - currentTimeInSeconds;
    if (secondsUntilExpiration <= 0) {
      await this.remove(key);
      return undefined;
    }

    return response;
  }

  protected abstract getResponse(key: string): Promise<IntrospectionResponse | undefined>;

  /**
   * Removes the response associated with the given key from the cache.
   * @param key  Key of the response entry.
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
