import { assert } from "@bentley/bentleyjs-core";

/** Wrapper around a promise that allows synchronous queries of it's state
 * @hidden
 */
export class QueryablePromise<T> {
  public result?: T;
  public error?: any;

  public isPending(): boolean { return !this.isFulfilled() && !this.isRejected(); }
  public isFulfilled(): boolean { return !!this.result; }
  public isRejected(): boolean { return !!this.error; }
  public constructor(private readonly promise: Promise<T>) {
    this.promise
      .then((res: T) => this.result = res)
      .catch((err: any) => this.error = err);
  }
}

/** Utility to cache and retrieve results of long running asynchronous functions.
 * The cache is keyed on the input arguments passed to these functions
 * @hidden
 */
export class PromiseMemoizer<T> {
  private cachedPromises: Map<string, QueryablePromise<T>> = new Map<string, QueryablePromise<T>>();

  public constructor(private readonly memoizeFn: (...args: any[]) => Promise<T>, private readonly generateKeyFn: (...args: any[]) => string) { }

  public memoize = (...args: any[]): QueryablePromise<T> => {
    const key: string = this.generateKeyFn(...args);
    let qp: QueryablePromise<T> | undefined = this.cachedPromises.get(key);
    if (!qp) {
      const p = this.memoizeFn(...args);
      qp = new QueryablePromise<T>(p);
      this.cachedPromises.set(key, qp);
    }
    return qp;
  }

  public deleteMemoized = (...args: any[]) => {
    const key: string = this.generateKeyFn(...args);
    const ret = this.cachedPromises.delete(key);
    assert(ret, "Memoized function not found in cache");
  }
}
