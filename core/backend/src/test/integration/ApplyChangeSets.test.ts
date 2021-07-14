/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as path from "path";
import { IModelHost, IModelJsFs, NativeLoggerCategory } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Useful utilities to download/upload test cases from/to iModelHub
describe("ApplyChangesets (#integration)", () => {
  before(async () => {
    // Note: Change to LogLevel.Info for useful debug information
    Logger.setLevel(HubUtility.logCategory, LogLevel.Error);
    Logger.setLevel(NativeLoggerCategory.DgnCore, LogLevel.Error);
    Logger.setLevel(NativeLoggerCategory.BeSQLite, LogLevel.Error);
  });

  const testAllChangeSetOperations = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString) => {
    const iModelDir = path.join(IModelHost.cacheDir, iModelId.toString());
    await HubUtility.validateAllChangeSetOperations(requestContext, projectId, iModelId, iModelDir);
    IModelJsFs.purgeDirSync(iModelDir);
  };

  const testOpen = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: string) => {
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: projectId, iModelId });
    requestContext.enter();
    assert(!!iModelDb);
  };

  const testAllOperations = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString) => {
    await testOpen(requestContext, projectId, iModelId);
    await testAllChangeSetOperations(requestContext, projectId, iModelId);
  };

  it("should test all changeset operations after downloading iModel from the hub (#integration)", async () => {
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);

    const projectId = await HubUtility.getTestContextId(requestContext);
    let iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readOnly);
    await testAllOperations(requestContext, projectId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readWrite);
    await testAllOperations(requestContext, projectId, iModelId);

    iModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.noVersions);
    await testAllOperations(requestContext, projectId, iModelId);
  });
});
