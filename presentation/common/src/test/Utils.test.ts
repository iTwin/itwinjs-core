/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AsyncCollectable, getInstancesCount, KeySet } from "../presentation-common";
import { createRandomBaseNodeKey, createRandomECInstanceKey, createRandomECInstancesNodeKey, createRandomGroupingNodeKey } from "./_helpers/random";

describe("getInstancesCount", () => {
  it("calculates correct count with instance keys, instance node keys and grouping node keys", () => {
    const keys = new KeySet([
      createRandomECInstanceKey(), // 1
      createRandomECInstancesNodeKey([createRandomECInstanceKey(), createRandomECInstanceKey()]), // 2
      createRandomGroupingNodeKey(5), // 5
      createRandomBaseNodeKey(),
    ]);
    expect(getInstancesCount(keys)).to.eq(8);
  });
});

describe("AsyncCollectable", () => {
  async function* testGenerator() {
    yield 1;
    yield 2;
    yield 3;
  }

  it("collects items to an array", async () => {
    const collectable = new AsyncCollectable(testGenerator());
    await expect(collectable.collect()).to.eventually.deep.eq([1, 2, 3]);
  });

  it("provides values on next", async () => {
    const collectable = new AsyncCollectable(testGenerator());
    expect((await collectable.next()).value).to.eq(1);
    expect((await collectable.next()).value).to.eq(2);
    expect((await collectable.next()).value).to.eq(3);
  });
});
