/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ChildProcess } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import { CloudSqlite, IModelHost, IModelJsFs, SnapshotDb, V2CheckpointAccessProps, V2CheckpointManager } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/KnownTestLocations";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetProps, IModelVersion } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { HubUtility } from "../HubUtility";
import { CloudSqliteTest } from "./CloudSqlite.test";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

describe("Checkpoints", () => {
  let daemon: ChildProcess;
  let accountProps: CloudSqlite.AccountAccessProps;
  let cacheProps: CloudSqlite.CacheProps;
  let daemonProps: CloudSqlite.DaemonProps;
  let accessToken: AccessToken;
  let testIModelId: GuidString;
  let testITwinId: GuidString;
  let testChangeSet: ChangesetProps;
  let testChangeSetFirstVersion: ChangesetProps;
  let checkpoint: V2CheckpointAccessProps | undefined;

  let testIModelId2: GuidString;
  let testITwinId2: GuidString;
  let testChangeSet2: ChangesetProps;

  const cloudcacheDir = path.join(KnownTestLocations.outputDir, "cloudsqlite");
  let originalEnv: any;

  const startDaemon = async () => {
    // Start daemon process and wait for it to be ready
    fs.chmodSync((CloudSqlite.Daemon as any).exeName({}), 744);  // FIXME: This probably needs to be an imodeljs-native postinstall step...
    daemon = CloudSqlite.Daemon.start({ ...daemonProps, ...cacheProps, ...accountProps });
    while (!IModelJsFs.existsSync(path.join(cloudcacheDir, "portnumber.bcv"))) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  const shutdownDaemon = async () => {
    if (daemon) {
      const onDaemonExit = new Promise((resolve) => daemon.once("exit", resolve));
      daemon.kill();
      await onDaemonExit;
    }
  };

  before(async () => {
    originalEnv = { ...process.env };
    process.env.CHECKPOINT_CACHE_DIR = cloudcacheDir;
    fs.rmSync(cloudcacheDir, { recursive: true, force: true });

    // Props for daemon
    accountProps = {
      accessName: CloudSqliteTest.storage.accessName,
      storageType: CloudSqliteTest.storage.storageType,
    };
    cacheProps = {
      rootDir: cloudcacheDir,
      name: V2CheckpointManager.cloudCacheName,
      cacheSize: "10G",
    };
    daemonProps = {
      // log: "meh", // message, event, http
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
    testChangeSetFirstVersion = await IModelHost.hubAccess.getChangesetFromVersion({ accessToken, iModelId: testIModelId, version: IModelVersion.first() });
    testITwinId2 = await HubUtility.getTestITwinId(accessToken);
    testIModelId2 = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.readOnly);
    testChangeSet2 = await IModelHost.hubAccess.getLatestChangeset({ accessToken, iModelId: testIModelId2 });

    checkpoint = await IModelHost.hubAccess.queryV2Checkpoint({
      expectV2: true,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      accessToken,
      changeset: {
        id: testChangeSet.id,
      },
    });
    assert.isDefined(checkpoint, "checkpoint missing");

    assert.isDefined(checkpoint?.accountName, "checkpoint storage account is invalid");
    assert.isDefined(checkpoint?.sasToken, "checkpoint accessToken is invalid");

  });

  afterEach(async () => {
    // need to cleanup the v2checkpointmanager after each run.
    V2CheckpointManager.cleanup();
  });

  after(async () => {
    process.env = originalEnv;
  });

  it("should use fallback directory when checkpoint_cache_dir has no daemon in it", async () => {
    const v2Manager = sinon.spy(V2CheckpointManager, "getFolder");
    const iModel = await SnapshotDb.openCheckpointV2({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    assert.isTrue(v2Manager.calledOnce);
    iModel.close();
  });

  it("should fail to open v2 checkpoint with invalid daemon directory", async () => {
    const portfile = path.join(cloudcacheDir, "portnumber.bcv");
    fs.mkdirSync(cloudcacheDir);
    fs.writeFileSync(portfile, "INVALID");

    try {
      await expect(SnapshotDb.openCheckpointV2({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSet,
      })).eventually.rejectedWith(/Cannot create CloudCache: invalid cache directory or directory does not exist/);
    } finally {
      fs.rmSync(portfile);
    }
  });

  it("should be able to open and read V2 checkpoints without the daemon ", async () => {
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
  });

  describe("with daemon", () => {
    before(async () => {
      await startDaemon();
    });

    after(async () => {
      await shutdownDaemon();
    });

    it("should be able to open and read V2 checkpoint with daemon running", async () => {
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
});
