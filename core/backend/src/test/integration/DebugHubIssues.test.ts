import { assert } from "chai";
import * as path from "path";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RequestHost } from "@bentley/backend-itwin-client";
import { ChangeSetApplyOption, ChangeSetStatus, GuidString, Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { HubUserInfo, UserInfoQuery, Version } from "@bentley/imodelhub-client";
import { IModel, IModelVersion } from "@bentley/imodeljs-common";
import { RequestGlobalOptions } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { AuthorizedBackendRequestContext, BriefcaseManager, ChangeSetToken, PhysicalModel, StandaloneDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

/* eslint-disable no-console */

// Useful utilities to download/upload test cases from/to iModelHub
describe.skip("DebugHubIssues (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  const iModelRootDir = "d:\\testmodels\\";

  before(async () => {
    IModelTestUtils.setupLogging();
    Logger.setLevel("HubUtility", LogLevel.Info);
    Logger.setLevel("DgnCore", LogLevel.Info);
    Logger.setLevel("Changeset", LogLevel.Info);
    await RequestHost.initialize();
    RequestGlobalOptions.timeout = {
      response: 10000000,
      deadline: 10000000,
    };
    IModelTestUtils.setupDebugLogLevels();
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Only needed for DEV

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    // const accessToken = new AccessToken("TokenWithoutPrefixHere");
    // requestContext = new AuthorizedClientRequestContext(accessToken);
  });

  it.skip("should be able to open a model from the Hub", async () => {
    const projectName = "Ern-Test-ForDel2222";
    const iModelName = "H366888";
    const version = IModelVersion.named("V13 - 07/07/2020");
    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: myProjectId, iModelId: myIModelId.toString(), asOf: version.toJSON() });
    assert.exists(iModel);
    assert(iModel.openMode === OpenMode.Readonly);

    iModel.close();
  }).timeout(100000000);

  it.skip("should be able to dump all change sets into a separate Db", async () => {
    const iModelName = "H366888";
    const iModelDir = path.join(iModelRootDir, iModelName);
    const changeSetsDbPathname = path.join(iModelRootDir, iModelName, `changeSets.db`);
    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);
    HubUtility.dumpChangeSetsToDb(changeSetsDbPathname, changeSets, false /* =dumpColumns */);
  }).timeout(100000000);

  it.skip("should be able to dump a specific change set to a Db", async () => {
    const iModelName = "H366888";
    const iModelDir = path.join(iModelRootDir, iModelName);
    const changeSetsDbPathname = path.join(iModelRootDir, iModelName, `changeSets.db`);
    const changeSetIndex = 2081;
    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);
    changeSets.forEach((changeSet) => {
      if (changeSet.index === changeSetIndex) {
        Logger.logInfo(HubUtility.logCategory, `Dumping change set`, () => ({ ...changeSet }));
        HubUtility.dumpChangeSetToDb(changeSet.pathname, changeSetsDbPathname, true /* =dumpColumns */);
      }
    });
  }).timeout(100000000);

  it.skip("should be able to validate apply change sets to previously downloaded iModel", async () => {
    const iModelName = "H366888";
    const iModelDir = path.join(iModelRootDir, iModelName);
    HubUtility.validateApplyChangeSetsOnDisk(iModelDir);
  }).timeout(100000000);

  it.skip("should be able to download and backup required test files from the Hub", async () => {
    const projectName = "Brisbane Cross River Rail";
    const iModelName = "H366888";
    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir, false /* =reDownload */);
  });

  it.skip("should be able to upload required test files to the Hub", async () => {
    const projectName = "Ern-Test-ForDel2222";
    const iModelName = "H366888";
    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir);
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
      console.log(`${iModel.name};${version.name};${link}`); // eslint-disable-line no-console
    }
  });

  it.skip("should be able to upload a single file to the Hub", async () => {
    const projectName = "iModelJsIntegrationTest";
    const iModelName = "Orlando"; // Attempts to upload <iModelRootDir>/Orlando/Orlando.bim

    const iModelDir = path.join(iModelRootDir, iModelName, `${iModelName}.bim`);
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
    console.log(`ProjectName: ${projectName}, iModelName: ${iModelName}, URL Link: ${link}`); // eslint-disable-line no-console

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.validateAllChangeSetOperations(requestContext, myProjectId, myIModelId, iModelDir);
  });

  const testIModels: Array<{ src: string, dest?: string }> =
    [{
      src: "ReadOnlyTest",
    }, {
      src: "ReadWriteTest",
    }, {
      src: "NoVersionsTest",
    }, {
      src: "ConnectionReadTest",
    }, {
      src: "Stadium Dataset 1",
    }, {
      src: "PhotoTest",
    }, {
      src: "seedFileTest",
    }, {
      src: "ReadOnlyFullStackTest",
    }, {
      src: "ReadWriteFullStackTest",
    }];

  const iModelExists = async (projectId: string, iModelName: string): Promise<boolean> => {
    const iModel = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
    return !!iModel;
  };

  const uploadIModel = async (projectName: string, srcIModelName: string, destIModelName?: string) => {
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);

    const uploadedIModelName = destIModelName || srcIModelName;
    if (await iModelExists(projectId, uploadedIModelName)) {
      console.log(`Found test iModel ${uploadedIModelName}. Not uploading it again.`); // eslint-disable-line no-console
      return;
    }

    const iModelDir = path.join(iModelRootDir, srcIModelName);
    await HubUtility.pushIModelAndChangeSets(requestContext, projectName, iModelDir, destIModelName);
    const iModelId = await HubUtility.queryIModelIdByName(requestContext, projectId, uploadedIModelName);
    console.log(`Uploaded test iModel ${srcIModelName} to ${uploadedIModelName}: ${iModelId}`); // eslint-disable-line no-console
  };

  it.skip("should be able to upload required test files to the Hub", async () => {
    const projectName = "iModelJsIntegrationTest";
    for (const testIModel of testIModels) {
      await uploadIModel(projectName, testIModel.src, testIModel.dest);
    }
  });

  it.skip("should be able to download required test files to the Hub", async () => {
    const projectName = "iModelJsIntegrationTest";
    for (const testIModel of testIModels) {
      const iModelName = testIModel.dest || testIModel.src;
      const iModelDir = path.join(iModelRootDir, iModelName);
      console.log(`Downloading test iModel ${iModelName} to ${iModelDir}`); // eslint-disable-line no-console
      await HubUtility.downloadIModelByName(requestContext, projectName, iModelName, iModelDir, true /* =reDownload */);
      console.log(`Download of test iModel ${iModelName} complete`); // eslint-disable-line no-console
    }
  });

  it.skip("should be able to validate change set operations", async () => {
    const projectName = "iModelJsIntegrationTest";
    const iModelName = "ReadOnlyTest";
    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const iModelDir = path.join(iModelRootDir, iModelName);
    await HubUtility.validateAllChangeSetOperations(requestContext, myProjectId, myIModelId, iModelDir);
  });

  it.skip("should be able to apply specific change set to the briefcase on disk", async () => {
    const iModelName = "ReadOnlyTest";
    const iModelDir = path.join(iModelRootDir, iModelName);
    const briefcasePathname = HubUtility.getBriefcasePathname(iModelDir);
    const iModel = StandaloneDb.openFile(briefcasePathname, OpenMode.ReadWrite);
    assert.isDefined(iModel);

    const changeSets: ChangeSetToken[] = HubUtility.readChangeSets(iModelDir);
    const changeSet: ChangeSetToken | undefined = changeSets.find((val: ChangeSetToken) => val.index === 368);
    assert.isDefined(changeSet);

    HubUtility.dumpChangeSet(iModel, changeSet!);

    const status: ChangeSetStatus = HubUtility.applyChangeSetsToNativeDb(iModel.nativeDb, new Array<ChangeSetToken>(changeSet!), ChangeSetApplyOption.Reverse);
    assert.equal(status, ChangeSetStatus.Success);
  });

  it.skip("create a test case on the Hub with a named version from a standalone iModel", async () => {
    const projectName = "NodeJsTestProject";
    const pathname = "d:\\temp\\IModelDumps\\Office Building4.bim";

    // Push the iModel to the Hub
    const projectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const iModelId: GuidString = await HubUtility.pushIModel(requestContext, projectId, pathname);

    const iModelDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: projectId, iModelId: iModelId.toString() });
    assert(!!iModelDb);

    // Create and upload a dummy change set to the Hub
    const modelId = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, "DummyTestModel");
    assert(!!modelId);
    iModelDb.saveChanges("Dummy change set");
    await iModelDb.pushChanges(requestContext, "test");

    // Create a named version on the just uploaded change set
    const changeSetId: string = await IModelVersion.latest().evaluateChangeSet(requestContext, iModelId.toString(), BriefcaseManager.imodelClient);
    await BriefcaseManager.imodelClient.versions.create(requestContext, iModelId, changeSetId, "DummyVersion", "Just a dummy version for testing with web navigator");
  });

  it.skip("should be able to delete any iModel on the Hub", async () => {
    await HubUtility.deleteIModel(requestContext, "NodeJsTestProject", "TestModel");
  });

  it.skip("should purge the briefcase cache", async () => {
    // await BriefcaseManager.purgeCache(requestContext);
  });

  it.skip("display info of all test users that accessed a specific iModel", async () => {
    const projectName = "iModelJsIntegrationTest";
    const iModelName = "ReadOnlyFullStackTest";

    const myProjectId = await HubUtility.queryProjectIdByName(requestContext, projectName);
    const myIModelId = await HubUtility.queryIModelIdByName(requestContext, myProjectId, iModelName);

    const users: HubUserInfo[] = await BriefcaseManager.imodelClient.users.get(requestContext, myIModelId, new UserInfoQuery().select("*"));
    for (const user of users) {
      console.log(`iModel ${projectName}:${iModelName} (${myIModelId}) was accessed by these users:`); // eslint-disable-line
      console.log(`${user.email}: ${user.id}`); // eslint-disable-line
    }
  });

  it.skip("display all test user ids", async () => {
    let token = await TestUtility.getAccessToken(TestUsers.regular);
    console.log(`${token.getUserInfo()!.email!.id}: ${token.getUserInfo()!.id}`); // eslint-disable-line
    token = await TestUtility.getAccessToken(TestUsers.manager);
    console.log(`${token.getUserInfo()!.email!.id}: ${token.getUserInfo()!.id}`); // eslint-disable-line
    token = await TestUtility.getAccessToken(TestUsers.super);
    console.log(`${token.getUserInfo()!.email!.id}: ${token.getUserInfo()!.id}`); // eslint-disable-line
    token = await TestUtility.getAccessToken(TestUsers.superManager);
    console.log(`${token.getUserInfo()!.email!.id}: ${token.getUserInfo()!.id}`); // eslint-disable-line
  });
});
