/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BeDuration } from "@bentley/bentleyjs-core";
import { PromiseMemoizer, QueryablePromise } from "../../PromiseMemoizer";

describe("PromiseMemoizer", () => {
  const generateTestFunctionKey = (param: string, waitTime: number): string => {
    return `key ${param}:${waitTime}`;
  };

  const testFunction = async (param: string, waitTime: number): Promise<string> => {
    await BeDuration.wait(waitTime);
    if (param === "TestError")
      throw new Error("TestError");
    return testFunctionResult(param, waitTime);
  };

  const testFunctionResult = (param: string, waitTime: number): string => {
    return `value ${param}:${waitTime}`;
  };

  const maxCacheSize = 25;
  const cacheTimeout = 1500;
  const testMemoizer = new PromiseMemoizer<string>(testFunction, generateTestFunctionKey, maxCacheSize, cacheTimeout);

  afterEach(() => {
    testMemoizer.clearCache();
  });

  it("should be able to await memoized promise", async () => {
    const startTime = Date.now();
    const qp: QueryablePromise<string> = testMemoizer.memoize("test", 500);
    await qp.promise;
    const elapsedTime = Date.now() - startTime;
    assert.isAbove(elapsedTime, 400);
  });

  it("should be able to memoize and deleteMemoized function calls", async () => {
    const qps = new Array<QueryablePromise<string>>(4);
    const expectedResults = new Array<string>(4);

    qps[0] = testMemoizer.memoize("test1", 500);
    expectedResults[0] = testFunctionResult("test1", 500);

    qps[1] = testMemoizer.memoize("test1", 500);
    expectedResults[1] = testFunctionResult("test1", 500);
    assert.strictEqual(qps[1], qps[0], "qps[1] === qps[0] fails");

    qps[2] = testMemoizer.memoize("test2", 500);
    expectedResults[2] = testFunctionResult("test2", 500);
    assert.notStrictEqual(qps[2], qps[0], "qps[2] !== qps[0] fails");

    qps[3] = testMemoizer.memoize("test1", 501);
    expectedResults[3] = testFunctionResult("test1", 501);
    assert.notStrictEqual(qps[3], qps[0], "qps[3] !== qps[0] fails");

    const qpRej = testMemoizer.memoize("TestError", 500);

    for (const qp of qps) {
      assert.isTrue(qp.isPending, "qp.isPending check fails");
    }
    assert.isTrue(qpRej.isPending, "qpRej.isPending check fails");

    await BeDuration.wait(1000);

    for (let ii = 0; ii < 4; ii++) {
      assert.isTrue(qps[ii].isFulfilled, "qp.isFulfilled check fails");
      assert.strictEqual(qps[ii].result, expectedResults[ii]);
    }
    assert.isTrue(qpRej.isRejected);
    assert.strictEqual(qpRej.error.message, "TestError");

    testMemoizer.deleteMemoized("test1", 500);
    const qp0 = testMemoizer.memoize("test1", 500);
    assert.isTrue(qp0.isPending);
  });

  it("should not increase the cache size when repeating the same call", async () => {
    for (let ii = 0; ii < 5; ii++) {
      const qp = testMemoizer.memoize("test", 1000); // same call everytime
      assert.isTrue(qp.isPending); // Ensure the testFn doesn't resolve
    }

    const actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 1);
  });

  it("should increase the cache size as expected", async () => {
    for (let ii = 0; ii < 5; ii++) {
      const qp = testMemoizer.memoize(ii.toString(), 1000); // different call everytime
      assert.isTrue(qp.isPending);
    }
    const actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 5);
  });

  it("should clear the cache if there is an overflow", async () => {
    for (let ii = 0; ii < maxCacheSize; ii++) {
      testMemoizer.memoize(ii.toString(), 1000);
    }
    let actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize);

    testMemoizer.memoize(maxCacheSize.toString(), 1000);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 1);
  });

  it("should clear old promises", async () => {
    testMemoizer.memoize("test", 1000);
    testMemoizer.memoize("test", 100);

    let actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 2);

    await BeDuration.wait(cacheTimeout + 500);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 1);

    await BeDuration.wait(1000);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 0);
  });
});
