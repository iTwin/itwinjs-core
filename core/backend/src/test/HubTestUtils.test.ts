/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelDb } from "../backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { HubTestUtils } from "./HubTestUtils";
import { IModelJsFs } from "../IModelJsFs";
import { BriefcaseManager } from "../BriefcaseManager";

// Useful utilities to download/upload test cases from/to the iModel Hub
describe.skip("HubTestUtils", () => {
  let accessToken: AccessToken;
  const iModelRootDir = "d:\\temp\\IModelDumps\\";

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
  });

  it("should be able to download the seed files, change sets, for any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubTestUtils.downloadIModel(accessToken, projectName, iModelName, iModelDir);
  });

  it("should be able to delete any iModel on the Hub", async () => {
    await HubTestUtils.deleteIModel(accessToken, "NodeJsTestProject", "TestModel");
  });

  it("should be able to upload seed files, change sets, for any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubTestUtils.uploadIModel(accessToken, projectName, iModelDir);
  });

  it("should be able to open any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const myProjectId = await HubTestUtils.queryProjectIdByName(accessToken, projectName);
    const myIModelId = await HubTestUtils.queryIModelIdByName(accessToken, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(accessToken, myProjectId, myIModelId, OpenMode.Readonly);
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);

    iModel.close(accessToken);
  });

  it("should be able to create a change set from a standalone iModel", async () => {
    const dbName = "D:\\temp\\Defects\\879278\\DPIntegrationTestProj79.bim";
    const iModel: IModelDb = IModelDb.openStandalone(dbName, OpenMode.ReadWrite, true); // could throw Error
    assert.exists(iModel);

    const changeSetToken = BriefcaseManager.createStandaloneChangeSet(iModel.briefcase);
    assert(IModelJsFs.existsSync(changeSetToken.pathname));

    BriefcaseManager.dumpChangeSet(iModel.briefcase, changeSetToken);
  });

  it("should be able to open any iModel on the Hub", async () => {
    const projectName = "AbdTestProject";
    const iModelName = "ATP_2018050310145994_scenario22";

    const myProjectId = await HubTestUtils.queryProjectIdByName(accessToken, projectName);
    const myIModelId = await HubTestUtils.queryIModelIdByName(accessToken, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(accessToken, myProjectId, myIModelId, OpenMode.Readonly);
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);

    iModel.close(accessToken);
  });

  it("should be able to download the seed files, change sets, for any iModel on the Hub", async () => {
    const projectName = "AbdTestProject";
    const iModelName = "ATP_2018050310145994_scenario22";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubTestUtils.downloadIModel(accessToken, projectName, iModelName, iModelDir);
  });

  it("should merge standalone change sets with a standalone iModel", async () => {
    const iModelName = "ATP_2018050310145994_scenario22";
    const iModelDir = path.join(iModelRootDir, iModelName);
    HubTestUtils.mergeIModel(iModelDir);
  });
});
