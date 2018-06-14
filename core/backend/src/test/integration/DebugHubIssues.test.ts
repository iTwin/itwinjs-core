/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelDb, OpenParams, IModelHost, IModelHostConfiguration } from "../../backend";
import { IModelTestUtils, TestUsers } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";
import { IModelJsFs } from "../../IModelJsFs";
import { BriefcaseManager } from "../../BriefcaseManager";

// Useful utilities to download/upload test cases from/to the iModel Hub
describe.skip("DebugHubIssues (#integration)", () => {
  let accessToken: AccessToken;
  const iModelRootDir = "d:\\temp\\IModelDumps\\";

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
  });

  it.skip("should be able to download the seed files, change sets, for any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(accessToken, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to delete any iModel on the Hub", async () => {
    await HubUtility.deleteIModel(accessToken, "NodeJsTestProject", "TestModel");
  });

  it.skip("should be able to upload seed files, change sets, for any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(accessToken, projectName, iModelDir);
  });

  it.skip("should be able to open any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const myProjectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(accessToken, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(accessToken, myProjectId, myIModelId, OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    iModel.close(accessToken);
  });

  it.skip("should be able to create a change set from a standalone iModel)", async () => {
    const dbName = "D:\\temp\\Defects\\879278\\DPIntegrationTestProj79.bim";
    const iModel: IModelDb = IModelDb.openStandalone(dbName, OpenMode.ReadWrite, true); // could throw Error
    assert.exists(iModel);

    const changeSetToken = BriefcaseManager.createStandaloneChangeSet(iModel.briefcase);
    assert(IModelJsFs.existsSync(changeSetToken.pathname));

    BriefcaseManager.dumpChangeSet(iModel.briefcase, changeSetToken);
  });

  it.skip("should be able to open any iModel on the Hub", async () => {
    const projectName = "AbdTestProject";
    const iModelName = "ATP_2018050310145994_scenario22";

    const myProjectId = await HubUtility.queryProjectIdByName(accessToken, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(accessToken, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(accessToken, myProjectId, myIModelId, OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    iModel.close(accessToken);
  });

  it.skip("should be able to download the seed files, change sets, for any iModel on the Hub in PROD", async () => {
    const accessToken1: AccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.regular, "PROD");

    // Restart host on PROD
    IModelHost.shutdown();
    const hostConfig: IModelHostConfiguration = new IModelHostConfiguration();
    hostConfig.iModelHubDeployConfig = "PROD";
    IModelHost.startup(hostConfig);

    const projectName = "1MWCCN01 - North Project";
    const iModelName = "1MWCCN01";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(accessToken1, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to download the seed files, change sets, for any iModel on the Hub in DEV", async () => {
    const accessToken1: AccessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.user1, "QA");

    // Restart host on DEV
    IModelHost.shutdown();
    const hostConfig: IModelHostConfiguration = new IModelHostConfiguration();
    hostConfig.iModelHubDeployConfig = "DEV";
    IModelHost.startup(hostConfig);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Turn off SSL validation in DEV

    const projectId = "bffa4aea-5f3f-4b60-8ecb-4656081ea480";
    const iModelId = "5e8f5fbb-6613-479a-afb1-ce8de037ef0e";
    const iModelDir = path.join(iModelRootDir, iModelId);

    const startTime = Date.now();
    await HubUtility.downloadIModelById(accessToken1, projectId, iModelId, iModelDir);
    const finishTime = Date.now();
    console.log(`Time taken to download is ${finishTime - startTime} milliseconds`); // tslint:disable-line:no-console
  });

});
