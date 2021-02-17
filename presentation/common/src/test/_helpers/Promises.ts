/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export type PromiseResolveFunc<T> = (value: T | PromiseLike<T>) => void;
export type PromiseRejectFunc = (reason: any) => void;
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
  public get promise(): Promise<T> { return this._internal; }
  public resolve(value: T | PromiseLike<T>): void {
    this._resolve(value);
  }
  public reject(reason?: any): void {
    this._reject(reason);
  }
}

export class ResolvablePromise<T> implements PromiseLike<T> {
  private _wrapped: Promise<T>;
  private _resolve!: (value: T) => void;
  private _reject!: (msg?: string) => void;
  public constructor() {
    this._wrapped = new Promise<T>((resolve: (value: T) => void, reject: (reason?: any) => void) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2> {
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
