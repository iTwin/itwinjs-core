/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import { AuthorizedBackendRequestContext, IModelDb, IModelJsNative, KnownLocations, OpenParams } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Useful utilities to download/upload test cases from/to the iModel Hub
describe("ApplyChangeSets (#integration)", () => {
  const iModelRootDir = path.join(KnownLocations.tmpdir, "IModelJsTest/");

  before(async () => {
    // Note: Change to LogLevel.Info for useful debug information
    Logger.setLevel(HubUtility.logCategory, LogLevel.Error);
    Logger.setLevel(IModelJsNative.LoggerCategory.DgnCore, LogLevel.Error);
    Logger.setLevel(IModelJsNative.LoggerCategory.BeSQLite, LogLevel.Error);
  });

  const testAllChangeSetOperations = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString) => {
    const iModelDir = path.join(iModelRootDir, iModelId.toString());
    return HubUtility.validateAllChangeSetOperations(requestContext, projectId, iModelId, iModelDir);
  };

  const testOpen = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: string) => {
    const iModelDb = await IModelDb.open(requestContext, projectId, iModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert(!!iModelDb);
  };

  const testAllOperations = async (requestContext: AuthorizedClientRequestContext, projectId: string, iModelId: GuidString) => {
    await testOpen(requestContext, projectId, iModelId);
    await testAllChangeSetOperations(requestContext, projectId, iModelId);
  };

  it("should test all change set operations after downloading iModel from the hub  (#integration)", async () => {
    console.log(`Downloading/Uploading iModels to/from ${iModelRootDir}`); // tslint:disable-line:no-console

    const requestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext();

    let projectName = "iModelJsIntegrationTest"; let iModelName = "ReadOnlyTest";
    let projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    let iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
    await testAllOperations(requestContext, projectId, iModelId);

    projectName = "iModelJsIntegrationTest"; iModelName = "ReadWriteTest";
    projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
    await testAllOperations(requestContext, projectId, iModelId);

    projectName = "iModelJsIntegrationTest"; iModelName = "NoVersionsTest";
    projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, iModelName);
    await testAllOperations(requestContext, projectId, iModelId);
  });
});
