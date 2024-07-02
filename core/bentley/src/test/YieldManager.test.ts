/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { YieldManager } from "../YieldManager";

describe("YieldManager", () => {
  it("allowYield yields once per 'iterationsBeforeYield' iterations", async () => {
    class CountingYieldManager extends YieldManager {
      public actualYieldCount = 0;
    }

    const expectedYieldTimes = 5;
    const yieldManager = new CountingYieldManager();

    (yieldManager as any).actualYield = async () => {
      yieldManager.actualYieldCount++;
    };
    for (let i = 0; i < expectedYieldTimes * yieldManager.options.iterationsBeforeYield; ++i) {

      await yieldManager.allowYield();
    }

    expect(yieldManager.actualYieldCount).to.equal(expectedYieldTimes);
  });
});
