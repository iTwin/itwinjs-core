/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;

import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { OneAtATimeAction, AbandonedError } from "../OneAtATimeAction";

describe("OneAtATime test", () => {
  const pause = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it("OneAtATime", async () => {
    let calls = 0;
    const operation = new OneAtATimeAction<number>(async (a: number, b: string) => {
      assert.equal(a, 200);
      assert.equal(b, "hello");
      await pause(100); return ++calls;
    });

    expect(operation.request(200, "hello")).to.be.eventually.fulfilled; // is started immediately
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError); // becomes pending, doesn't abort previous because its already started
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError); // aborts previous, becomes pending
    let count = await operation.request(200, "hello"); // aborts previous, becomes pending, eventually is run
    assert.equal(count, 2); // only the first and last complete

    // then, just try the whole thing again
    expect(operation.request(200, "hello")).to.be.eventually.fulfilled; // is started immediately
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError); // aborts previous, becomes pending
    expect(operation.request(200, "hello")).to.be.rejectedWith(AbandonedError); // becomes pending, doesn't abort previous because its already started
    count = await operation.request(200, "hello"); // aborts previous, becomes pending, eventually is run
    assert.equal(count, 4); // only the first and last complete, again
  });
});
