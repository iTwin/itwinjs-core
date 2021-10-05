/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { IModelHost, IModelJsFs } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Useful utilities to download/upload test cases from/to iModelHub
describe("ApplyChangesets (#integration)", () => {
  const testAllChangeSetOperations = async (accessToken: AccessToken, iTwinId: string, iModelId: GuidString) => {
    const iModelDir = path.join(IModelHost.cacheDir, iModelId.toString());
    await HubUtility.validateAllChangeSetOperations(accessToken, iTwinId, iModelId, iModelDir);
    IModelJsFs.purgeDirSync(iModelDir);
  };

  const testOpen = async (accessToken: AccessToken, iTwinId: string, iModelId: string) => {
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ accessToken, iTwinId, iModelId });
    assert.isDefined(iModelDb);
    iModelDb.close();
  };

  const testAllOperations = async (accessToken: AccessToken, iTwinId: string, iModelId: GuidString) => {
    await testOpen(accessToken, iTwinId, iModelId);
    await testAllChangeSetOperations(accessToken, iTwinId, iModelId);
  };

  it("should test all changeset operations after downloading iModel from the hub (#integration)", async () => {
    const requestContext = await TestUtility.getAccessToken(TestUsers.regular);

    const iTwinId = await HubUtility.getTestITwinId(requestContext);
    let iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readOnly);
    await testAllOperations(requestContext, iTwinId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readWrite);
    await testAllOperations(requestContext, iTwinId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.noVersions);
    await testAllOperations(requestContext, iTwinId, iModelId);
  });
});
