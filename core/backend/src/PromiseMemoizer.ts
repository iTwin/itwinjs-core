/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";

/** Wrapper around a promise that allows synchronous queries of it's state
 * @hidden
 */
export class QueryablePromise<T> {
  public result?: T;
  public error?: any;

  public get isPending(): boolean { return !this.isFulfilled && !this.isRejected; }
  public get isFulfilled(): boolean { return !!this.result; }
  public get isRejected(): boolean { return !!this.error; }
  public constructor(private readonly _promise: Promise<T>) {
    this._promise
      .then((res: T) => this.result = res)
      .catch((err: any) => this.error = err);
  }
}

/** Utility to cache and retrieve results of long running asynchronous functions.
 * The cache is keyed on the input arguments passed to these functions
 * @hidden
 */
export class PromiseMemoizer<T> {
  private _cachedPromises: Map<string, QueryablePromise<T>> = new Map<string, QueryablePromise<T>>();

  public constructor(private readonly _memoizeFn: (...args: any[]) => Promise<T>, private readonly _generateKeyFn: (...args: any[]) => string) { }

  public memoize = (...args: any[]): QueryablePromise<T> => {
    const key: string = this._generateKeyFn(...args);
    let qp: QueryablePromise<T> | undefined = this._cachedPromises.get(key);
    if (!qp) {
      const p = this._memoizeFn(...args);
      qp = new QueryablePromise<T>(p);
      this._cachedPromises.set(key, qp);
    }
    return qp;
  }

  public deleteMemoized = (...args: any[]) => {
    const key: string = this._generateKeyFn(...args);
    const ret = this._cachedPromises.delete(key);
    assert(ret, "Memoized function not found in cache");
  }
}
