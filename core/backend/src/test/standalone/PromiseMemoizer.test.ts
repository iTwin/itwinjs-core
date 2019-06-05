/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext, AccessToken } from "@bentley/imodeljs-clients";
import { OpenParams, AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { PromiseMemoizer, QueryablePromise } from "../../PromiseMemoizer";
import { TestMemoizer, testFn } from "./TestMemoizer";
import { BeDuration } from "@bentley/bentleyjs-core";

describe("PromiseMemoizer", () => {
  let requestContextRegular: AuthorizedBackendRequestContext;
  let requestContextManager: AuthorizedBackendRequestContext;

  const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const generateTestFunctionKey = (requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): string => {
    return `${requestContext.accessToken.toTokenString()}:${contextId}:${iModelId}:${JSON.stringify(openParams)}:${JSON.stringify(version)}`;
  };

  const testFunction = async (requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): Promise<string> => {
    await pause(1000);
    if (contextId === "TestError")
      throw new Error("TestError");
    return generateTestFunctionKey(requestContext, contextId, iModelId, openParams, version);
  };

  const maxCacheSize = 25;
  const { memoize: memoizeTest, deleteMemoized: deleteMemoizedTest } = new PromiseMemoizer<string>(testFunction, generateTestFunctionKey, maxCacheSize);

  before(async () => {
    const fakeRegularAccessToken = AccessToken.fromJsonWebTokenString("Regular", new Date(), new Date());
    const fakeManagerAccessToken = AccessToken.fromJsonWebTokenString("Manager", new Date(), new Date());

    requestContextRegular = new AuthorizedBackendRequestContext(fakeRegularAccessToken);
    requestContextManager = new AuthorizedBackendRequestContext(fakeManagerAccessToken);
  });

  it("should be able to await memoized promise", async () => {
    const startTime = Date.now();
    const qp: QueryablePromise<string> = memoizeTest(requestContextRegular, "contextId2", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    await qp.promise;
    const endTime = Date.now();
    assert.isAbove(endTime - startTime, 950);
  });

  it("should be able to memoize and deleteMemoized function calls", async () => {
    const qps = new Array<QueryablePromise<string>>(5);
    const expectedResults = new Array<string>(5);

    qps[0] = memoizeTest(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[0] = generateTestFunctionKey(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());

    qps[1] = memoizeTest(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[1] = generateTestFunctionKey(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.strictEqual(qps[1], qps[0], "qps[1] === qps[0] fails");

    qps[2] = memoizeTest(requestContextManager, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[2] = generateTestFunctionKey(requestContextManager, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.notStrictEqual(qps[2], qps[0], "qps[2] === qps[0] fails");

    qps[3] = memoizeTest(requestContextRegular, "contextId", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[3] = generateTestFunctionKey(requestContextRegular, "contextId", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.notStrictEqual(qps[3], qps[0], "qps[3] === qps[0] fails");

    qps[4] = memoizeTest(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    expectedResults[4] = generateTestFunctionKey(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    assert.notStrictEqual(qps[4], qps[0], "qps[4] === qps[0] fails");

    const qpRej = memoizeTest(requestContextRegular, "TestError", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());

    for (const qp of qps) {
      assert.isTrue(qp.isPending, "qp.isPending check fails");
    }
    assert.isTrue(qpRej.isPending, "qpRej.isPending check fails");

    await pause(1500);

    for (let ii = 0; ii < 5; ii++) {
      assert.isTrue(qps[ii].isFulfilled);
      assert.strictEqual(qps[ii].result, expectedResults[ii]);
    }
    assert.isTrue(qpRej.isRejected);
    assert.strictEqual(qpRej.error.message, "TestError");

    deleteMemoizedTest(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    const qp0 = memoizeTest(requestContextRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp0.isPending);
  });

});

describe("A wrapper around PromiseMemoizer", () => {
  const maxCacheSize = 10;
  const resolveWaitTime = 1000; // Time before test resolves in ms
  const pendingWaitTime = 100; // Time before memoizer issues a pending status in ms
  const testMemoizer = new TestMemoizer(maxCacheSize, pendingWaitTime);

  beforeEach(() => {
    testMemoizer.clearCache();
  });

  it("should wait appropriately before issuing a pending status and eventual resolution", async () => {
    const startTime = Date.now();
    let retString = await testMemoizer.callMemoizedTestFn(0, resolveWaitTime);
    const firstEndTime = Date.now();
    assert.isAbove(firstEndTime - startTime, pendingWaitTime - 2);
    assert.equal(retString, "Pending");

    retString = await testMemoizer.callMemoizedTestFn(0, resolveWaitTime);
    const secondEndTime = Date.now();
    assert.isAbove(secondEndTime - firstEndTime, pendingWaitTime - 2);
    assert.equal(retString, "Pending");

    await BeDuration.wait(resolveWaitTime - 2 * pendingWaitTime + 1);
    const actualValue = await testMemoizer.callMemoizedTestFn(0, resolveWaitTime);
    const expectedValue = await testFn(0, resolveWaitTime);
    assert.equal(actualValue, expectedValue);
  });

  it("should not increase the cache size when repeating the same call", async () => {
    for (let ii = 0; ii < 5; ii++) { // Ensure the testFn doesn't resolve
      const retString = await testMemoizer.callMemoizedTestFn(0, resolveWaitTime); // same call everytime
      assert.equal(retString, "Pending");
    }
    const actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 1);
  });

  it("should increase the cache size as expected", async () => {
    for (let ii = 0; ii < 5; ii++) {
      const retString = await testMemoizer.callMemoizedTestFn(ii, resolveWaitTime); // different call everytime
      assert.equal(retString, "Pending");
    }
    const actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 5);
  });

  it("should decrease the cache size and clear it as expected", async () => {
    for (let ii = 0; ii < maxCacheSize; ii++)
      await testMemoizer.callMemoizedTestFn(ii, resolveWaitTime); // Different call every time

    let actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize);

    // Wait for all promises to be resolved and check cache size
    await BeDuration.wait(resolveWaitTime);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize);

    // Fetch resolved promises and check cache size
    for (let ii = 0; ii < maxCacheSize; ii++)
      await testMemoizer.callMemoizedTestFn(ii, resolveWaitTime);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 0);
  });

  it("should clear the cache if there is a overflow", async () => {
    for (let ii = 0; ii < maxCacheSize; ii++)
      await testMemoizer.callMemoizedTestFn(ii, resolveWaitTime * 10); // Different call every time, ensure nothing resolves for the duration of the test
    let actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize);

    await testMemoizer.callMemoizedTestFn(maxCacheSize, resolveWaitTime);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, 1);
  });

  it("should clear the cache of resolved entries first if there is a overflow", async () => {
    const halfCacheSize = Math.floor(maxCacheSize / 2);

    // Set half the cache to be resolved quickly
    for (let ii = 0; ii < halfCacheSize; ii++)
      await testMemoizer.callMemoizedTestFn(ii, resolveWaitTime);
    let actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, halfCacheSize);

    // Set the other half of the cache to be resolved slowly
    for (let ii = halfCacheSize; ii < maxCacheSize; ii++)
      await testMemoizer.callMemoizedTestFn(ii, resolveWaitTime * 4);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize);

    // Wait for the quick calls to be resolved
    await BeDuration.wait(resolveWaitTime);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize);

    // Memoize one more function - this should clear the resolved half of the cache
    await testMemoizer.callMemoizedTestFn(maxCacheSize, resolveWaitTime);
    actualCacheSize = (testMemoizer as any)._cachedPromises.size;
    assert.equal(actualCacheSize, maxCacheSize - halfCacheSize + 1);
  });

});
