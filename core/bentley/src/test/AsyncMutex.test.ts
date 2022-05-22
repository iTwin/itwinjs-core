/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AsyncMutex } from "../AsyncMutex";
import { BeDuration } from "../Time";

describe("AsyncMutex", () => {
  before(async () => {
  });

  const mutex = new AsyncMutex();
  let currValue = 0;

  const addOneWithoutMutex = async (): Promise<void> => {
    await BeDuration.wait(1000); // postpone execution a little
    currValue += 1;
  };

  const multiplyTwoWithMutex = async (): Promise<void> => {
    const unlock = await mutex.lock();
    currValue *= 2;
    unlock();
  };

  it("should be honored", async () => {
    // Perform test without top level mutex
    const promises = new Array<Promise<void>>();
    let ii = 0;
    currValue = 0;
    while (ii++ < 10) {
      promises.push(multiplyTwoWithMutex());
      promises.push(addOneWithoutMutex());
    }
    await Promise.all(promises);
    assert.equal(currValue, 10); // Multiplies should have been done first

    // Repeat test with top level mutex
    const unlock = await mutex.lock();
    ii = 0;
    currValue = 0;
    while (ii++ < 10) {
      promises.push(multiplyTwoWithMutex());
      promises.push(addOneWithoutMutex());
    }
    promises.push(BeDuration.wait(2000).then(() => unlock())); // Unlock the mutex after 2 seconds
    await Promise.all(promises);
    assert.equal(currValue, 10240); // Adds should have been done first
  });
});
