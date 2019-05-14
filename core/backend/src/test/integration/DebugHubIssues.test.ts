/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { assert } from "chai";
import { OpenMode, GuidString, PerfLogger } from "@bentley/bentleyjs-core";
import { RequestHost } from "@bentley/imodeljs-clients-backend";
import { IModel, IModelVersion } from "@bentley/imodeljs-common";
import { Version, RequestGlobalOptions } from "@bentley/imodeljs-clients";
import {
  IModelDb, OpenParams, PhysicalModel, AuthorizedBackendRequestContext,
  BriefcaseManager, IModelJsFs,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUsers } from "../TestUsers";
import { HubUtility } from "./HubUtility";

// Useful utilities to download/upload test cases from/to the iModel Hub
describe.skip("DebugHubIssues (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  const iModelRootDir = "d:\\temp\\IModelDumps\\";

  before(async () => {
    IModelTestUtils.setupLogging();
    await RequestHost.initialize();
    RequestGlobalOptions.timeout = {
      response: 10000000,
      deadline: 10000000,
    };
    // IModelTestUtils.setupDebugLogLevels();
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Only needed for DEV
    requestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.regular);
  });

  it.skip("should be able to open the Retail Building Sample", async () => {
    const projectName = "Retail Building Sample";
    const iModelName = "Retail Building Sample";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    await iModel.close(requestContext);
  });

  it.skip("should be able to open checkpoints", async () => {
    const projectName = "DesignReviewTestDatasets";
    const iModelName = "OG_REF";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    let versionName = "S1.P01.04";
    // const iModel4: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.named(versionName));
    // assert.exists(iModel4);
    // assert(iModel4.openParams.openMode === OpenMode.Readonly);

    versionName = "S1.P01.03";
    const iModel3: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.named(versionName));
    assert.exists(iModel3);
    assert(iModel3.openParams.openMode === OpenMode.Readonly);

    versionName = "S1.P01.02";
    const iModel2: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.named(versionName));
    assert.exists(iModel2);
    assert(iModel2.openParams.openMode === OpenMode.Readonly);

    versionName = "S1.P01.01";
    const iModel1: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion(), IModelVersion.named(versionName));
    assert.exists(iModel1);
    assert(iModel1.openParams.openMode === OpenMode.Readonly);

    // await iModel4.close(requestContext);
    await iModel3.close(requestContext);
    await iModel2.close(requestContext);
    await iModel1.close(requestContext);
  });

  it.skip("should be able to dump iModel links for test files", async () => {
    const projectName = "DesignReviewTestDatasets";
    const projectId: string = await HubUtility.queryProjectIdByName(requestContext, projectName);

    const urlPrefix = "https://dev-connect-imodelweb.bentley.com/imodeljs";
    const urlSuffix = "&version=v2.0";

    const iModels = await BriefcaseManager.imodelClient.iModels.get(requestContext, projectId);
    for (const iModel of iModels) {
      const versions: Version[] = await BriefcaseManager.imodelClient.versions.get(requestContext, iModel.id!);
      if (versions.length === 0)
        continue;

      const version = versions[versions.length - 1];
      const changeSetId = version.changeSetId;
      const link = `${urlPrefix}?projectId=${projectId}&iModelId=${iModel.id}&ChangeSetId=${changeSetId}${urlSuffix}`;
      console.log(`${iModel.name};${version.name};${link}`); // tslint:disable-line:no-console
    }
  });

  it.skip("should be able to upload a single file to the Hub", async () => {
    const projectName = "iModelJsIntegrationTest";
    const iModelName = "Orlando"; // Attempts to upload <iModelRootDir>/Orlando/Orlando.bim

    const iModelDir = path.join(iModelRootDir, iModelName, iModelName + ".bim");
    const projectId: string = await HubUtility.queryProjectIdByName(requestContext, projectName);
    await HubUtility.pushIModel(requestContext, projectId, iModelDir);
  });

  it.skip("should be able to validate change set operations from iModel on disk", async () => {
    const iModelName = "PnId2";
    const iModelDir = path.join(iModelRootDir, iModelName);
    HubUtility.validateAllChangeSetOperationsOnDisk(iModelDir);
  });

  it.skip("should be able to validate change set operations on iModel from Hub", async () => {
    const projectName = "DigOpsDev1";
    const iModelName = "PnId2";
    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const link = `https://connect-imodelweb.bentley.com/imodeljs/?projectId=${myProjectId}&iModelId=${myIModelId}`;
    console.log(`ProjectName: ${projectName}, iModelName: ${iModelName}, URL Link: ${link}`); // tslint:disable-line:no-console

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.validateAllChangeSetOperations(requestContext, myProjectId, myIModelId, iModelDir);
  });

  it.skip("should be able to download and backup required test files from the Hub", async () => {
    const projectName = "PenChemOSBL2";
    const iModelName = "PenChemOSBL7";
    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to upload required test files to the Hub", async () => {
    const projectName = "DesignReviewTestDatasets";
    const iModelName = "PenChemOSBL7";
    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);
  });

  it.skip("should be able to upload required test files to the Hub", async () => {
    const projectName = "iModelJsTest";
    const iModelName = "ReadOnlyTest";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);
  });

  it.skip("should be able to upload required test files to the Hub", async () => {
    const projectName = "iModelJsIntegrationTest";

    let iModelName = "ReadOnlyTest";
    let iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    iModelName = "ReadWriteTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    iModelName = "NoVersionsTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    iModelName = "ConnectionReadTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);
  });

  it.skip("should be able to download required test files from the Hub", async () => {
    const projectName = "iModelJsTest";

    let iModelName = "imodeljs-clients Briefcases test";
    let iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients ChangeSets test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients Codes test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients Events test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients Locks test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients Statistics test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients UserInfo test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients Versions test";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "imodeljs-clients Versions test 2";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

  });

  it.skip("should be able to delete any iModel on the Hub", async () => {
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Briefcases test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients ChangeSets test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Codes test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Events test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Locks test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Statistics test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients UserInfo test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Versions test");
    await HubUtility.deleteIModel(requestContext, "iModelJsTest", "imodeljs-clients Versions test 2");
  });

  it.skip("should be able to download DesignReviewTestDatasets from the Hub", async () => {
    const projectName = "DesignReviewTestDatasets";

    let iModelName = "BSY_OG_UK_01 OG_REF";
    let iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Coffs Harbour Bypass Dataset 1";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Coffs Harbour Bypass Dataset 2";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Mott Dataset 1";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Mott Dataset 2 - Section 6";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Mott Dataset 3 - Section 8";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Mott WP-137";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "OG_REF";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "PenChemOSBL7";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Retail Building";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Stadium Dataset 1";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Sweco Norway Dataset 1";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Sweco Norway Dataset 2 - Revit and MicroStation Bridge";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "Sweco Norway Dataset 3 - 108 refs";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to upload DesignReviewTestDatasets from the Hub", async () => {
    const projectName = "DesignReviewTestDatasets";

    // const iModelName = "BSY_OG_UK_01 OG_REF";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "OG_REF";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Coffs Harbour Bypass Dataset 1";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    const iModelName = "Coffs Harbour Bypass Dataset 2";
    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Mott Dataset 1";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Mott Dataset 2 - Section 6";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Mott Dataset 3 - Section 8";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Mott WP-137";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "PenChemOSBL7";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Retail Building";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Stadium Dataset 1";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Sweco Norway Dataset 1";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Sweco Norway Dataset 2 - Revit and MicroStation Bridge";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);

    // const iModelName = "Sweco Norway Dataset 3 - 108 refs";
    // const iModelDir = path.join(iModelRootDir, iModelName);
    // await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);
  });

  it.skip("should be able to download and backup required test files from the Hub", async () => {
    const projectName = "iModelJsIntegrationTest";

    let iModelName = "ReadOnlyTest";
    let iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "ReadWriteTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "NoVersionsTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "ConnectionReadTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);

    iModelName = "PushTest";
    iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to open ReadOnlyTest model", async () => {
    const projectName = "iModelJsIntegrationTest";
    const iModelName = "ReadOnlyTest";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    await iModel.close(requestContext);
  });

  it.skip("should be able to validate change set operations", async () => {
    const projectName = "iModelJsIntegrationTest";
    const iModelName = "ReadOnlyTest";
    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const link = `https://connect-imodelweb.bentley.com/imodeljs/?projectId=${myProjectId}&iModelId=${myIModelId}`;
    console.log(`ProjectName: ${projectName}, iModelName: ${iModelName}, URL Link: ${link}`); // tslint:disable-line:no-console

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.validateAllChangeSetOperations(requestContext, myProjectId, myIModelId, iModelDir);
  });

  it.skip("should be able to download the seed files, change sets, for UKRail_EWR2 (EWR_2E) model", async () => {
    const projectName = "UKRail_EWR2";
    const iModelName = "EWR_2E";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to download the seed files, change sets, for 1MWCCN01 - North Project (SECTION_08_IM01) model", async () => {
    const projectName = "1MWCCN01 - North Project";
    const iModelName = "SECTION_08_IM01";

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir);
  });

  it.skip("should be able to open UKRail_EWR2 (EWR_2E) model", async () => {
    const projectName = "UKRail_EWR2";
    const iModelName = "EWR_2E";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const perfLogger = new PerfLogger("EWR_2E");

    const iModel: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    perfLogger.dispose();

    await iModel.close(requestContext);
  });

  it.skip("should be able to open 1MWCCN01 - North Project (SECTION_08_IM01) model", async () => {
    const projectName = "1MWCCN01 - North Project";
    const iModelName = "SECTION_08_IM01";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const perfLogger = new PerfLogger("SECTION_08_IM01");

    const iModel: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    perfLogger.dispose();

    await iModel.close(requestContext);
  });

  it.skip("create a test case on the Hub with a named version from a standalone iModel", async () => {
    const projectName = "NodeJsTestProject";
    const pathname = "d:\\temp\\IModelDumps\\Office Building4.bim";

    // Push the iModel to the Hub
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const iModelId: GuidString = await HubUtility.pushIModel(requestContext, projectId, pathname);

    const iModelDb = await IModelDb.open(requestContext, projectId, iModelId.toString(), OpenParams.pullAndPush(), IModelVersion.latest());
    assert(!!iModelDb);

    // Create and upload a dummy change set to the Hub
    const modelId = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, "DummyTestModel");
    assert(!!modelId);
    iModelDb.saveChanges("Dummy change set");
    await iModelDb.pushChanges(requestContext);

    // Create a named version on the just uploaded change set
    const changeSetId: string = await IModelVersion.latest().evaluateChangeSet(requestContext, iModelId.toString(), BriefcaseManager.imodelClient);
    await BriefcaseManager.imodelClient.versions.create(requestContext, iModelId, changeSetId, "DummyVersion", "Just a dummy version for testing with web navigator");
  });

  it.skip("should be able to delete any iModel on the Hub", async () => {
    await HubUtility.deleteIModel(requestContext, "NodeJsTestProject", "TestModel");
  });

  it.skip("should be able to open any iModel on the Hub", async () => {
    const projectName = "NodeJsTestProject";
    const iModelName = "TestModel";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    await iModel.close(requestContext);
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

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const iModel: IModelDb = await IModelDb.open(requestContext, myProjectId, myIModelId.toString(), OpenParams.fixedVersion());
    assert.exists(iModel);
    assert(iModel.openParams.openMode === OpenMode.Readonly);

    await iModel.close(requestContext);
  });

});
