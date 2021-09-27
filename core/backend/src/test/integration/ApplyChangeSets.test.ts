/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { GuidString } from "@itwin/core-bentley";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { IModelHost, IModelJsFs } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Useful utilities to download/upload test cases from/to iModelHub
describe("ApplyChangesets (#integration)", () => {

  const testAllChangeSetOperations = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString) => {
    const iModelDir = path.join(IModelHost.cacheDir, iModelId.toString());
    await HubUtility.validateAllChangeSetOperations(requestContext, projectId, iModelId, iModelDir);
    IModelJsFs.purgeDirSync(iModelDir);
  };

  const testOpen = async (user: AuthorizedClientRequestContext, projectId: string, iModelId: string) => {
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ user, iTwinId: projectId, iModelId });
    assert.isDefined(iModelDb);
    iModelDb.close();
  };

  const testAllOperations = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString) => {
    await testOpen(requestContext, projectId, iModelId);
    await testAllChangeSetOperations(requestContext, projectId, iModelId);
  };

  it("should test all changeset operations after downloading iModel from the hub (#integration)", async () => {
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);

    const projectId = await HubUtility.getTestITwinId(requestContext);
    let iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readOnly);
    await testAllOperations(requestContext, projectId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readWrite);
    await testAllOperations(requestContext, projectId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.noVersions);
    await testAllOperations(requestContext, projectId, iModelId);
  });
});
