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
import { BriefcaseDb, BriefcaseManager, IModelHost, IModelJsFs, RequestNewBriefcaseArg } from "@itwin/core-backend";
import { HubWrappers } from "@itwin/core-backend/lib/cjs/test/index";
import { HubUtility, TestUserType } from "../HubUtility";

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
  const readOnlyTestVersions = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const readOnlyTestElementCounts = [27, 28, 29];

  let noVersionsTestIModelId: GuidString;
  let accessToken: AccessToken;

  before(async () => {
    accessToken = await HubUtility.getAccessToken(TestUserType.Regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);
    readOnlyTestIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
    noVersionsTestIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readWrite);
  });

  it("should open and close an iModel from the Hub", async () => {
    const iModel = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.first().toJSON(), deleteFirst: true });
    assert.exists(iModel, "No iModel returned from call to BriefcaseManager.open");

    // Validate that the IModelDb is readonly
    assert(iModel.isReadonly, "iModel not set to Readonly mode");

    const expectedChangeSet = await IModelHost.hubAccess.getChangesetFromVersion({ version: IModelVersion.first(), accessToken, iModelId: readOnlyTestIModelId });
    assert.strictEqual(iModel.changeset.id, expectedChangeSet.id);
    assert.strictEqual(iModel.changeset.id, expectedChangeSet.id);

    const pathname = iModel.pathName;
    assert.isTrue(IModelJsFs.existsSync(pathname));
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);

    assert.isFalse(IModelJsFs.existsSync(pathname), `Briefcase continues to exist at ${pathname}`);
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

  it("should open iModels of specific versions from the Hub", async () => {
    const dirToPurge = BriefcaseManager.getIModelPath(readOnlyTestIModelId);
    IModelJsFs.purgeDirSync(dirToPurge);

    const iModelFirstVersion = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.first().toJSON(), deleteFirst: true });
    assert.exists(iModelFirstVersion);
    assert.strictEqual(iModelFirstVersion.changeset.id, "");

    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId: readOnlyTestIModelId });

    for (const [arrayIndex, versionName] of readOnlyTestVersions.entries()) {
      const iModelFromVersion = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.asOfChangeSet(changesets[arrayIndex + 1].id).toJSON() });
      assert.exists(iModelFromVersion);
      assert.strictEqual(iModelFromVersion.changeset.id, changesets[arrayIndex + 1].id);

      const iModelFromChangeSet = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, asOf: IModelVersion.named(versionName).toJSON() });
      assert.exists(iModelFromChangeSet);
      assert.strictEqual(iModelFromChangeSet, iModelFromVersion);
      assert.strictEqual(iModelFromChangeSet.changeset.id, changesets[arrayIndex + 1].id);

      const elementCount = iModelFromVersion.withStatement("SELECT COUNT(*) FROM bis.Element", (stmt) => {
        stmt.step();
        return stmt.getValue(0).getInteger();
      });
      assert.equal(elementCount, readOnlyTestElementCounts[arrayIndex], `Count isn't what's expected for ${iModelFromVersion.pathName}, version ${versionName}`);

      iModelFromVersion.close();
      iModelFromChangeSet.close();
    }

    const iModelLatestVersion = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: readOnlyTestIModelId, deleteFirst: true });
    assert.isDefined(iModelLatestVersion);
    assert.strictEqual(iModelLatestVersion.nativeDb.getCurrentChangeset().id, changesets[3].id);

    assert.equal(iModelLatestVersion.nativeDb.getCurrentChangeset().index, changesets[3].index);

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModelFirstVersion);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModelLatestVersion);
  });

  it("should open an iModel with no versions", async () => {
    const iModelNoVer = await HubWrappers.openCheckpointUsingRpc({ accessToken, iTwinId: testITwinId, iModelId: noVersionsTestIModelId });
    assert.exists(iModelNoVer);
    assert(iModelNoVer.iModelId === noVersionsTestIModelId, "Correct iModel not found");
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
    await expect(downloadPromise).to.be.rejectedWith(UserCancelledError).to.eventually.have.property("errorNumber", BriefcaseStatus.DownloadCancelled);
  });

});
