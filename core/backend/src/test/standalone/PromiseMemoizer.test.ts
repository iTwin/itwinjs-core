
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { OpenParams } from "../../backend";
import { PromiseMemoizer, QueryablePromise } from "../../PromiseMemoizer";

import { IModelTestUtils, TestUsers } from "../IModelTestUtils";

describe("PromiseMemoizer", () => {
  let accessTokenRegular: AccessToken;
  let accessTokenManager: AccessToken;

  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    accessTokenRegular = await IModelTestUtils.getTestUserAccessToken(TestUsers.regular);
    accessTokenManager = await IModelTestUtils.getTestUserAccessToken(TestUsers.manager);
  });

  it("should be able to memoize and deleteMemoized function calls", async () => {
    const qps = new Array<QueryablePromise<string>>(6);
    const expectedResults = new Array<string>(6);

    qps[0] = memoizeTest(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[0] = generateTestFunctionKey(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());

    qps[1] = memoizeTest(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[1] = generateTestFunctionKey(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.strictEqual(qps[1], qps[0]);

    qps[2] = memoizeTest(accessTokenManager, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[2] = generateTestFunctionKey(accessTokenManager, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.notStrictEqual(qps[2], qps[0]);

    qps[3] = memoizeTest(accessTokenRegular, "contextId", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    expectedResults[3] = generateTestFunctionKey(accessTokenRegular, "contextId", "iModelId2", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.notStrictEqual(qps[3], qps[0]);

    qps[4] = memoizeTest(accessTokenRegular, "contextId", "iModelId1", OpenParams.pullOnly(), IModelVersion.latest());
    expectedResults[4] = generateTestFunctionKey(accessTokenRegular, "contextId", "iModelId1", OpenParams.pullOnly(), IModelVersion.latest());
    assert.notStrictEqual(qps[4], qps[0]);

    qps[5] = memoizeTest(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    expectedResults[5] = generateTestFunctionKey(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    assert.notStrictEqual(qps[5], qps[0]);

    const qpRej = memoizeTest(accessTokenRegular, "TestError", "iModelId1", OpenParams.fixedVersion(), IModelVersion.first());
    assert.notStrictEqual(qps[6], qps[0]);

    for (const qp of qps) {
      assert.isTrue(qp.isPending);
    }
    assert.isTrue(qpRej.isPending);

    await pause(1500);

    for (let ii = 0; ii < 6; ii++) {
      assert.isTrue(qps[ii].isFulfilled);
      assert.strictEqual(qps[ii].result, expectedResults[ii]);
    }
    assert.isTrue(qpRej.isRejected);
    assert.strictEqual(qpRej.error.message, "TestError");

    deleteMemoizedTest(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    const qp0 = memoizeTest(accessTokenRegular, "contextId", "iModelId1", OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp0.isPending);
  });

});
