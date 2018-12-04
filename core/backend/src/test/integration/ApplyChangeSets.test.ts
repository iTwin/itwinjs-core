/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { Logger, LogLevel, ActivityLoggingContext, GuidString } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { IModelDb, OpenParams } from "../../backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";
import { KnownLocations } from "../../Platform";

// Useful utilities to download/upload test cases from/to the iModel Hub
describe("ApplyChangeSets (#integration)", () => {
  const iModelRootDir = path.join(KnownLocations.tmpdir, "IModelJsTest/");
  const actx = new ActivityLoggingContext("");

  before(async () => {
    // Note: Change to LogLevel.Info for useful debug information
    Logger.setLevel(HubUtility.logCategory, LogLevel.Error);
    Logger.setLevel("DgnCore", LogLevel.Error);
    Logger.setLevel("BeSQLite", LogLevel.Error);
  });

  const testAllChangeSetOperations = async (accessToken: AccessToken, projectId: string, iModelId: GuidString) => {
    const iModelDir = path.join(iModelRootDir, iModelId.toString());
    return HubUtility.validateAllChangeSetOperations(accessToken, projectId, iModelId, iModelDir);
  };

  const testOpen = async (accessToken: AccessToken, projectId: string, iModelId: string) => {
    const iModelDb = await IModelDb.open(actx, accessToken, projectId, iModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert(!!iModelDb);
  };

  const testAllOperations = async (accessToken: AccessToken, projectId: string, iModelId: GuidString) => {
    await testOpen(accessToken, projectId, iModelId);
    await testAllChangeSetOperations(accessToken, projectId, iModelId);
  };

  it("should test all change set operations after downloading iModel from the hub  (#integration)", async () => {
    console.log(`Downloading/Uploading iModels to/from ${iModelRootDir}`); // tslint:disable-line:no-console

    const accessToken = await IModelTestUtils.getTestUserAccessToken();

    let projectName = "iModelJsIntegrationTest"; let iModelName = "ReadOnlyTest";
    let projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    let iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    await testAllOperations(accessToken, projectId, iModelId);

    projectName = "iModelJsIntegrationTest"; iModelName = "ReadWriteTest";
    projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    await testAllOperations(accessToken, projectId, iModelId);

    projectName = "iModelJsIntegrationTest"; iModelName = "NoVersionsTest";
    projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    await testAllOperations(accessToken, projectId, iModelId);

    // Project was removed - find replacement
    // projectName = "SampleBisPlant"; iModelName = "samplePlant20";
    // projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    // iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    // await testAllOperations(accessToken, projectId, iModelId);

    // iModel was removed - find permanent replacement
    // projectName = "plant-sta"; iModelName = "atp_10K.bim";
    // projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    // iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    // await testAllOperations(accessToken, projectId, iModelId);

    // Fails due to an assertion DgnGeoCoord
    // projectName = "iModelHubTest"; iModelName = "Office Building4";
    // projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    // iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    // await testAllOperations(accessToken, projectId, iModelId);

    // Waiting for new Db after converter fix
    // projectName = "AbdTestProject"; iModelName = "ATP_2018050310145994_scenario22";
    // projectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    // iModelId = await HubUtility.queryIModelIdByName(accessToken, projectId, iModelName);
    // await testAllOperations(accessToken, projectId, iModelId);
  });
});
