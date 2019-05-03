/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { WSStatus, GuidString } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AccessToken, WsgError } from "@bentley/imodeljs-clients";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUsers } from "../TestUsers";
import { IModelDb, OpenParams, AuthorizedBackendRequestContext, BriefcaseManager } from "../../imodeljs-backend";
import { HubUtility } from "./HubUtility";

describe("IModelOpen (#integration)", () => {

  let requestContext: AuthorizedBackendRequestContext;
  let testProjectId: GuidString;
  let badRequestContext: AuthorizedBackendRequestContext;

  before(async () => {
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");

    const badToken = AccessToken.fromJsonWebTokenString("ThisIsABadToken");
    badRequestContext = new AuthorizedBackendRequestContext(badToken);
  });

  it("Unauthorized requests should cause an obvious error", async () => {
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadOnlyTest");
    const testChangeSetId = await IModelVersion.latest().evaluateChangeSet(requestContext, testIModelId, BriefcaseManager.imodelClient);

    let error: any;
    try {
      await IModelDb.open(badRequestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.isTrue(error instanceof WsgError);
    assert.equal(401, error.status);
    assert.equal(WSStatus.LoginFailed, error.errorNumber);

    error = undefined;
    try {
      await IModelDb.open(badRequestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.asOfChangeSet(testChangeSetId));
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.isTrue(error instanceof WsgError);
    assert.equal(401, error.status);
    assert.equal(WSStatus.LoginFailed, error.errorNumber);
  });
});
