/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * @internal Used for testing only.
 */
export class ResolvablePromise<T> implements Promise<T> {
  private _wrapped: Promise<T>;
  private _resolve!: (value: T) => void;
  private _reject!: (msg?: string) => void;
  private _wasHandled: boolean;
  public [Symbol.toStringTag] = "ResolvablePromise";
  public constructor() {
    this._wrapped = new Promise<T>((resolve: (value: T) => void, reject: (reason?: any) => void) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    this._wasHandled = false;
  }
  public [Symbol.dispose]() {
    if (!this._wasHandled) {
      this._reject("Rejecting unhandled ResolvablePromise");
    }
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
    if (this._wasHandled) {
      return;
    }
    this._wasHandled = true;
    this._resolve(result);
    await new Promise<void>((resolve: () => void) => {
      setImmediate(resolve);
    });
  }
  public async reject(msg?: string) {
    if (this._wasHandled) {
      return;
    }
    this._wasHandled = true;
    this._reject(msg);
    await new Promise<void>((resolve: () => void) => {
      setImmediate(resolve);
    });
  }
}
