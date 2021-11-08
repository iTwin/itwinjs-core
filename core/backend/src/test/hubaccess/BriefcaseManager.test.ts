/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Guid } from "@itwin/core-bentley";
import { BriefcaseIdValue } from "@itwin/core-common";
import { HubWrappers, TestChangeSetUtility } from "..";
import { Element } from "../../Element";
import { HubMock } from "../HubMock";
import { IModelTestUtils } from "../IModelTestUtils";

describe("BriefcaseManager", async () => {
  const testITwinId: string = Guid.createValue();
  const managerAccessToken = "manager mock token";
  const accessToken = "access token";

  it("Open iModels with various names causing potential issues on Windows/Unix", async () => {
    HubMock.startup("bad names");
    let iModelName = "iModel Name With Spaces";
    let iModelId = await HubWrappers.createIModel(managerAccessToken, testITwinId, iModelName);
    const args = { accessToken, iTwinId: testITwinId, iModelId };
    assert.isDefined(iModelId);
    let iModel = await HubWrappers.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);

    iModelName = "iModel Name With :\/<>?* Characters";
    iModelId = await HubWrappers.createIModel(managerAccessToken, testITwinId, iModelName);
    assert.isDefined(iModelId);
    iModel = await HubWrappers.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);

    iModelName = "iModel Name Thats Excessively Long " +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789" +
      "01234567890123456789"; // 35 + 2*100 + 20 = 255
    // Note: iModelHub does not accept a name that's longer than 255 characters.
    assert.equal(255, iModelName.length);
    iModelId = await HubWrappers.createIModel(managerAccessToken, testITwinId, iModelName);
    assert.isDefined(iModelId);
    iModel = await HubWrappers.openCheckpointUsingRpc(args);
    assert.isDefined(iModel);
    iModel.close();
    HubMock.shutdown();
  });

  it("should set appropriate briefcase ids for FixedVersion, PullOnly and PullAndPush workflows", async () => {
    HubMock.startup("briefcaseIds");
    const iModelId = await HubWrappers.createIModel(accessToken, testITwinId, "imodel1");
    const args = { accessToken, iTwinId: testITwinId, iModelId, deleteFirst: true };
    const iModel1 = await HubWrappers.openCheckpointUsingRpc(args);
    assert.equal(BriefcaseIdValue.Unassigned, iModel1.nativeDb.getBriefcaseId(), "checkpoint should be 0");

    const iModel2 = await HubWrappers.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    assert.equal(BriefcaseIdValue.Unassigned, iModel2.briefcaseId, "pullOnly should be 0");

    const iModel3 = await HubWrappers.openBriefcaseUsingRpc(args);
    assert.isTrue(iModel3.briefcaseId >= BriefcaseIdValue.FirstValid && iModel3.briefcaseId <= BriefcaseIdValue.LastValid, "valid briefcaseId");

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel1);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel2);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel3);
    HubMock.shutdown();
  });

  it("should reuse a briefcaseId when re-opening iModels for pullAndPush workflows", async () => {
    HubMock.startup("briefcaseIdsReopen");
    const iModelId = await HubWrappers.createIModel(accessToken, testITwinId, "imodel1");

    const args = { accessToken, iTwinId: testITwinId, iModelId, deleteFirst: false };
    const iModel1 = await HubWrappers.openBriefcaseUsingRpc(args);
    const briefcaseId1 = iModel1.briefcaseId;
    iModel1.close(); // Keeps the briefcase by default

    const iModel3 = await HubWrappers.openBriefcaseUsingRpc(args);
    const briefcaseId3 = iModel3.briefcaseId;
    assert.strictEqual(briefcaseId3, briefcaseId1);

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel3);
    HubMock.shutdown();
  });

  it("should reuse a briefcaseId when re-opening iModels of different versions for pullAndPush and pullOnly workflows", async () => {
    HubMock.startup("workflow");
    const userToken1 = "manager token";
    const userToken2 = "super manager token";

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userToken1, IModelTestUtils.generateUniqueName("BriefcaseReuseTest"));
    await testUtility.createTestIModel();

    // User2 opens and then closes the iModel pullOnly/pullPush, keeping the briefcase
    const args = { accessToken: userToken2, iTwinId: testUtility.iTwinId, iModelId: testUtility.iModelId };
    const iModelPullAndPush = await HubWrappers.openBriefcaseUsingRpc(args);
    const briefcaseIdPullAndPush: number = iModelPullAndPush.briefcaseId;
    const changesetPullAndPush = iModelPullAndPush.changeset;
    iModelPullAndPush.close();

    const iModelPullOnly = await HubWrappers.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    const briefcaseIdPullOnly: number = iModelPullOnly.briefcaseId;
    const changesetPullOnly = iModelPullOnly.changeset;
    iModelPullOnly.close();

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User 2 reopens the iModel pullOnly/pullPush => Expect the same briefcase to be re-used, but the changeset should have been updated!!
    const iModelPullAndPush2 = await HubWrappers.openBriefcaseUsingRpc(args);
    const briefcaseIdPullAndPush2: number = iModelPullAndPush2.briefcaseId;
    assert.strictEqual(briefcaseIdPullAndPush2, briefcaseIdPullAndPush);
    const changesetPullAndPush2 = iModelPullAndPush2.changeset;
    assert.notStrictEqual(changesetPullAndPush2, changesetPullAndPush);
    await HubWrappers.closeAndDeleteBriefcaseDb(userToken2, iModelPullAndPush2);

    const iModelPullOnly2 = await HubWrappers.openBriefcaseUsingRpc({ ...args, briefcaseId: 0 });
    const briefcaseIdPullOnly2: number = iModelPullOnly2.briefcaseId;
    assert.strictEqual(briefcaseIdPullOnly2, briefcaseIdPullOnly);
    const changesetPullOnly2 = iModelPullOnly2.changeset;
    assert.notStrictEqual(changesetPullOnly2, changesetPullOnly);
    await HubWrappers.closeAndDeleteBriefcaseDb(userToken2, iModelPullOnly2);

    // Delete iModel from the Hub and disk
    await testUtility.deleteTestIModel();
    HubMock.shutdown();
  });

  it("should be able to edit a PullAndPush briefcase, reopen it as of a new version, and then push changes", async () => {
    HubMock.startup("pullPush");
    const userToken1 = "manager token"; // User1 is just used to create and update the iModel
    const userToken2 = "super manager token"; // User2 is used for the test

    // User1 creates an iModel on the Hub
    const testUtility = new TestChangeSetUtility(userToken1, "PullAndPushTest");
    await testUtility.createTestIModel();

    // User2 opens the iModel pullAndPush and is able to edit and save changes
    const args = { accessToken: userToken2, iTwinId: testUtility.iTwinId, iModelId: testUtility.iModelId };
    let iModelPullAndPush = await HubWrappers.openBriefcaseUsingRpc(args);
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
    iModelPullAndPush = await HubWrappers.openBriefcaseUsingRpc(args);
    const changesetPullAndPush = iModelPullAndPush.changeset;
    assert.strictEqual(iModelPullAndPush.briefcaseId, briefcaseId);
    assert.strictEqual(iModelPullAndPush.pathName, pathname);
    assert.isFalse(iModelPullAndPush.nativeDb.hasUnsavedChanges());
    assert.isTrue(iModelPullAndPush.nativeDb.hasPendingTxns());

    // User1 pushes a change set
    await testUtility.pushTestChangeSet();

    // User2 should be able to re-open the iModel
    await HubWrappers.openBriefcaseUsingRpc(args);

    // User2 closes and reopens the iModel pullAndPush as of the newer version
    // - the changes will still be there, AND
    // - the briefcase will be upgraded to the newer version since it was closed and re-opened.
    iModelPullAndPush.close();
    iModelPullAndPush = await HubWrappers.openBriefcaseUsingRpc(args);
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
    await HubWrappers.closeAndDeleteBriefcaseDb(userToken2, iModelPullAndPush);
    await testUtility.deleteTestIModel();
    HubMock.shutdown();
  });
});
