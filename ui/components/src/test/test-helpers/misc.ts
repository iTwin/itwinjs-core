/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { wait } from "react-testing-library";

let mochaTimeoutsEnabled = true;
beforeEach(function () {
  mochaTimeoutsEnabled = this.enableTimeouts();
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
  const timeout = mochaTimeoutsEnabled ? undefined : Number.MAX_VALUE;
  const callCountBefore = spy.callCount;
  action();
  await wait(() => {
    if (spy.callCount - callCountBefore !== count)
      throw new Error(`Calls count doesn't match. Expected ${count}, got ${spy.callCount - callCountBefore} (${spy.callCount} in total)`);
  }, { timeout, interval: 1 });
};
