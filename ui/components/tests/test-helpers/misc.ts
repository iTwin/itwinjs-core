/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { wait } from "react-testing-library";

let mochaTimeoutsEnabled = true;
beforeEach(function () {
  mochaTimeoutsEnabled = this.enableTimeouts();
});

export const waitForSpy = async (component: { update: () => void }, spy: sinon.SinonSpy): Promise<any> => {
  const timeout = 1000;
  const waitTime = 10;
  let totalWaitTime = 0;
  while (!spy.called && totalWaitTime <= timeout) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    totalWaitTime += waitTime;
  }
  expect(spy.called, "spy").to.be.true;
  component.update();
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
