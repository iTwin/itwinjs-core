/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseStatus, GuidString, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { ChangeSetQuery, ChangesType } from "@bentley/imodelhub-client";
import { IModelError, IModelVersion } from "@bentley/imodeljs-common";
import { UserCancelledError } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { CheckpointManager, V1CheckpointManager } from "../../CheckpointManager";
import {
  AuthorizedBackendRequestContext, BriefcaseDb, BriefcaseIdValue, BriefcaseManager, Element, IModelDb, IModelHost, IModelHostConfiguration,
  IModelJsFs, KnownLocations,
} from "../../imodeljs-backend";
import { IModelTestUtils, TestIModelInfo } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";
import { TestChangeSetUtility } from "./TestChangeSetUtility";

async function createIModelOnHub(requestContext: AuthorizedBackendRequestContext, projectId: GuidString, iModelName: string): Promise<string> {
  let iModel = await HubUtility.queryIModelByName(requestContext, projectId, iModelName);
  if (!iModel)
    iModel = await IModelHost.iModelClient.iModels.create(requestContext, projectId, iModelName, { description: `Description for iModel` });
  assert.isDefined(iModel.wsgId);
  return iModel.wsgId;
}

describe("BriefcaseManager (#integration)", () => {
  let testProjectId: string;
  const testProjectName = "iModelJsIntegrationTest";

  let readOnlyTestIModel: TestIModelInfo;
  const readOnlyTestVersions = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const readOnlyTestElementCounts = [27, 28, 29];

  let readWriteTestIModel: TestIModelInfo;
  let noVersionsTestIModel: TestIModelInfo;

  let requestContext: AuthorizedBackendRequestContext;
  let managerRequestContext: AuthorizedBackendRequestContext;

  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = IModelTestUtils.executeQuery(iModel, "SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  before(async () => {
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, testProjectName);
    readOnlyTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadOnlyTest");
    noVersionsTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "NoVersionsTest");
    readWriteTestIModel = await IModelTestUtils.getTestModelInfo(requestContext, testProjectId, "ReadWriteTest");

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "NoVersionsTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "ReadWriteTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, testProjectName, "Stadium Dataset 1");
    managerRequestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, testProjectName, "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, testProjectName, "NoVersionsTest");
    await HubUtility.purgeAcquiredBriefcases(managerRequestContext, testProjectName, "ReadWriteTest");
  });

  after(() => {
    // IModelTestUtils.resetDebugLogLevels();
  });

  afterEach(() => {
  });

  it("should open and close an iModel from the Hub", async () => {

    try {
      const iModel = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.first().toJSON() });
      assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

      // Validate that the IModelDb is readonly
      assert(iModel.openMode === OpenMode.Readonly, "iModel not set to Readonly mode");

      const expectedChangeSetId = await IModelVersion.first().evaluateChangeSet(requestContext, readOnlyTestIModel.id, IModelHost.iModelClient);
      assert.strictEqual<string>(iModel.changeSetId!, expectedChangeSetId);
      assert.strictEqual<string>(iModel.changeSetId!, expectedChangeSetId);

      const pathname = iModel.pathName;
      assert.isTrue(IModelJsFs.existsSync(pathname));
      await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);

      assert.isFalse(IModelJsFs.existsSync(pathname), `Briefcase continues to exist at ${pathname}`);
    } finally {

    }
  });

  it("should reuse checkpoints", async () => {
    const iModel1 = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel1, iModel2, "previously open briefcase was expected to be shared");

    const iModel3 = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.named("SecondVersion").toJSON() });
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.notEqual(iModel3, iModel2, "opening two different versions should not cause briefcases to be shared when the older one is open");

    const pathname2 = iModel2.pathName;
    iModel2.close();
    assert.isTrue(IModelJsFs.existsSync(pathname2));

    const pathname3 = iModel3.pathName;
    iModel3.close();
    assert.isTrue(IModelJsFs.existsSync(pathname3));

    const iModel4 = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel4, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel4.pathName, pathname2, "previously closed briefcase was expected to be shared");

    const iModel5 = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.named("SecondVersion").toJSON() });
    assert.exists(iModel5, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel5.pathName, pathname3, "previously closed briefcase was expected to be shared");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel4);
    assert.isFalse(IModelJsFs.existsSync(pathname2));

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel5);
    assert.isFalse(IModelJsFs.existsSync(pathname3));
  });

  it("should open iModels of specific versions from the Hub", async () => {
    const iModelFirstVersion = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.first().toJSON() });
    assert.exists(iModelFirstVersion);
    assert.strictEqual<string>(iModelFirstVersion.changeSetId!, "");

    for (const [arrayIndex, versionName] of readOnlyTestVersions.entries()) {
      const iModelFromVersion = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.asOfChangeSet(readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId).toJSON() });
      assert.exists(iModelFromVersion);
      assert.strictEqual<string>(iModelFromVersion.changeSetId!, readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId);

      const iModelFromChangeSet = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, asOf: IModelVersion.named(versionName).toJSON() });
      assert.exists(iModelFromChangeSet);
      assert.strictEqual(iModelFromChangeSet, iModelFromVersion);
      assert.strictEqual<string>(iModelFromChangeSet.changeSetId!, readOnlyTestIModel.changeSets[arrayIndex + 1].wsgId);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, readOnlyTestElementCounts[arrayIndex], `Count isn't what's expected for ${iModelFromVersion.pathName}, version ${versionName}`);

      iModelFromVersion.close();
      iModelFromChangeSet.close();
    }

    const iModelLatestVersion = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
    assert.isDefined(iModelLatestVersion);
    assert.isUndefined(iModelLatestVersion.nativeDb.getReversedChangeSetId());
    assert.strictEqual<string>(iModelLatestVersion.nativeDb.getParentChangeSetId(), readOnlyTestIModel.changeSets[3].wsgId);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelFirstVersion);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelLatestVersion);
  });

  it("should open an iModel with no versions", async () => {
    const iModelNoVer = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: noVersionsTestIModel.id });
    assert.exists(iModelNoVer);
    assert(iModelNoVer.iModelId === noVersionsTestIModel.id, "Correct iModel not found");
  });

  it("should be able to edit only if it's allowed", async () => {
    const iModelFixed = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    assert.exists(iModelFixed);

    let rootEl: Element = iModelFixed.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    assert.throws(() => iModelFixed.elements.updateElement(rootEl));

    const iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc({ requestContext, contextId: testProjectId, iModelId: readWriteTestIModel.id });
    assert.exists(iModelPullAndPush);
    assert.isTrue(!iModelPullAndPush.isReadonly);
    assert.equal(iModelPullAndPush.openMode, OpenMode.ReadWrite);

    rootEl = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    await iModelPullAndPush.concurrencyControl.requestResourcesForUpdate(requestContext, [rootEl]);
    iModelPullAndPush.elements.updateElement(rootEl);

    await iModelPullAndPush.concurrencyControl.request(requestContext);
    iModelPullAndPush.saveChanges(); // Push is tested out in a separate test

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelFixed);

    const fileName = iModelPullAndPush.pathName;
    iModelPullAndPush.close();
    assert.isFalse(iModelPullAndPush.isOpen);

    // Reopen the briefcase as readonly to validate
    const iModelPullAndPush2 = await BriefcaseDb.open(requestContext, { fileName, readonly: true });
    assert.exists(iModelPullAndPush2);
    assert.isTrue(iModelPullAndPush2.isReadonly);
    assert.isTrue(iModelPullAndPush2.isOpen);
    assert.equal(iModelPullAndPush2.openMode, OpenMode.Readonly);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelPullAndPush2);
  });

  it("should set the briefcase cache directory to expected locations", async () => {
    const config = new IModelHostConfiguration();
    const cacheSubDir = "imodels";

    // Test legacy 1.0 cache location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/"); // eslint-disable-line deprecation/deprecation
    await IModelHost.startup(config);
    assert.strictEqual(config.briefcaseCacheDir, BriefcaseManager.cacheDir); // eslint-disable-line deprecation/deprecation

    // Test 3.0 cache default location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    await IModelHost.startup(config);
    let expectedDir = path.join(IModelHost.cacheDir, cacheSubDir);
    assert.strictEqual(expectedDir, BriefcaseManager.cacheDir);

    // Test 2.0 custom cache location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    config.cacheDir = KnownLocations.tmpdir;
    await IModelHost.startup(config);
    expectedDir = path.join(KnownLocations.tmpdir, cacheSubDir);
    assert.strictEqual(expectedDir, BriefcaseManager.cacheDir);

    // Restore defaults
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    config.cacheDir = undefined;
    await IModelHost.startup(config);
  });

  it("should find checkpoints from previous versions", async () => {
    const arg = { requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id };
    let checkpoint = await IModelTestUtils.openCheckpointUsingRpc(arg);
    // eslint-disable-next-line deprecation/deprecation
    const compatName = V1CheckpointManager.getCompatibilityFileName({ ...arg, changeSetId: checkpoint.changeSetId! });
    let checkpointName = checkpoint.pathName;
    checkpoint.close();

    if (compatName !== checkpointName) {
      IModelJsFs.recursiveMkDirSync(path.dirname(compatName)); // make sure the old path exists
      IModelJsFs.copySync(checkpointName, compatName); // move the file from where we put it in the new location to the old location
      IModelJsFs.removeSync(checkpointName); // make sure we don't find this file
      checkpoint = await IModelTestUtils.openCheckpointUsingRpc(arg); // now try opening it, and we should find the old file
      checkpointName = checkpoint.pathName;
      checkpoint.close();
      assert.equal(checkpointName, compatName, "checkpoint should be found in old location");
    }

    IModelJsFs.removeSync(compatName); // now delete old file and make sure we don't use it
    checkpoint = await IModelTestUtils.openCheckpointUsingRpc(arg);
    checkpointName = checkpoint.pathName;
    checkpoint.close();
    assert.notEqual(checkpointName, compatName, "checkpoint should be found in new location");
  });

  it("should find briefcases from previous versions", async () => {
    const arg = { requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id };
    let briefcase = await IModelTestUtils.openBriefcaseUsingRpc(arg);
    // eslint-disable-next-line deprecation/deprecation
    const compatName = BriefcaseManager.getCompatibilityFileName({ ...arg, briefcaseId: briefcase.briefcaseId });
    const compatLocksFile = path.join(path.dirname(compatName), `${path.basename(compatName, ".bim")}.cctl.bim`);
    let briefcaseName = briefcase.pathName;
    briefcase.close();

    if (compatName !== briefcaseName) {
      IModelJsFs.recursiveMkDirSync(path.dirname(compatName)); // make sure the old path exists
      IModelJsFs.copySync(briefcaseName, compatName); // move the file from where we put it in the new location to the old location
      IModelJsFs.copySync(`${briefcaseName}-locks`, compatLocksFile); // copy the locks file to its old name too
      IModelJsFs.removeSync(briefcaseName); // make sure we don't find this file
      briefcase = await IModelTestUtils.openBriefcaseUsingRpc(arg); // now try opening it, and we should find the old file
      briefcaseName = briefcase.pathName;
      briefcase.close();
      assert.equal(briefcaseName, compatName, "briefcase should be found in old location");
      assert.isFalse(IModelJsFs.existsSync(compatLocksFile)); // we should have deleted it
    }

    IModelJsFs.removeSync(compatName); // now delete old file and make sure we don't use it
    briefcase = await IModelTestUtils.openBriefcaseUsingRpc(arg);
    briefcaseName = briefcase.pathName;
    briefcase.close();
    assert.notEqual(briefcaseName, compatName, "briefcase should be found in new location");
  });

  it("should be able to reuse existing briefcases from a previous session", async () => {
    let checkpoint = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
    let numDownloads = 0;

    CheckpointManager.onDownload.addListener((_job) => numDownloads++);
    assert.exists(checkpoint);
    assert.equal(checkpoint.openMode, OpenMode.Readonly);
    const checkpointName = checkpoint.pathName;

    let iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
    assert.exists(iModelPullAndPush);
    assert.equal(iModelPullAndPush.openMode, OpenMode.ReadWrite);
    const pullAndPushPathname = iModelPullAndPush.pathName;

    let iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, briefcaseId: 0 });
    assert.exists(iModelPullOnly);
    assert.equal(iModelPullOnly.openMode, OpenMode.ReadWrite); // Note: PullOnly briefcases must be set to ReadWrite to accept change sets
    const pullOnlyPathname = iModelPullOnly.pathName;

    checkpoint.close();
    iModelPullAndPush.close();
    iModelPullOnly.close();

    await IModelHost.shutdown();

    // note: we can't tell what files were local before we ran this test. All we can test is that now that we know they're local that it does not cause a download.
    const wasNumDownloads = numDownloads;
    assert.isTrue(IModelJsFs.existsSync(checkpointName));
    assert.isTrue(IModelJsFs.existsSync(pullAndPushPathname));
    assert.isTrue(IModelJsFs.existsSync(pullOnlyPathname));

    await IModelHost.startup();

    checkpoint = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
    assert.exists(checkpoint);
    assert.equal(checkpoint.pathName, checkpointName);
    assert.equal(numDownloads, wasNumDownloads, "should not need download");

    iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
    assert.exists(iModelPullAndPush);
    assert.equal(iModelPullAndPush.pathName, pullAndPushPathname);
    assert.equal(numDownloads, wasNumDownloads, "should not need download");

    iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, briefcaseId: 0 });
    assert.exists(iModelPullOnly);
    assert.equal(iModelPullOnly.pathName, pullOnlyPathname);
    assert.equal(numDownloads, wasNumDownloads, "should not need download");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, checkpoint);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelPullAndPush);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModelPullOnly);

    assert.isFalse(IModelJsFs.existsSync(checkpointName));
    assert.isFalse(IModelJsFs.existsSync(pullAndPushPathname));
    assert.isFalse(IModelJsFs.existsSync(pullOnlyPathname));

    // now we know that the checkpoint doesn't exist, download it again to test the "onDownload" listener works.
    numDownloads = 0;
    checkpoint = await IModelTestUtils.openCheckpointUsingRpc({ requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id });
    assert.equal(numDownloads, 1, "should need download");
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, checkpoint);

  });

  it("should be able to reverse and reinstate changes", async () => {
    const args = { requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id };
    const iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });

    let revIndex: number;
    for (revIndex = readOnlyTestVersions.length - 1; revIndex >= 0; revIndex--) {
      // Stop at a schema change
      const changeSetId = await IModelVersion.named(readOnlyTestVersions[revIndex]).evaluateChangeSet(requestContext, readOnlyTestIModel.id, IModelHost.iModelClient);
      const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, readOnlyTestIModel.id, new ChangeSetQuery().byId(changeSetId));
      assert.equal(changeSets.length, 1);
      if (changeSets[0].changesType === ChangesType.Schema)
        break;

      await iModelPullAndPush.reverseChanges(requestContext, IModelVersion.named(readOnlyTestVersions[revIndex]));
      assert.equal(readOnlyTestElementCounts[revIndex], getElementCount(iModelPullAndPush));

      await iModelPullOnly.reverseChanges(requestContext, IModelVersion.named(readOnlyTestVersions[revIndex]));
      assert.equal(readOnlyTestElementCounts[revIndex], getElementCount(iModelPullOnly));
    }

    for (let fwdIndex = 0; fwdIndex < revIndex; fwdIndex++) {
      await iModelPullAndPush.reinstateChanges(requestContext, IModelVersion.named(readOnlyTestVersions[fwdIndex]));
      assert.equal(readOnlyTestElementCounts[fwdIndex], getElementCount(iModelPullAndPush));

      await iModelPullOnly.reinstateChanges(requestContext, IModelVersion.named(readOnlyTestVersions[fwdIndex]));
      assert.equal(readOnlyTestElementCounts[fwdIndex], getElementCount(iModelPullOnly));
    }

    const file1 = iModelPullAndPush.pathName;
    const file2 = iModelPullOnly.pathName;
    iModelPullAndPush.close();
    iModelPullOnly.close();
    IModelJsFs.unlinkSync(file1);
    IModelJsFs.unlinkSync(file2);
  });

  it("Open iModels with various names causing potential issues on Windows/Unix", async () => {
    const projectId = await HubUtility.queryProjectIdByName(managerRequestContext, testProjectName);
    let iModelName = "iModel Name With Spaces";
    let iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    const args = { requestContext, contextId: projectId, iModelId };
    assert.isDefined(iModelId);
    let iModel = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);

    iModelName = "iModel Name With :\/<>?* Characters";
    iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    iModel = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);

    iModelName = "iModel Name Thats Excessively Long " +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "01234567890123456789"; // 35 + 2*100 + 20 = 255
    // Note: iModelHub does not accept a name that's longer than 255 characters.
    assert.equal(255, iModelName.length);
    iModelId = await createIModelOnHub(managerRequestContext, projectId, iModelName);
    assert.isDefined(iModelId);
    iModel = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);
  });

  it("should set appropriate briefcase ids for FixedVersion, PullOnly and PullAndPush workflows", async () => {
    const args = { requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, deleteFirst: true };
    const iModel1 = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.equal(BriefcaseIdValue.Standalone, iModel1.nativeDb.getBriefcaseId(), "checkpoint should be 0");

    const iModel2 = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    assert.equal(BriefcaseIdValue.Standalone, iModel2.briefcaseId, "pullOnly should be 0");

    const iModel3 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    assert.isTrue(iModel3.briefcaseId >= BriefcaseIdValue.FirstValid && iModel3.briefcaseId <= BriefcaseIdValue.LastValid, "valid briefcaseId");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel1);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel2);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel3);
  });

  it("should reuse a briefcaseId when re-opening iModels for pullAndPush workflows", async () => {
    const args = { requestContext, contextId: testProjectId, iModelId: readOnlyTestIModel.id, deleteFirst: true };
    const iModel1 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseId1: number = iModel1.briefcaseId;
    iModel1.close(); // Keeps the briefcase by default

    const iModel3 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseId3: number = iModel3.briefcaseId;
    assert.strictEqual(briefcaseId3, briefcaseId1);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel3);
  });

  it("should reuse a briefcaseId when re-opening iModels of different versions for pullAndPush and pullOnly workflows", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager);
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager);

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "BriefcaseReuseTest");
    await testUtility.createTestIModel();

    // User2 opens and then closes the iModel pullOnly/pullPush, keeping the briefcase
    const args = { requestContext: userContext2, contextId: testUtility.projectId, iModelId: testUtility.iModelId };
    const iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseIdPullAndPush: number = iModelPullAndPush.briefcaseId;
    const changeSetIdPullAndPush = iModelPullAndPush.changeSetId;
    iModelPullAndPush.close();

    const iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    const briefcaseIdPullOnly: number = iModelPullOnly.briefcaseId;
    const changeSetIdPullOnly = iModelPullOnly.changeSetId;
    iModelPullOnly.close();

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User 2 reopens the iModel pullOnly/pullPush => Expect the same briefcase to be re-used, but the changeSet should have been updated!!
    const iModelPullAndPush2 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseIdPullAndPush2: number = iModelPullAndPush2.briefcaseId;
    assert.strictEqual(briefcaseIdPullAndPush2, briefcaseIdPullAndPush);
    const changeSetIdPullAndPush2 = iModelPullAndPush2.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush2, changeSetIdPullAndPush);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullAndPush2);

    const iModelPullOnly2 = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    const briefcaseIdPullOnly2: number = iModelPullOnly2.briefcaseId;
    assert.strictEqual(briefcaseIdPullOnly2, briefcaseIdPullOnly);
    const changeSetIdPullOnly2 = iModelPullOnly2.changeSetId;
    assert.notStrictEqual(changeSetIdPullOnly2, changeSetIdPullOnly);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullOnly2);

    // Delete iModel from the Hub and disk
    await testUtility.deleteTestIModel();
  });

  it("should not be able to edit PullOnly briefcases", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager); // User1 is just used to create and update the iModel
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "PullOnlyTest");
    await testUtility.createTestIModel();

    const args = { requestContext: userContext2, contextId: testUtility.projectId, iModelId: testUtility.iModelId, briefcaseId: 0 };

    // User2 opens the iModel pullOnly and is not able to edit (even if the db is opened read-write!)
    let iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc(args);
    assert.exists(iModelPullOnly);
    assert.isTrue(!iModelPullOnly.isReadonly);
    assert.isTrue(iModelPullOnly.isOpen);
    assert.equal(iModelPullOnly.openMode, OpenMode.ReadWrite);

    const briefcaseId = iModelPullOnly.briefcaseId;
    const pathname = iModelPullOnly.pathName;

    const rootEl: Element = iModelPullOnly.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    let errorThrown1 = false;
    try {
      await iModelPullOnly.concurrencyControl.requestResourcesForUpdate(userContext2, [rootEl]);
    } catch (err) {
      errorThrown1 = err instanceof IModelError && err.errorNumber === IModelStatus.NotOpenForWrite;
    }
    assert.isTrue(errorThrown1);

    let errorThrown2 = false;
    try {
      iModelPullOnly.elements.updateElement(rootEl);
    } catch (err) {
      errorThrown2 = true;
    }
    assert.isTrue(errorThrown2);

    iModelPullOnly.close();

    // User2 should be able to re-open the iModel pullOnly again
    iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const changeSetIdPullAndPush = iModelPullOnly.changeSetId;
    assert.strictEqual(iModelPullOnly.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.pathName, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullOnly.nativeDb.hasPendingTxns());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should not be able to re-open the iModel since it's still open
    try {
      await IModelTestUtils.openBriefcaseUsingRpc(args);
    } catch (error) {
      assert.isTrue(error instanceof IModelError && error.errorNumber === IModelStatus.AlreadyOpen);
      errorThrown2 = true;
    }
    assert.isTrue(errorThrown2);

    // User2 closes and reopens the iModel pullOnly as of the newer version
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    iModelPullOnly.close();
    iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const changeSetIdPullAndPush3 = iModelPullOnly.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush3, changeSetIdPullAndPush);
    assert.strictEqual(iModelPullOnly.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullOnly.pathName, pathname);
    assert.isFalse(iModelPullOnly.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullOnly.nativeDb.hasPendingTxns());

    // User1 pushes another change set
    await testUtility.pushTestChangeSet();

    // User2 should be able pull and merge changes
    await iModelPullOnly.pullAndMergeChanges(userContext2, IModelVersion.latest());
    const changeSetIdPullAndPush4 = iModelPullOnly.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush4, changeSetIdPullAndPush3);

    // User2 should NOT be able to push the changes
    let errorThrown = false;
    try {
      await iModelPullOnly.pushChanges(userContext2, "test change");
    } catch (err) {
      errorThrown = true;
    }
    assert.isTrue(errorThrown);

    // Delete iModel from the Hub and disk
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullOnly);
    await testUtility.deleteTestIModel();
  });

  it("should be able to edit a PullAndPush briefcase, reopen it as of a new version, and then push changes", async () => {
    const userContext1 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.manager); // User1 is just used to create and update the iModel
    const userContext2 = await TestUtility.getAuthorizedClientRequestContext(TestUsers.superManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userContext1, "PullAndPushTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullAndPush and is able to edit and save changes
    const args = { requestContext: userContext2, contextId: testUtility.projectId, iModelId: testUtility.iModelId };
    let iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    assert.exists(iModelPullAndPush);
    const briefcaseId = iModelPullAndPush.briefcaseId;
    const pathname = iModelPullAndPush.pathName;

    const rootEl: Element = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    await iModelPullAndPush.concurrencyControl.requestResourcesForUpdate(userContext2, [rootEl]);
    iModelPullAndPush.elements.updateElement(rootEl);

    await iModelPullAndPush.concurrencyControl.request(userContext2);
    assert.isTrue(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullAndPush.nativeDb.hasPendingTxns());
    iModelPullAndPush.saveChanges();
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    iModelPullAndPush.close();

    // User2 should be able to re-open the iModel pullAndPush again
    // - the changes will still be there
    iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const changeSetIdPullAndPush = iModelPullAndPush.changeSetId;
    assert.strictEqual(iModelPullAndPush.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.pathName, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should be able to re-open the iModel
    await IModelTestUtils.openBriefcaseUsingRpc(args);

    // User2 closes and reopens the iModel pullAndPush as of the newer version
    // - the changes will still be there, AND
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    iModelPullAndPush.close();
    iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const changeSetIdPullAndPush3 = iModelPullAndPush.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush3, changeSetIdPullAndPush);
    assert.strictEqual(iModelPullAndPush.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.pathName, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User2 should be able to push the changes now
    await iModelPullAndPush.pushChanges(userContext2, "test change");
    const changeSetIdPullAndPush4 = iModelPullAndPush.changeSetId;
    assert.notStrictEqual(changeSetIdPullAndPush4, changeSetIdPullAndPush3);

    // Delete iModel from the Hub and disk
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userContext2, iModelPullAndPush);
    await testUtility.deleteTestIModel();
  });

  it("should be able to show progress when downloading a briefcase (#integration)", async () => {
    const testIModelName = "Stadium Dataset 1";
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);

    let numProgressCalls: number = 0;

    readline.clearLine(process.stdout, 0);
    readline.moveCursor(process.stdout, -20, 0);
    const downloadProgress = (loaded: number, total: number) => {
      const message = `${testIModelName} Download Progress ... ${(loaded * 100 / total).toFixed(2)}%`;
      process.stdout.write(message);
      readline.moveCursor(process.stdout, -1 * message.length, 0);
      if (loaded >= total) {
        process.stdout.write(os.EOL);
      }
      numProgressCalls++;
      return 0;
    };

    const args = {
      contextId: testProjectId,
      iModelId: testIModelId,
      briefcaseId: 0,
      onProgress: downloadProgress,
    };
    const fileName = BriefcaseManager.getFileName(args);
    await BriefcaseManager.deleteBriefcaseFiles(fileName, requestContext);

    const props = await BriefcaseManager.downloadBriefcase(requestContext, args);
    requestContext.enter();

    const iModel = await BriefcaseDb.open(requestContext, { fileName: props.fileName });
    requestContext.enter();

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);
    assert.isTrue(numProgressCalls > 19000);
  });

  it("Should be able to cancel an in progress download (#integration)", async () => {
    const testIModelName = "Stadium Dataset 1";
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);

    let aborted = 0;
    const args = {
      contextId: testProjectId,
      iModelId: testIModelId,
      briefcaseId: 0,
      onProgress: (_loaded: number, _total: number) => {
        return aborted;
      },
    };
    await BriefcaseManager.deleteBriefcaseFiles(BriefcaseManager.getFileName(args), requestContext);

    const downloadPromise = BriefcaseManager.downloadBriefcase(requestContext, args);
    requestContext.enter();

    setTimeout(async () => {
      aborted = 1;
      requestContext.enter();
    }, 1000);

    let cancelled2: boolean = false;
    try {
      await downloadPromise;
      requestContext.enter();
    } catch (err) {
      requestContext.enter();
      assert.equal(err.errorNumber, BriefcaseStatus.DownloadCancelled);
      assert.isTrue(err instanceof UserCancelledError);
      cancelled2 = true;
    }

    assert.isTrue(cancelled2);
  });

});
