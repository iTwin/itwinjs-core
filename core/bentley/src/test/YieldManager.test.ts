/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { YieldManager } from "../YieldManager";

describe("YieldManager", () => {
  it("allowYield yields once per 'iterationsBeforeYield' iterations", async () => {
    class CountingYieldManager extends YieldManager {
      public actualYieldCount = 0;
      protected override async actualYield() { this.actualYieldCount++; }
    }

    const expectedYieldTimes = 5;
    const yieldManager = new CountingYieldManager();
    for (let i = 0; i < expectedYieldTimes * yieldManager.options.iterationsBeforeYield; ++i) {
      await yieldManager.allowYield();
    }
    expect(yieldManager.actualYieldCount).to.equal(expectedYieldTimes);
  });
});
