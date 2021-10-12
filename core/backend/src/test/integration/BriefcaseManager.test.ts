/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as os from "os";
import * as readline from "readline";
import { AccessToken, BriefcaseStatus, GuidString, StopWatch } from "@itwin/core-bentley";
import { BriefcaseIdValue, BriefcaseProps, IModelError, IModelVersion } from "@itwin/core-common";
import { UserCancelledError } from "@bentley/itwin-client";
import { BriefcaseDb, BriefcaseManager, Element, IModelHost, IModelJsFs } from "../../core-backend";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";
import { TestChangeSetUtility } from "./TestChangeSetUtility";
import { RequestNewBriefcaseArg } from "../../BriefcaseManager";

// Configuration needed:
//    IMJS_TEST_REGULAR_USER_NAME
//    IMJS_TEST_REGULAR_USER_PASSWORD
//    IMJS_TEST_MANAGER_USER_NAME
//    IMJS_TEST_MANAGER_USER_PASSWORD
//    IMJS_TEST_SUPER_MANAGER_USER_NAME
//    imjs_test_super_manager_password
//    imjs_test_imodelhub_user_name
//    imjs_test_imodelhub_user_password
//    IMJS_OIDC_BROWSER_TEST_CLIENT_ID
//      - Required to be a SPA
//    IMJS_OIDC_BROWSER_TEST_REDIRECT_URI
//    IMJS_OIDC_BROWSER_TEST_SCOPES
//      - Required scopes: "openid imodelhub context-registry-service:read-only"

