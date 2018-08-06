/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
