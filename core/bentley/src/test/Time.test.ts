/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BeDuration } from "../Time";

describe("BeDuration", () => {

  class Test {
    private _a = 33;
    public doTest(arg1: number, arg2: string) {
      assert.equal(arg1, 5);
      assert.equal(arg2, "test123");
      return this._a;
    }
  }

  it("executeAfter", async () => {
    const start = Date.now();
    const halfSecond = BeDuration.fromSeconds(.5);
    const t = new Test();
    const val = await halfSecond.executeAfter(t.doTest, t, 5, "test123"); // eslint-disable-line @typescript-eslint/unbound-method
    assert.equal(val, 33);
    assert.isAtLeast(Date.now(), start + 400); // use 400ms to avoid false failures if precision of timing is reduced
  });

});