describe("BriefcaseManager (#integration)", () => {
  let testITwinId: string;

  let readOnlyTestIModelId: GuidString;
  const readOnlyTestVersions = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const readOnlyTestElementCounts = [27, 28, 29];

  let noVersionsTestIModelId: GuidString;
  let accessToken: AccessToken;
  let managerAccessToken: AccessToken;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();

    accessToken = await IModelTestUtils.getAccessToken(TestUserType.Regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);
    readOnlyTestIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
    noVersionsTestIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readWrite);
  });

  it("should open and close an iModel from the Hub", async () => {
    const iModel = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.first().toJSON(), deleteFirst: true });
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

    // Validate that the IModelDb is readonly
    assert(iModel.isReadonly, "iModel not set to Readonly mode");

    const expectedChangeSet = await IModelHost.hubAccess.getChangesetFromVersion({ version: IModelVersion.first(), accessToken, iModelId: readOnlyTestIModelId });
    assert.strictEqual(iModel.changeset.id, expectedChangeSet.id);
    assert.strictEqual(iModel.changeset.id, expectedChangeSet.id);

    const pathname = iModel.pathName;
    assert.isTrue(IModelJsFs.existsSync(pathname));
    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel);

    assert.isFalse(IModelJsFs.existsSync(pathname), `Briefcase continues to exist at ${pathname}`);
  });

  it("should reuse checkpoints", async () => {
    const iModel1 = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel1, iModel2, "previously open briefcase was expected to be shared");

    const iModel3 = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("SecondVersion").toJSON() });
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.notEqual(iModel3, iModel2, "opening two different versions should not cause briefcases to be shared when the older one is open");

    const pathname2 = iModel2.pathName;
    iModel2.close();
    assert.isTrue(IModelJsFs.existsSync(pathname2));

    const pathname3 = iModel3.pathName;
    iModel3.close();
    assert.isTrue(IModelJsFs.existsSync(pathname3));

    const iModel4 = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel4, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel4.pathName, pathname2, "previously closed briefcase was expected to be shared");

    const iModel5 = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("SecondVersion").toJSON() });
    assert.exists(iModel5, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel5.pathName, pathname3, "previously closed briefcase was expected to be shared");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel4);
    assert.isFalse(IModelJsFs.existsSync(pathname2));

    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel5);
    assert.isFalse(IModelJsFs.existsSync(pathname3));
  });

  it("should open iModels of specific versions from the Hub", async () => {
    const dirToPurge = BriefcaseManager.getIModelPath(readOnlyTestIModelId);
    IModelJsFs.purgeDirSync(dirToPurge);

    const iModelFirstVersion = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.first().toJSON(), deleteFirst: true });
    assert.exists(iModelFirstVersion);
    assert.strictEqual(iModelFirstVersion.changeset.id, "");

    const changeSets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: readOnlyTestIModelId });

    for (const [arrayIndex, versionName] of readOnlyTestVersions.entries()) {
      const iModelFromVersion = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.asOfChangeSet(changeSets[arrayIndex + 1].id).toJSON() });
      assert.exists(iModelFromVersion);
      assert.strictEqual(iModelFromVersion.changeset.id, changeSets[arrayIndex + 1].id);

      const iModelFromChangeSet = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named(versionName).toJSON() });
      assert.exists(iModelFromChangeSet);
      assert.strictEqual(iModelFromChangeSet, iModelFromVersion);
      assert.strictEqual(iModelFromChangeSet.changeset.id, changeSets[arrayIndex + 1].id);

      const elementCount = iModelFromVersion.withStatement("SELECT COUNT(*) FROM bis.Element", (stmt) => {
        stmt.step();
        return stmt.getValue(0).getInteger();
      });
      assert.equal(elementCount, readOnlyTestElementCounts[arrayIndex], `Count isn't what's expected for ${iModelFromVersion.pathName}, version ${versionName}`);

      iModelFromVersion.close();
      iModelFromChangeSet.close();
    }

    const iModelLatestVersion = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, deleteFirst: true });
    assert.isDefined(iModelLatestVersion);
    assert.strictEqual(iModelLatestVersion.nativeDb.getCurrentChangeset().id, changeSets[3].id);

    assert.equal(iModelLatestVersion.nativeDb.getCurrentChangeset().index, changeSets[3].index);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModelFirstVersion);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModelLatestVersion);
  });

  it("should open an iModel with no versions", async () => {
    const iModelNoVer = await IModelTestUtils.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: noVersionsTestIModelId });
    assert.exists(iModelNoVer);
    assert(iModelNoVer.iModelId === noVersionsTestIModelId, "Correct iModel not found");
  });

  it("Open iModels with various names causing potential issues on Windows/Unix", async () => {
    HubMock.startup("bad names");
    let iModelName = "iModel Name With Spaces";
    let iModelId = await HubUtility.createIModel(managerAccessToken, testITwinId, iModelName);
    const args = { accessToken, iTwinId: testITwinId, iModelId };
    assert.isDefined(iModelId);
    let iModel = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);

    iModelName = "iModel Name With :\/<>?* Characters";
    iModelId = await HubUtility.createIModel(managerAccessToken, testITwinId, iModelName);
    assert.isDefined(iModelId);
    iModel = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);

    iModelName = "iModel Name Thats Excessively Long " +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "01234567890123456789"; // 35 + 2*100 + 20 = 255
    // Note: iModelHub does not accept a name that's longer than 255 characters.
    assert.equal(255, iModelName.length);
    iModelId = await HubUtility.createIModel(managerAccessToken, testITwinId, iModelName);
    assert.isDefined(iModelId);
    iModel = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);
    iModel.close();
    HubMock.shutdown();
  });

  it("should set appropriate briefcase ids for FixedVersion, PullOnly and PullAndPush workflows", async () => {
    HubMock.startup("briefcaseIds");
    const iModelId = await HubUtility.createIModel(accessToken, testITwinId, "imodel1");
    const args = { accessToken, iTwinId: testITwinId, iModelId, deleteFirst: true };
    const iModel1 = await IModelTestUtils.openCheckpointUsingRpc(args);
    assert.equal(BriefcaseIdValue.Unassigned, iModel1.nativeDb.getBriefcaseId(), "checkpoint should be 0");

    const iModel2 = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    assert.equal(BriefcaseIdValue.Unassigned, iModel2.briefcaseId, "pullOnly should be 0");

    const iModel3 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    assert.isTrue(iModel3.briefcaseId >= BriefcaseIdValue.FirstValid && iModel3.briefcaseId <= BriefcaseIdValue.LastValid, "valid briefcaseId");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel1);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel2);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel3);
    HubMock.shutdown();
  });

  it("should reuse a briefcaseId when re-opening iModels for pullAndPush workflows", async () => {
    HubMock.startup("briefcaseIdsReopen");
    const iModelId = await HubUtility.createIModel(accessToken, testITwinId, "imodel1");

    const args = { accessToken, iTwinId: testITwinId, iModelId, deleteFirst: false };
    const iModel1 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseId1 = iModel1.briefcaseId;
    iModel1.close(); // Keeps the briefcase by default

    const iModel3 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseId3 = iModel3.briefcaseId;
    assert.strictEqual(briefcaseId3, briefcaseId1);

    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel3);
    HubMock.shutdown();
  });

  it("should reuse a briefcaseId when re-opening iModels of different versions for pullAndPush and pullOnly workflows", async () => {
    HubMock.startup("workflow");
    const userToken1 = await IModelTestUtils.getAccessToken(TestUserType.Manager);
    const userToken2 = await IModelTestUtils.getAccessToken(TestUserType.SuperManager);

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userToken1, HubUtility.generateUniqueName("BriefcaseReuseTest"));
    await testUtility.createTestIModel();

    // User2 opens and then closes the iModel pullOnly/pullPush, keeping the briefcase
    const args = { accessToken: userToken2, iTwinId: testUtility.iTwinId, iModelId: testUtility.iModelId };
    const iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseIdPullAndPush: number = iModelPullAndPush.briefcaseId;
    const changesetPullAndPush = iModelPullAndPush.changeset;
    iModelPullAndPush.close();

    const iModelPullOnly = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    const briefcaseIdPullOnly: number = iModelPullOnly.briefcaseId;
    const changesetPullOnly = iModelPullOnly.changeset;
    iModelPullOnly.close();

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User 2 reopens the iModel pullOnly/pullPush => Expect the same briefcase to be re-used, but the changeSet should have been updated!!
    const iModelPullAndPush2 = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const briefcaseIdPullAndPush2: number = iModelPullAndPush2.briefcaseId;
    assert.strictEqual(briefcaseIdPullAndPush2, briefcaseIdPullAndPush);
    const changesetPullAndPush2 = iModelPullAndPush2.changeset;
    assert.notStrictEqual(changesetPullAndPush2, changesetPullAndPush);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userToken2, iModelPullAndPush2);

    const iModelPullOnly2 = await IModelTestUtils.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    const briefcaseIdPullOnly2: number = iModelPullOnly2.briefcaseId;
    assert.strictEqual(briefcaseIdPullOnly2, briefcaseIdPullOnly);
    const changesetPullOnly2 = iModelPullOnly2.changeset;
    assert.notStrictEqual(changesetPullOnly2, changesetPullOnly);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userToken2, iModelPullOnly2);

    // Delete iModel from the Hub and disk
    await testUtility.deleteTestIModel();
    HubMock.shutdown();
  });

  it("should be able to edit a PullAndPush briefcase, reopen it as of a new version, and then push changes", async () => {
    HubMock.startup("pullPush");
    const userToken1 = await IModelTestUtils.getAccessToken(TestUserType.Manager); // User1 is just used to create and update the iModel
    const userToken2 = await IModelTestUtils.getAccessToken(TestUserType.SuperManager); // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userToken1, "PullAndPushTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullAndPush and is able to edit and save changes
    const args = { accessToken: userToken2, iTwinId: testUtility.iTwinId, iModelId: testUtility.iModelId };
    let iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    assert.exists(iModelPullAndPush);
    const briefcaseId = iModelPullAndPush.briefcaseId;
    const pathname = iModelPullAndPush.pathName;

    const rootEl: Element = iModelPullAndPush.elements.getRootSubject();
    rootEl.userLabel = `${rootEl.userLabel}changed`;
    iModelPullAndPush.elements.updateElement(rootEl);

    assert.isTrue(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isFalse(iModelPullAndPush.nativeDb.hasPendingTxns());
    iModelPullAndPush.saveChanges();
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    iModelPullAndPush.close();

    // User2 should be able to re-open the iModel pullAndPush again
    // - the changes will still be there
    iModelPullAndPush = await IModelTestUtils.openBriefcaseUsingRpc(args);
    const changesetPullAndPush = iModelPullAndPush.changeset;
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
    const changesetPullAndPush3 = iModelPullAndPush.changeset;
    assert.notStrictEqual(changesetPullAndPush3, changesetPullAndPush);
    assert.strictEqual(iModelPullAndPush.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.pathName, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User2 should be able to push the changes now
    await iModelPullAndPush.pushChanges({ accessToken: userToken2, description: "test change" });
    const changesetPullAndPush4 = iModelPullAndPush.changeset;
    assert.notStrictEqual(changesetPullAndPush4, changesetPullAndPush3);

    // Delete iModel from the Hub and disk
    await IModelTestUtils.closeAndDeleteBriefcaseDb(userToken2, iModelPullAndPush);
    await testUtility.deleteTestIModel();
    HubMock.shutdown();
  });

  it("should be able to show progress when downloading a briefcase (#integration)", async () => {
    const testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);

    let numProgressCalls = 0;

    readline.clearLine(process.stdout, 0);
    readline.moveCursor(process.stdout, -20, 0);
    let done = 0;
    let complete = 0;
    const downloadProgress = (loaded: number, total: number) => {
      if (total > 0) {
        const message = `${HubUtility.testIModelNames.stadium} Download Progress ... ${(loaded * 100 / total).toFixed(2)}%`;
        process.stdout.write(message);
        readline.moveCursor(process.stdout, -1 * message.length, 0);
        if (loaded >= total)
          process.stdout.write(os.EOL);
        numProgressCalls++;
        done = loaded;
        complete = total;
      }
      return 0;
    };

    const args: RequestNewBriefcaseArg & BriefcaseProps = {
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      briefcaseId: BriefcaseIdValue.Unassigned,
      onProgress: downloadProgress,
    };
    const fileName = BriefcaseManager.getFileName(args);
    await BriefcaseManager.deleteBriefcaseFiles(fileName);
    const watch = new StopWatch("download", true);
    const props = await BriefcaseManager.downloadBriefcase(args);
    // eslint-disable-next-line no-console
    console.log(`download took ${watch.elapsedSeconds} seconds`);
    const iModel = await BriefcaseDb.open({ fileName: props.fileName });

    await expect(BriefcaseManager.downloadBriefcase(args)).to.be.rejectedWith(IModelError, "already exists", "should not be able to download a briefcase if a file with that name already exists");

    await IModelTestUtils.closeAndDeleteBriefcaseDb(accessToken, iModel);
    assert.isAbove(numProgressCalls, 0, "download progress called");
    assert.isAbove(done, 0, "done set");
    assert.isAbove(complete, 0, "complete set");
  });

  it("Should be able to cancel an in progress download (#integration)", async () => {
    const testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
    let aborted = 0;

    const args = {
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      briefcaseId: BriefcaseIdValue.Unassigned,
      onProgress: () => aborted,
    };
    await BriefcaseManager.deleteBriefcaseFiles(BriefcaseManager.getFileName(args), accessToken);

    const downloadPromise = BriefcaseManager.downloadBriefcase(args);
    setTimeout(async () => aborted = 1, 1000);
    await expect(downloadPromise).to.be.rejectedWith(UserCancelledError).to.eventually.have.property("errorNumber", BriefcaseStatus.DownloadCancelled);
  });

});
