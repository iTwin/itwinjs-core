/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { act, wait } from "@testing-library/react";

let mochaTimeoutsEnabled: Mocha.Context;
beforeEach(function () {
  mochaTimeoutsEnabled = this.timeout(0);
});

/** Options for waitForSpy test helper function */
export interface WaitForSpyOptions {
  timeout?: number;
  error?: string;
}

/** Wait for spy to be called. Throws on timeout (250 by default) */
export const waitForSpy = async (spy: sinon.SinonSpy, options?: WaitForSpyOptions) => {
  const defaultValues: WaitForSpyOptions = { timeout: 250, error: "Waiting for spy timed out!" };
  const { timeout, error } = options ? { ...defaultValues, ...options } : defaultValues;

  return wait(() => {
    if (!spy.called)
      throw new Error(error);
  }, { timeout, interval: 10 });
};

/**
 * Waits for `spy` to be called `count` number of times during and after the `action`
 */
export const waitForUpdate = async (action: () => any, spy: sinon.SinonSpy, count: number = 1) => {
  const stack = (new Error()).stack;
  const timeout = mochaTimeoutsEnabled ? undefined : Number.MAX_VALUE;
  const callCountBefore = spy.callCount;
  act(() => { action(); });
  await wait(() => {
    if (spy.callCount - callCountBefore !== count) {
      const err = new Error(`Calls count doesn't match. Expected ${count}, got ${spy.callCount - callCountBefore} (${spy.callCount} in total)`);
      err.stack = stack;
      throw err;
    }
  }, { timeout, interval: 1 });
};

/** Creates Promise */
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
  public async resolve(result: T) {
    this._resolve(result);
    await new Promise<void>((resolve: () => void) => {
      setImmediate(resolve);
    });
  }
}
