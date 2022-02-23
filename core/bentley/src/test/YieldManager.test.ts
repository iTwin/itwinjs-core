/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { YieldManager } from "../YieldManager";

class PublicYieldManager extends YieldManager {
  public override async actualYield() { return super.actualYield(); }
}

describe("YieldManager", () => {
  it("should yield every X iterations", async () => {
    const expectedYieldTimes = 5;
    const yieldManager = new PublicYieldManager();
    const actualYieldSpy = sinon.spy(yieldManager, "actualYield");
    for (let i = 0; i < expectedYieldTimes * yieldManager.options.iterationsBeforeYield; ++i) {
      await yieldManager.allowYield();
    }
    expect(actualYieldSpy.callCount).to.equal(expectedYieldTimes);
  });
});
