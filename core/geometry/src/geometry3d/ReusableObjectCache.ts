/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GrowableXYZArray } from "./GrowableXYZArray";

/** @packageDocumentation
 * @module ArraysAndInterfaces
 */
/**
 * abstract class managing an array of objects of type T, available for reuse by trusted callers.
 * * Derived class must implement these methods:
 *   * `createForCache()` -- create a new, ready-to-use object
 *   * `clearForCache (data: T)` -- tidy up `data` so it can be reused.
 * @internal
 */
export abstract class ReusableObjectCache<T> {
  protected abstract clearForCache(data: T): void;
  protected abstract createForCache(): T;
  private _cachedObjects: T[];
  public numDrop: number;
  public numCreate: number;
  public numReuse: number;
  /**
   * create a new cache for objects of type T
   */
  protected constructor() {
    this._cachedObjects = [];
    this.numDrop = 0;
    this.numCreate = 0;
    this.numReuse = 0;
  }
  /** Present `data` for storage in the cache, and hence reuse by any subsequent `grabFromCache`
   *   * `data` will be sent to `clearForCache`.
   *   * caller should never refer to this instance again.
   */
  public dropToCache(data: T | undefined) {
    if (data) {
      this.numDrop++;
      this.clearForCache(data);
      this._cachedObjects.push(data);
    }
  }
  /**
   * grab an object from the cache.
   *  * The returned object becomes property of the caller.
   *  * That is, the cache does not remember it for any further management
   * @param data
   */
  public grabFromCache(): T {
    let data = this._cachedObjects.pop();
    if (data === undefined) {
      data = this.createForCache();
      this.numCreate++;
    } else {
      this.numReuse++;
    }
    return data;
  }
  /** Drop all entries of data[] to the cache.
   * @param data on input, the data to drop. on output, data is an empty array.
   */
  public dropAllToCache(data: T[]) {
    while (data.length > 0) {
      this.dropToCache(data.pop());
    }
  }
}
/**
 * Cache of GrowableXYZArray.
 * Intended for use by (for instance) clipping methods that can be structured to have disciplined reuse of a small number of arrays for a large number of steps.
 * @internal
 */
export class GrowableXYZArrayCache extends ReusableObjectCache<GrowableXYZArray> {
  protected clearForCache(data: GrowableXYZArray): void { data.length = 0; }
  protected createForCache(): GrowableXYZArray { return new GrowableXYZArray(10); }
  public constructor() { super(); }
  /**
   * Grab an array from the cache and immediately fill from a source
   * @param source
   */
  public grabAndFill(source: GrowableXYZArray): GrowableXYZArray {
    const dest = this.grabFromCache();
    dest.pushFromGrowableXYZArray(source);
    return dest;

  }
}
