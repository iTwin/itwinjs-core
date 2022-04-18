/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ChildProcess } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetProps, IModelVersion } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { CloudSqlite, convertOldToNewV2CheckpointAccessProps, IModelHost, IModelJsFs, SnapshotDb, V2CheckpointAccessProps, V2CheckpointManager } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/KnownTestLocations";
import { HubUtility } from "../HubUtility";
import { CloudSqliteTest } from "./CloudSqlite.test";

describe.skip("Checkpoints", () => {
  let daemon: ChildProcess;
  let accountProps: CloudSqlite.AccountAccessProps;
  let cacheProps: CloudSqlite.CacheProps;
  let daemonProps: CloudSqlite.DaemonProps;
  let accessToken: AccessToken;
  let testIModelId: GuidString;
  let testITwinId: GuidString;
  let testChangeSet: ChangesetProps;
  let testChangeSetFirstVersion: ChangesetProps;

  let testIModelId2: GuidString;
  let testITwinId2: GuidString;
  let testChangeSet2: ChangesetProps;

  const blockcacheDir = path.join(KnownTestLocations.outputDir, "blockcachevfs");
  let originalEnv: any;

  const startDaemon = async () => {
    // Start daemon process and wait for it to be ready
    fs.chmodSync((CloudSqlite.Daemon as any).exeName({}), 744);  // FIXME: This probably needs to be an imodeljs-native postinstall step...
    daemon = CloudSqlite.Daemon.start({...daemonProps, ...cacheProps});
    while (!IModelJsFs.existsSync(path.join(blockcacheDir, "portnumber.bcv"))) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  const shutdownDaemon = async (deleteDir: boolean) => {

    if (daemon) {
      const onDaemonExit = new Promise((resolve) => daemon.once("exit", resolve));
      daemon.kill();
      await onDaemonExit;
    }
    if (deleteDir)
      fs.removeSync(blockcacheDir);
  };

  before(async () => {
    originalEnv = { ...process.env };
    process.env.BLOCKCACHE_DIR = blockcacheDir;

    // Props for daemon
    accountProps = {
      accessName: CloudSqliteTest.storage.accessName,
      storageType: CloudSqliteTest.storage.storageType,
    };
    cacheProps = {
      rootDir: blockcacheDir,
      name: V2CheckpointManager.cloudCacheName,
      cacheSize: "10G",
    };
    daemonProps = {
      log: "meh", // message, event, http
      cacheSize: "10G",
      addr: "127.0.0.1",
      portNumber: 2030,
      spawnOptions: {
        stdio: "inherit",
      },
      httptimeout: 1000,
    };

    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    testITwinId = await HubUtility.getTestITwinId(accessToken);
    testIModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);
    testChangeSet = await IModelHost.hubAccess.getLatestChangeset({ accessToken, iModelId: testIModelId });
    testChangeSetFirstVersion = await IModelHost.hubAccess.getChangesetFromVersion({accessToken, iModelId: testIModelId, version: IModelVersion.first()});
    testITwinId2 = await HubUtility.getTestITwinId(accessToken);
    testIModelId2 = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
    testChangeSet2 = await IModelHost.hubAccess.getLatestChangeset({ accessToken, iModelId: testIModelId2 });

    let checkpoint = await IModelHost.hubAccess.queryV2Checkpoint({
      expectV2: true,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      accessToken,
      changeset: {
        id: testChangeSet.id,
      },
    });
    assert.isDefined(checkpoint, "checkpoint missing");
    checkpoint = convertOldToNewV2CheckpointAccessProps(checkpoint!);
    console.log(`checkpoint: ${JSON.stringify(checkpoint)}`);

    await startDaemon();

    assert.isDefined(checkpoint?.accessName, "checkpoint storage account is invalid");
    assert.isDefined(checkpoint?.accessToken, "checkpoint accessToken is invalid");

  });

  after(async () => {
    process.env = originalEnv;

    await shutdownDaemon(true);
  });

  it("should be able to open and read V2 checkpoints without the daemon ", async () => {
    await shutdownDaemon(false);
    let iModel = await SnapshotDb.openCheckpointV2({
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

    await iModel.refreshContainerSas(accessToken);
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    iModel.close();

    iModel = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    assert.equal(iModel.iModelId, testIModelId);
    assert.equal(iModel.changeset.id, testChangeSet.id);
    assert.equal(iModel.iTwinId, testITwinId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    // Open multiple imodels from same container
    const iModel2 = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSetFirstVersion,
    });
    assert.equal(iModel2.iModelId, testIModelId);
    assert.equal(iModel2.changeset.id, testChangeSetFirstVersion.id);
    assert.equal(iModel2.iTwinId, testITwinId);
    assert.equal(iModel2.rootSubject.name, "Stadium Dataset 1");
    numModels = await iModel2.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 3);

    // Open imodels across multiple containers
    const iModel3 = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId2,
      iModelId: testIModelId2,
      changeset: testChangeSet2,
    });

    assert.equal(iModel3.iModelId, testIModelId2);
    assert.equal(iModel3.changeset.id, testChangeSet2.id);
    assert.equal(iModel3.iTwinId, testITwinId2);
    assert.equal(iModel3.rootSubject.name, "ReadOnlyTest");
    numModels = await iModel3.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 4);

    iModel.close();
    iModel2.close();
    iModel3.close();

    await startDaemon();
  });
  it.skip("should be able to have multiple V2 checkpoints open from the same container", async () => {
    // Could have two v2 checkpoints open in the same container that'd be a nice test.
  });
  it("should be able to open and read V2 checkpoint", async () => {
    let iModel = await SnapshotDb.openCheckpointV2({
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

    await iModel.refreshContainerSas(accessToken);
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    iModel.close();

    iModel = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    assert.equal(iModel.iModelId, testIModelId);
    assert.equal(iModel.changeset.id, testChangeSet.id);
    assert.equal(iModel.iTwinId, testITwinId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    // Open multiple imodels from same container
    const iModel2 = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSetFirstVersion,
    });
    assert.equal(iModel2.iModelId, testIModelId);
    assert.equal(iModel2.changeset.id, testChangeSetFirstVersion.id);
    assert.equal(iModel2.iTwinId, testITwinId);
    assert.equal(iModel2.rootSubject.name, "Stadium Dataset 1");
    numModels = await iModel2.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 3);

    // Open imodels across multiple containers
    const iModel3 = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId2,
      iModelId: testIModelId2,
      changeset: testChangeSet2,
    });

    assert.equal(iModel3.iModelId, testIModelId2);
    assert.equal(iModel3.changeset.id, testChangeSet2.id);
    assert.equal(iModel3.iTwinId, testITwinId2);
    assert.equal(iModel3.rootSubject.name, "ReadOnlyTest");
    numModels = await iModel3.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 4);

    iModel.close();
    iModel2.close();
    iModel3.close();
  }).timeout(120000);

});
