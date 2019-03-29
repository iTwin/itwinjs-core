/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";
import { LoggerCategory } from "./LoggerCategory";

/** Wrapper around a promise that allows synchronous queries of it's state
 * @internal
 */
export class QueryablePromise<T> {
  public result?: T;
  public error?: any;

  public get isPending(): boolean { return !this.isFulfilled && !this.isRejected; }
  public get isFulfilled(): boolean { return !!this.result; }
  public get isRejected(): boolean { return !!this.error; }
  public constructor(public readonly promise: Promise<T>) {
    this.promise
      .then((res: T) => this.result = res)
      .catch((err: any) => this.error = err);
  }
}

export type MemoizeFnType<T> = (...args: any[]) => Promise<T>;
export type GenerateKeyFnType = (...args: any[]) => string;

/** Utility to cache and retrieve results of long running asynchronous functions.
 * The cache is keyed on the input arguments passed to these functions
 * @internal
 */
export class PromiseMemoizer<T> {
  private readonly _cachedPromises: Map<string, QueryablePromise<T>> = new Map<string, QueryablePromise<T>>();
  private readonly _memoizeFn: MemoizeFnType<T>;
  private readonly _generateKeyFn: GenerateKeyFnType;
  private readonly _maxCacheSize: number;

  /**
   * Constructor
   * @param memoizeFn Function to memoize
   * @param generateKeyFn Function to generate the key for the memoized function
   * @param maxCacheSize Maximum size of the memoizer cache.
   * If the maximum cache size is exceeded, fulfilled/rejected entries are first discarded - these
   * may have been unclaimed/orphaned promises. If the cache size is still above the maxCacheSize
   * threshold, the entire cache is then cleared.
   */
  public constructor(memoizeFn: MemoizeFnType<T>, generateKeyFn: GenerateKeyFnType, maxCacheSize: number = 500) {
    this._memoizeFn = memoizeFn;
    this._generateKeyFn = generateKeyFn;
    this._maxCacheSize = maxCacheSize;
  }

  /** Call the memoized function */
  public memoize = (...args: any[]): QueryablePromise<T> => {
    const key: string = this._generateKeyFn(...args);
    let qp: QueryablePromise<T> | undefined = this._cachedPromises.get(key);
    if (qp)
      return qp;

    if (this._cachedPromises.size >= this._maxCacheSize) {
      this._purgeResolvedEntries();
      if (this._cachedPromises.size >= this._maxCacheSize) {
        Logger.logError(LoggerCategory.PromiseMemoizer, "Cleared too many unresolved entries in memoizer cache");
        this.clearCache();
      }
    }

    const p = this._memoizeFn(...args);
    qp = new QueryablePromise<T>(p);
    this._cachedPromises.set(key, qp);
    return qp;
  }

  /** Delete the memoized function */
  public deleteMemoized = (...args: any[]) => {
    const key: string = this._generateKeyFn(...args);
    this._cachedPromises.delete(key);
  }

  /** Purge any entries that have been resolved - this is especially useful when there are orphaned
   * responses that were never retrieved by the frontend, and therefore never deleted.
   */
  private _purgeResolvedEntries = () => {
    for (const key of Array.from(this._cachedPromises.keys())) {
      const qp = this._cachedPromises.get(key)!;
      if (qp.isFulfilled || qp.isRejected)
        this._cachedPromises.delete(key);
    }
  }

  /** Clear all entries in the memoizer cache */
  public clearCache = () => {
    this._cachedPromises.clear();
  }
}
