/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { OpenParams } from "../../backend";
import { OpenIModelDbMemoizer } from "../../rpc-impl/OpenIModelDbMemoizer";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";
import { TestConfig } from "../TestConfig";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

describe("OpenIModelDbMemoizer (#integration)", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  const actx = new ActivityLoggingContext("");

  const { memoize: memoizeOpenIModelDb, deleteMemoized: deleteMemoizedOpenIModelDb } = new OpenIModelDbMemoizer();

  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await HubUtility.queryProjectIdByName(accessToken, TestConfig.projectName);
  });

  it("should be able to memoize and deleteMemoized open IModelDb calls", async () => {
    const roIModelId = await HubUtility.queryIModelIdByName(accessToken, testProjectId, "ReadOnlyTest");
    const rwIModelId = await HubUtility.queryIModelIdByName(accessToken, testProjectId, "ReadWriteTest");

    const qp1 = memoizeOpenIModelDb(actx, accessToken, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    const qp2 = memoizeOpenIModelDb(actx, accessToken, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp1.isPending);
    assert.strictEqual(qp2, qp1);

    const qp3 = memoizeOpenIModelDb(actx, accessToken, testProjectId, rwIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp1.isPending);
    assert.notStrictEqual(qp3, qp1);

    await pause(5000); // Hopefully it won't take more than 5 seconds to re-establish the cache from scratch (if necessary)
    assert.isTrue(qp1.isFulfilled);
    assert.isTrue(qp3.isFulfilled);
    assert.exists(qp1.result);
    assert.exists(qp3.result);

    deleteMemoizedOpenIModelDb(actx, accessToken, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    const qp4 = memoizeOpenIModelDb(actx, accessToken, testProjectId, roIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isTrue(qp4.isPending);
  });

});
