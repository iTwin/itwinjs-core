/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { AbandonedError, OneAtATimeAction } from "../OneAtATimeAction";
import { BeDuration } from "../Time";

/* eslint-disable @typescript-eslint/no-floating-promises */

const assert = chai.assert;
const expect = chai.expect;

chai.use(chaiAsPromised);
describe("OneAtATime test", () => {

  it("OneAtATime", async () => {
    let calls = 0;
    const operation = new OneAtATimeAction(async (a: number, b: string) => {
      if (a === 10)
        throw new Error("cancelled");

      assert.equal(a, 200);
      assert.equal(b, "hello");
      await BeDuration.wait(100);
      return ++calls;
    }, "testAbandon");

    expect(operation.request(200, "hello")).to.be.eventually.fulfilled; // is started immediately
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError); // becomes pending, doesn't abort previous because its already started
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError); // aborts previous, becomes pending
    let count = await operation.request(200, "hello"); // aborts previous, becomes pending, eventually is run
    assert.equal(count, 2); // only the first and last complete

    // then, just try the whole thing again
    expect(operation.request(10, "hello")).to.be.rejectedWith(AbandonedError, "cancelled"); // try calling a function that throws
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError, "testAbandon"); // becomes pending, doesn't abort previous because its already started
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError, "testAbandon"); // aborts previous, becomes pending
    count = await operation.request(200, "hello");
    assert.equal(count, 3);
  });
});
