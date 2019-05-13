/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelVersion } from "@bentley/imodeljs-common";
import { OpenParams, AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { OpenIModelDbMemoizer } from "../../rpc-impl/OpenIModelDbMemoizer";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

describe("OpenIModelDbMemoizer (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let testProjectId: string;

  const { memoize: memoizeOpenIModelDb, deleteMemoized: deleteMemoizedOpenIModelDb } = new OpenIModelDbMemoizer();

  const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  before(async () => {
    requestContext = await IModelTestUtils.getTestUserRequestContext();
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
  });

  it("should be able to memoize and deleteMemoized open IModelDb calls", async () => {
    const roIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadOnlyTest");
    const rwIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadWriteTest");

    const qp1 = memoizeOpenIModelDb(requestContext, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    const qp2 = memoizeOpenIModelDb(requestContext, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp1.isPending);
    assert.strictEqual(qp2, qp1);

    const qp3 = memoizeOpenIModelDb(requestContext, testProjectId, rwIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp1.isPending);
    assert.notStrictEqual(qp3, qp1);

    await pause(20000); // Hopefully it won't take more than 20 seconds to re-establish the cache from scratch (if necessary)
    assert.isTrue(qp1.isFulfilled);
    assert.isTrue(qp3.isFulfilled);
    assert.exists(qp1.result);
    assert.exists(qp3.result);

    deleteMemoizedOpenIModelDb(requestContext, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    const qp4 = memoizeOpenIModelDb(requestContext, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp4.isPending);
  });

});
