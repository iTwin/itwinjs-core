/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export type PromiseResolveFunc<T> = (value?: T | PromiseLike<T>) => void;
export type PromiseRejectFunc = (reason?: any) => void;
export class PromiseContainer<T> {
  private _resolve!: PromiseResolveFunc<T>;
  private _reject!: PromiseRejectFunc;
  private _internal: Promise<T>;
  constructor() {
    const self = this;
    this._internal = new Promise<T>((resolve: PromiseResolveFunc<T>, reject: PromiseRejectFunc) => {
      self._resolve = resolve;
      self._reject = reject;
    });
  }
  public get promise(): Promise<T> { return this._internal; }
  public resolve(value?: T | PromiseLike<T>): void {
    this._resolve(value);
  }
  public reject(reason?: any): void {
    this._reject(reason);
  }
}

export class ResolvablePromise<T> implements PromiseLike<T> {
  private _wrapped: Promise<T>;
  private _resolve!: (value: T) => void;
  public constructor() {
    this._wrapped = new Promise<T>((resolve: (value: T) => void) => {
      this._resolve = resolve;
    });
  }
  public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2> {
    return this._wrapped.then(onfulfilled, onrejected);
  }
  public resolve(result: T) { this._resolve(result); }
}
