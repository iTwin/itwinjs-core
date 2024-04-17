/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/**
 * @internal Used for testing only.
 */
export type PromiseResolveFunc<T> = (value: T | PromiseLike<T>) => void;

/**
 * @internal Used for testing only.
 */
export type PromiseRejectFunc = (reason: any) => void;

/**
 * @internal Used for testing only.
 */
export class PromiseContainer<T> {
  private _resolve!: PromiseResolveFunc<T>;
  private _reject!: PromiseRejectFunc;
  private _internal: Promise<T>;
  constructor() {
    this._internal = new Promise<T>((resolve: PromiseResolveFunc<T>, reject: PromiseRejectFunc) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  public get promise(): Promise<T> {
    return this._internal;
  }
  public resolve(value: T | PromiseLike<T>): void {
    this._resolve(value);
  }
  public reject(reason?: any): void {
    this._reject(reason);
  }
}

/**
 * @internal Used for testing only.
 */
export class ResolvablePromise<T> implements Promise<T> {
  private _wrapped: Promise<T>;
  private _resolve!: (value: T) => void;
  private _reject!: (msg?: string) => void;

  public [Symbol.toStringTag] = "ResolvablePromise";
  public constructor() {
    this._wrapped = new Promise<T>((resolve: (value: T) => void, reject: (reason?: any) => void) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  public async catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<T | TResult> {
    return this._wrapped.catch(onrejected);
  }
  public async finally(onfinally?: (() => void) | null | undefined): Promise<T> {
    return this._wrapped.finally(onfinally);
  }
  public async then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this._wrapped.then(onfulfilled, onrejected);
  }
  public async resolve(result: T) {
    this._resolve(result);
    await new Promise<void>((resolve: () => void) => {
      setImmediate(resolve);
    });
  }
  public async reject(msg?: string) {
    this._reject(msg);
    await new Promise<void>((resolve: () => void) => {
      setImmediate(resolve);
    });
  }
}
