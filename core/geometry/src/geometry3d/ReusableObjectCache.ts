/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ArraysAndInterfaces
 */

import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedXYZCollection } from "./IndexedXYZCollection";

/**
 * Abstract class managing an array of objects of type T, available for reuse by trusted callers.
 * * Derived class must implement `createForCache` and `clearForCache`.
 * @public
 */
export abstract class ReusableObjectCache<T> {
  private _cachedObjects: T[];
  private _numDrop: number;
  private _numCreate: number;
  private _numReuse: number;
  /**
   * Create a new cache for objects of type T.
   */
  protected constructor() {
    this._cachedObjects = [];
    this._numDrop = 0;
    this._numCreate = 0;
    this._numReuse = 0;
  }
  /** Create a new, ready-to-use object. */
  protected abstract createForCache(): T;
  /** Tidy up `data` so it can be reused. */
  protected abstract clearForCache(data: T): void;
  /**
   * Present `data` for storage in the cache, and hence reuse by any subsequent [[grabFromCache]].
   * * `data` will be sent to [[clearForCache]].
   * * The caller should never refer to `data` again.
   * @param data object to return to the cache.
   */
  public dropToCache(data: T | undefined) {
    if (data) {
      this._numDrop++;
      this.clearForCache(data);
      this._cachedObjects.push(data);
    }
  }
  /**
   * Grab an object from the cache.
   * * The returned object becomes property of the caller: the cache does not remember it for any further management.
   */
  public grabFromCache(): T {
    let data = this._cachedObjects.pop();
    if (data === undefined) {
      data = this.createForCache();
      this._numCreate++;
    } else {
      this._numReuse++;
    }
    return data;
  }
  /**
   * Drop multiple objects to the cache.
   * @param data on input, the data to drop. On output, data is an empty array.
   */
  public dropAllToCache(data: T[]) {
    while (data.length > 0) {
      this.dropToCache(data.pop());
    }
  }
}
/**
 * Cache of [[GrowableXYZArray]].
 * * Example usage includes clipping methods that can be structured to have disciplined reuse of a small number of arrays for a large number of steps.
 * @public
 */
export class GrowableXYZArrayCache extends ReusableObjectCache<GrowableXYZArray> {
  /**
   * Create a new cache for [[GrowableXYZArray]] objects.
   */
  public constructor() {
    super();
  }
  /**
   * Create a new, ready-to-use [[GrowableXYZArray]].
   * @param numPoints initial capacity in xyz triples (default 10)
   * @param growthFactor reallocation expansion (default 1.5)
  */
  protected createForCache(numPoints: number = 10, growthFactor: number = 1.5): GrowableXYZArray {
    return new GrowableXYZArray(numPoints, growthFactor);
  }
  /** Tidy up `data` so it can be reused. */
  protected clearForCache(data: GrowableXYZArray): void {
    data.length = 0;
  }
  /**
   * Grab an array from the cache and immediately fill from a source.
   * @param source xyz to copy into the returned array.
   */
  public grabAndFill(source: IndexedXYZCollection): GrowableXYZArray {
    const dest = this.grabFromCache();
    dest.pushFrom(source);
    return dest;
  }
}
