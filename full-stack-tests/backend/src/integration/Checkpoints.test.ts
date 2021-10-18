/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ChildProcess } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetProps } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { IModelHost, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/KnownTestLocations";
import { HubUtility } from "../HubUtility";

describe.skip("Checkpoints", () => {
  let accessToken: AccessToken;
  let testIModelId: GuidString;
  let testITwinId: GuidString;
  let testChangeSet: ChangesetProps;

  const blockcacheDir = path.join(KnownTestLocations.outputDir, "blockcachevfs");
  let daemonProc: ChildProcess;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };
    process.env.BLOCKCACHE_DIR = blockcacheDir;

    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);
    testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
    testChangeSet = await IModelHost.hubAccess.getLatestChangeset({ accessToken, iModelId: testIModelId });

    const checkpoint = await IModelHost.hubAccess.queryV2Checkpoint({
      expectV2: true,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      accessToken,
      changeset: {
        id: testChangeSet.id,
      },
    });
    assert.isDefined(checkpoint, "checkpoint missing");
    assert.isDefined(checkpoint?.auth, "checkpoint storage account is invalid");

    // Start daemon process and wait for it to be ready
    // fs.chmodSync((BlobDaemon as any).exeName({}), 744);  // FIXME: This probably needs to be an imodeljs-native postinstall step...
    // daemonProc = BlobDaemon.start({
    //   daemonDir: blockcacheDir,
    //   storageType: "azure?sas=1",
    //   user: checkpoint!.user,
    // });
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
    fs.removeSync(blockcacheDir);
  });

  it("should be able to open and read V2 checkpoint", async () => {
    const iModel = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    assert.equal(iModel.iModelId, testIModelId);
    assert.equal(iModel.changeset.id, testChangeSet.id);
    assert.equal(iModel.iTwinId, testITwinId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    let numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    await iModel.reattachDaemon(accessToken);
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    iModel.close();
  }).timeout(120000);
});
