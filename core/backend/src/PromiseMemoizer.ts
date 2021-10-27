/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { IDisposable, Logger } from "@itwin/core-bentley";
import { BackendLoggerCategory } from "./BackendLoggerCategory";

/** Wrapper around a promise that allows synchronous queries of it's state
 * @internal
 */
export class QueryablePromise<T> {
  public result?: T;
  public error?: any;

  private _fulfilled: boolean = false;
  private _rejected: boolean = false;

  public get isPending(): boolean { return !this.isFulfilled && !this.isRejected; }
  public get isFulfilled(): boolean { return this._fulfilled; }
  public get isRejected(): boolean { return this._rejected; }
  public constructor(public readonly promise: Promise<T>) {
    this.promise
      .then((res: T) => { this.result = res; this._fulfilled = true; })
      .catch((err: any) => { this.error = err; this._rejected = true; });
  }
}

/** @internal */
export type MemoizeFnType<T> = (...args: any[]) => Promise<T>;
/** @internal */
export type GenerateKeyFnType = (...args: any[]) => string;

/** Utility to cache and retrieve results of long running asynchronous functions.
 * The cache is keyed on the input arguments passed to these functions
 * @internal
 */
export class PromiseMemoizer<T> implements IDisposable {
  private readonly _cachedPromises: Map<string, QueryablePromise<T>> = new Map<string, QueryablePromise<T>>();
  private readonly _timers: Map<string, NodeJS.Timer> = new Map<string, NodeJS.Timer>();
  private readonly _memoizeFn: MemoizeFnType<T>;
  private readonly _generateKeyFn: GenerateKeyFnType;
  private readonly _maxCacheSize: number;
  private readonly _cacheTimeout: number;

  /**
   * Constructor
   * @param memoizeFn Function to memoize
   * @param generateKeyFn Function to generate the key for the memoized function
   * @param maxCacheSize Maximum size of the memoizer cache.
   * If the maximum cache size is exceeded, fulfilled/rejected entries are first discarded - these
   * may have been unclaimed/orphaned promises. If the cache size is still above the maxCacheSize
   * threshold, the entire cache is then cleared.
   */
  public constructor(memoizeFn: MemoizeFnType<T>, generateKeyFn: GenerateKeyFnType, maxCacheSize: number = 500, cacheTimeout: number = 30000) {
    this._memoizeFn = memoizeFn;
    this._generateKeyFn = generateKeyFn;
    this._maxCacheSize = maxCacheSize;
    this._cacheTimeout = cacheTimeout;
  }

  /** Call the memoized function */
  public memoize = (...args: any[]): QueryablePromise<T> => {
    const key: string = this._generateKeyFn(...args);
    let qp: QueryablePromise<T> | undefined = this._cachedPromises.get(key);
    if (qp)
      return qp;

    if (this._cachedPromises.size >= this._maxCacheSize) {
      if (this._maxCacheSize > 1)
        Logger.logError(BackendLoggerCategory.PromiseMemoizer, "Cleared too many unresolved entries in memoizer cache");
      this.clearCache();
    }

    const removeCachedPromise = (v: T) => {
      const cleanUp = () => {
        this._cachedPromises.delete(key);
        this._timers.delete(key);
      };
      this._timers.set(key, setTimeout(cleanUp, this._cacheTimeout));
      return v;
    };

    const p = this._memoizeFn(...args).then(removeCachedPromise, (e) => { throw removeCachedPromise(e); });
    qp = new QueryablePromise<T>(p);
    this._cachedPromises.set(key, qp);
    return qp;
  };

  /** Delete the memoized function */
  public deleteMemoized = (...args: any[]) => {
    const key: string = this._generateKeyFn(...args);
    this._cachedPromises.delete(key);
  };

  /** Clear all entries in the memoizer cache */
  public clearCache = () => {
    this._cachedPromises.clear();
  };

  public dispose = () => {
    for (const timer of this._timers.values())
      clearTimeout(timer);
    this._timers.clear();
    this.clearCache();
  };
}
