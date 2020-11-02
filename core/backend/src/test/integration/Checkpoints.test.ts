/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ChildProcess } from "child_process";
import * as path from "path";
import { GuidString } from "@bentley/bentleyjs-core";
import { Checkpoint, CheckpointQuery } from "@bentley/imodelhub-client";
import { BlobDaemon } from "@bentley/imodeljs-native";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { AuthorizedBackendRequestContext, BriefcaseManager, IModelJsFs, SnapshotDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";

// FIXME: Disabled because blockcache checkpoints are not in QA yet...
describe.skip("Checkpoints (#integration)", () => {

  let requestContext: AuthorizedBackendRequestContext;
  const testProjectName = "iModelJsIntegrationTest";
  const testIModelName = "Stadium Dataset 1";
  let testIModelId: GuidString;
  let testProjectId: GuidString;
  let testChangeSetId: GuidString;

  const blockcacheDir = path.join(KnownTestLocations.outputDir, "blockcachevfs");
  let daemonProc: ChildProcess;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };
    process.env.BLOCKCACHE_DIR = blockcacheDir;
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, testProjectName);
    testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);
    testChangeSetId = (await HubUtility.queryLatestChangeSet(requestContext, testIModelId))!.wsgId;

    const checkpointQuery = new CheckpointQuery().byChangeSetId(testChangeSetId).selectBCVAccessKey();
    const checkpoints: Checkpoint[] = await BriefcaseManager.imodelClient.checkpoints.get(requestContext, testIModelId, checkpointQuery);
    assert.equal(checkpoints.length, 1, "checkpoint missing");
    assert.isDefined(checkpoints[0].bcvAccessKeyAccount, "checkpoint storage account is invalid");

    // Start daemon process and wait for it to be ready
    daemonProc = BlobDaemon.start({
      daemonDir: blockcacheDir,
      storageType: "azure?sas=1",
      user: checkpoints[0].bcvAccessKeyAccount!,
    });
    while (!IModelJsFs.existsSync(path.join(blockcacheDir, "portnumber.bcv"))) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  });

  after(async () => {
    process.env = originalEnv;

    if (daemonProc) {
      const onDaemonExit = new Promise((resolve) => daemonProc.once("exit", resolve));
      daemonProc.kill();
      await onDaemonExit;
    }
    (BriefcaseManager as any).deleteFolderAndContents(blockcacheDir);
  });

  it("should be able to open and read blockcache checkpoint", async () => {
    const iModel = await SnapshotDb.openCheckpoint(requestContext, testProjectId, testIModelId, testChangeSetId);
    assert.equal(iModel.getGuid(), testIModelId);
    assert.equal(iModel.changeSetId, testChangeSetId);
    assert.equal(iModel.contextId, testProjectId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    let numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    await iModel.reattachDaemon(requestContext);
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    iModel.close();
  }).timeout(60000);
});
