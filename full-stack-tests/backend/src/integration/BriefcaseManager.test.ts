/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as os from "os";
import * as readline from "readline";
import * as sinon from "sinon";
import { AccessToken, BriefcaseStatus, GuidString, StopWatch } from "@itwin/core-bentley";
import { BriefcaseIdValue, BriefcaseProps, IModelError, IModelVersion } from "@itwin/core-common";
import { BriefcaseDb, BriefcaseManager, CheckpointManager, IModelHost, IModelJsFs, RequestNewBriefcaseArg, V2CheckpointManager } from "@itwin/core-backend";
import { HubWrappers } from "@itwin/core-backend/lib/cjs/test/index";
import { HubUtility, TestUserType } from "../HubUtility";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

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

describe("BriefcaseManager", () => {
  let testITwinId: string;

  let readOnlyTestIModelId: GuidString;
  let accessToken: AccessToken;

  before(async () => {
    accessToken = await HubUtility.getAccessToken(TestUserType.Regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);
    readOnlyTestIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
  });

  after(async () => {
    V2CheckpointManager.cleanup();
  });

  it("should be able to reverse apply changesets and maintain changeset indices", async () => {
    const testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
    const changesetId = "1b186c485d182c46c02b99aff4fb12637263438f";
    const args: RequestNewBriefcaseArg = {
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      briefcaseId: BriefcaseIdValue.Unassigned,
      asOf: {afterChangeSetId: changesetId},
    };
    const props = await BriefcaseManager.downloadBriefcase(args);
    const iModel = await BriefcaseDb.open({
      fileName: props.fileName,
      readonly: true,
    });

    expect(iModel.changeset.id).to.equal(changesetId);
    expect(iModel.changeset.index).to.equal(4);
    let index = 3;
    await iModel.pullChanges({ accessToken, toIndex: index });
    expect(iModel.changeset.index).to.equal(index);
    index = 2;
    await iModel.pullChanges({ accessToken, toIndex: index });
    expect(iModel.changeset.index).to.equal(index);
    index = 4;
    await iModel.pullChanges({ accessToken, toIndex: index });
    expect(iModel.changeset.index).to.equal(index);
    expect(iModel.changeset.id).to.equal(changesetId);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);
  });

  it("should open and close an iModel from the Hub", async () => {
    const iModel = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.first().toJSON(), deleteFirst: true });
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

    // Validate that the IModelDb is readonly
    assert(iModel.isReadonly, "iModel not set to Readonly mode");

    const expectedChangeSet = await IModelHost.hubAccess.getChangesetFromVersion({ version: IModelVersion.first(), accessToken, iModelId: readOnlyTestIModelId });
    assert.strictEqual(iModel.changeset.id, expectedChangeSet.id);
    assert.strictEqual(iModel.changeset.id, expectedChangeSet.id);

    // the v2 checkpoint should be opened directly
    // Convert to UNIX path separators on Windows for consistent results.
    const actualPathName = iModel.pathName.replace(/\\/g, "/");
    const expectedPathName = `/imodelblocks-73c9d3f0-3a47-41d6-8d2a-c0b0e4099f6a/BASELINE.bim`;
    expect(actualPathName).equals(expectedPathName);
    iModel.close();
  });

  it("should reuse checkpoints", async () => {
    const iModel1 = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel1, "No iModel returned from call to BriefcaseManager.open");

    const iModel2 = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel2, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel1, iModel2, "previously open briefcase was expected to be shared");

    const iModel3 = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("SecondVersion").toJSON() });
    assert.exists(iModel3, "No iModel returned from call to BriefcaseManager.open");
    assert.notEqual(iModel3, iModel2, "opening two different versions should not cause briefcases to be shared when the older one is open");

    const pathname2 = iModel2.pathName;
    iModel2.close();
    assert.isTrue(IModelJsFs.existsSync(pathname2));

    const pathname3 = iModel3.pathName;
    iModel3.close();
    assert.isTrue(IModelJsFs.existsSync(pathname3));

    const iModel4 = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("FirstVersion").toJSON() });
    assert.exists(iModel4, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel4.pathName, pathname2, "previously closed briefcase was expected to be shared");

    const iModel5 = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named("SecondVersion").toJSON() });
    assert.exists(iModel5, "No iModel returned from call to BriefcaseManager.open");
    assert.equal(iModel5.pathName, pathname3, "previously closed briefcase was expected to be shared");

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel4);
    assert.isFalse(IModelJsFs.existsSync(pathname2));

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel5);
    assert.isFalse(IModelJsFs.existsSync(pathname3));
  });

  it("should be able to show progress when downloading a briefcase (#integration)", async () => {
    const testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
    let numProgressCalls = 0;

    readline.clearLine(process.stdout, 0);
    readline.moveCursor(process.stdout, -20, 0);
    let done = 0;
    let complete = 0;
    let last = -1;
    const downloadProgress = (loaded: number, total: number) => {
      if (total > 0 && loaded !== last) {
        last = loaded;
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

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);
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
    await expect(downloadPromise).to.eventually.be.rejectedWith("cancelled").have.property("errorNumber", BriefcaseStatus.DownloadCancelled);
  });

  it("Should be able to delete the briefcase .bim file on a failed download", async () => {
    const testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
    const args: RequestNewBriefcaseArg & BriefcaseProps = {
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      briefcaseId: BriefcaseIdValue.Unassigned,
    };
    const fileName = BriefcaseManager.getFileName(args);
    await BriefcaseManager.deleteBriefcaseFiles(fileName);
    sinon.stub(CheckpointManager, "downloadCheckpoint").throws(new Error("testError"));
    const downloadPromise = BriefcaseManager.downloadBriefcase({...args, fileName});
    await expect(downloadPromise).to.eventually.be.rejectedWith("testError");
    expect(IModelJsFs.existsSync(fileName)).to.be.false;
    sinon.restore();
  });

});
