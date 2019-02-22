/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { OpenParams } from "../../imodeljs-backend";
import { PromiseMemoizer, QueryablePromise } from "../../PromiseMemoizer";

describe("PromiseMemoizer", () => {
  let fakeAccessTokenRegular: AccessToken;
  let fakeAccessTokenManager: AccessToken;

  const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const generateTestFunctionKey = (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): string => {
    return `${accessToken.toTokenString()}:${contextId}:${iModelId}:${JSON.stringify(openParams)}:${JSON.stringify(version)}`;
  };

  const testFunction = async (accessToken: AccessToken, contextId: string, iModelId: string, openParams: OpenParams, version: IModelVersion): Promise<string> => {
    await pause(1000);
    if (contextId === "TestError")
      throw new Error("TestError");
    return generateTestFunctionKey(accessToken, contextId, iModelId, openParams, version);
  };

  const { memoize: memoizeTest, deleteMemoized: deleteMemoizedTest } = new PromiseMemoizer<string>(testFunction, generateTestFunctionKey);

  before(async () => {
    fakeAccessTokenRegular = AccessToken.fromJsonWebTokenString("Regular", new Date(), new Date());
    fakeAccessTokenManager = AccessToken.fromJsonWebTokenString("Manager", new Date(), new Date());
  });

  it("should be able to await memoized promise", async () => {
    const startTime = Date.now();
    const qp: QueryablePromise<string> = memoizeTest(fakeAccessTokenRegular, "contextId2", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    await qp.promise;
    const endTime = Date.now();
    assert.isAbove(endTime - startTime, 999); // at least 1000 milliseconds
  });

  it("should be able to memoize and deleteMemoized function calls", async () => {
    const qps = new Array<QueryablePromise<string>>(6);
    const expectedResults = new Array<string>(6);

    qps[0] = memoizeTest(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[0] = generateTestFunctionKey(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());

    qps[1] = memoizeTest(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[1] = generateTestFunctionKey(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.strictEqual(qps[1], qps[0], "qps[1] === qps[0] fails");

    qps[2] = memoizeTest(fakeAccessTokenManager, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[2] = generateTestFunctionKey(fakeAccessTokenManager, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.notStrictEqual(qps[2], qps[0], "qps[2] === qps[0] fails");

    qps[3] = memoizeTest(fakeAccessTokenRegular, "contextId", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[3] = generateTestFunctionKey(fakeAccessTokenRegular, "contextId", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.notStrictEqual(qps[3], qps[0], "qps[3] === qps[0] fails");

    qps[4] = memoizeTest(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.pullOnly(), IModelVersion.latest());
    expectedResults[4] = generateTestFunctionKey(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.pullOnly(), IModelVersion.latest());
    assert.notStrictEqual(qps[4], qps[0], "qps[4] === qps[0] fails");

    qps[5] = memoizeTest(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    expectedResults[5] = generateTestFunctionKey(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    assert.notStrictEqual(qps[5], qps[0], "qps[5] === qps[0] fails");

    const qpRej = memoizeTest(fakeAccessTokenRegular, "TestError", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    assert.notStrictEqual(qps[6], qps[0], "qps[6] === qps[0] fails");

    for (const qp of qps) {
      assert.isTrue(qp.isPending, "qp.isPending check fails");
    }
    assert.isTrue(qpRej.isPending, "qpRej.isPending check fails");

    await pause(1500);

    for (let ii = 0; ii < 6; ii++) {
      assert.isTrue(qps[ii].isFulfilled);
      assert.strictEqual(qps[ii].result, expectedResults[ii]);
    }
    assert.isTrue(qpRej.isRejected);
    assert.strictEqual(qpRej.error.message, "TestError");

    deleteMemoizedTest(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    const qp0 = memoizeTest(fakeAccessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp0.isPending);
  });

});
