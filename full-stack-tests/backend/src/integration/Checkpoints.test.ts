/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ChildProcess } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import { CloudSqlite, IModelDb, IModelHost, IModelJsFs, NativeCloudSqlite, SettingsPriority, SnapshotDb, V2CheckpointAccessProps, V2CheckpointManager } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/KnownTestLocations";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ChangesetProps, IModelVersion } from "@itwin/core-common";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { HubUtility } from "../HubUtility";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

async function queryBisModelCount(imodel: IModelDb): Promise<number> {
  const reader = imodel.createQueryReader("SELECT count(*) FROM bis.model");
  if (await reader.step())
    return reader.current[0] as number;
  return -1;
}

describe("Checkpoints", () => {
  let daemon: ChildProcess;
  let cacheProps: CloudSqlite.CacheProps;
  let daemonProps: NativeCloudSqlite.DaemonProps;
  let accessToken: AccessToken;
  let testIModelId: GuidString;
  let testITwinId: GuidString;
  let testChangeSet: ChangesetProps;
  let testChangeSetFirstVersion: ChangesetProps;
  let checkpointProps: V2CheckpointAccessProps | undefined;

  let testIModelId2: GuidString;
  let testITwinId2: GuidString;
  let testChangeSet2: ChangesetProps;

  const cloudcacheDir = path.join(KnownTestLocations.outputDir, "cloudsqlite");
  let originalEnv: any;

  const startDaemon = async () => {
    // Start daemon process and wait for it to be ready
    fs.chmodSync((NativeCloudSqlite.Daemon as any).exeName({}), 744);
    daemon = NativeCloudSqlite.Daemon.start({ ...daemonProps, ...cacheProps });
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
    IModelJsFs.removeSync(cloudcacheDir);

    // Props for daemon
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

    checkpointProps = await IModelHost.hubAccess.queryV2Checkpoint({
      expectV2: true,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      accessToken,
      changeset: {
        id: testChangeSet.id,
      },
    });
    assert.isDefined(checkpointProps, "checkpoint missing");

    assert.isDefined(checkpointProps?.accountName, "checkpoint storage account is invalid");
    assert.isDefined(checkpointProps?.sasToken, "checkpoint accessToken is invalid");

  });

  afterEach(async () => {
    // need to cleanup V2CheckpointManager after each run.
    V2CheckpointManager.cleanup();
  });

  after(async () => {
    process.env = originalEnv;
  });

  it("should use profile directory when no daemon is running", async () => {
    const iModel = await SnapshotDb.openCheckpointFromRpc({
      accessToken,
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    expect(iModel.nativeDb.cloudContainer?.cache?.rootDir).contains("profile");
    iModel.close();
  });

  it("should fail to open checkpoint with invalid daemon directory", async () => {
    const portfile = path.join(cloudcacheDir, "portnumber.bcv");
    IModelJsFs.recursiveMkDirSync(cloudcacheDir);
    fs.writeFileSync(portfile, "INVALID");

    try {
      await expect(SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSet,
      })).eventually.rejectedWith(/Cannot create CloudCache: invalid cache directory or directory does not exist/);
    } finally {
      IModelJsFs.removeSync(portfile);
    }
  });

  it("should start prefetch", async () => {
    IModelHost.appWorkspace.settings.addDictionary("prefetch", SettingsPriority.application, {
      "Checkpoints/prefetch": true,
      "Checkpoints/prefetch/maxBlocks": 5000,
      "Checkpoints/prefetch/minRequests": 1,
      "Checkpoints/prefetch/maxRequests": 3,
    });
    const prefetchSpy = sinon.spy(CloudSqlite, "startCloudPrefetch").withArgs(sinon.match.any, `${testChangeSet.id}.bim`, sinon.match.any); // Need matchers because GCS is also prefetched.
    const settingsSpy = sinon.spy(IModelHost.appWorkspace.settings, "getBoolean").withArgs("Checkpoints/prefetch");
    await V2CheckpointManager.attach({ accessToken, iTwinId: testITwinId, iModelId: testIModelId, changeset: testChangeSet });
    expect(prefetchSpy.callCount).to.equal(1);
    expect(settingsSpy.callCount).to.equal(1);
    sinon.restore();
    IModelHost.appWorkspace.settings.dropDictionary("prefetch");
  });

  it("should be able to open and read checkpoints from Ipc ", async () => {
    // simulate user being logged in
    sinon.stub(IModelHost, "getAccessToken").callsFake(async () => accessToken);
    const clock = sinon.useFakeTimers(); // must be before creating PropertyStore container
    const queryV2Checkpoint = sinon.spy(IModelHost.hubAccess, "queryV2Checkpoint");

    let iModel = await SnapshotDb.openCheckpoint({
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    assert.equal(iModel.iModelId, testIModelId);
    assert.equal(iModel.changeset.id, testChangeSet.id);
    assert.equal(iModel.iTwinId, testITwinId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    let numModels = await queryBisModelCount(iModel);
    assert.equal(numModels, 32);

    numModels = await queryBisModelCount(iModel);
    assert.equal(numModels, 32);

    // make sure the sasToken for the checkpoint container is refreshed before it expires
    // (see explanation in CloudSqlite.test.ts "Auto refresh container tokens" for how this works)
    const c1 = iModel.nativeDb.cloudContainer as CloudSqlite.CloudContainer & { refreshPromise?: Promise<void> };
    const oldToken = c1.accessToken; // save current token

    expect(queryV2Checkpoint.callCount).equal(1);
    clock.tick(60 * 60 * 1000);
    // the auto-refresh should have called "queryV2Checkpoint" again to get a new sasToken
    expect(queryV2Checkpoint.callCount).equal(2);
    await c1.refreshPromise;
    expect(oldToken).not.equal(c1.accessToken); // should have changed
    iModel.close();

    iModel = await SnapshotDb.openCheckpoint({
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSet,
    });
    assert.equal(iModel.iModelId, testIModelId);
    assert.equal(iModel.changeset.id, testChangeSet.id);
    assert.equal(iModel.iTwinId, testITwinId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    numModels = await queryBisModelCount(iModel);
    assert.equal(numModels, 32);

    // Open multiple imodels from same container
    const iModel2 = await SnapshotDb.openCheckpoint({
      iTwinId: testITwinId,
      iModelId: testIModelId,
      changeset: testChangeSetFirstVersion,
    });
    assert.equal(iModel2.iModelId, testIModelId);
    assert.equal(iModel2.changeset.id, testChangeSetFirstVersion.id);
    assert.equal(iModel2.iTwinId, testITwinId);
    assert.equal(iModel2.rootSubject.name, "Stadium Dataset 1");
    numModels = await queryBisModelCount(iModel2);
    assert.equal(numModels, 3);

    // Open imodels across multiple containers
    const iModel3 = await SnapshotDb.openCheckpoint({
      iTwinId: testITwinId2,
      iModelId: testIModelId2,
      changeset: testChangeSet2,
    });

    assert.equal(iModel3.iModelId, testIModelId2);
    assert.equal(iModel3.changeset.id, testChangeSet2.id);
    assert.equal(iModel3.iTwinId, testITwinId2);
    assert.equal(iModel3.rootSubject.name, "ReadOnlyTest");
    numModels = await queryBisModelCount(iModel3);
    assert.equal(numModels, 4);

    iModel.close();
    iModel2.close();
    iModel3.close();
    sinon.restore();
  });

  describe("with daemon", () => {
    before(async () => {
      await startDaemon();
    });

    after(async () => {
      await shutdownDaemon();
    });

    it("should start prefetch", async () => {
      IModelHost.appWorkspace.settings.addDictionary("prefetch", SettingsPriority.application, {
        "Checkpoints/prefetch": true,
        "Checkpoints/prefetch/maxBlocks": 5000,
        "Checkpoints/prefetch/minRequests": 1,
        "Checkpoints/prefetch/maxRequests": 3,
      });
      const prefetchSpy = sinon.spy(CloudSqlite, "startCloudPrefetch").withArgs(sinon.match.any, `${testChangeSet.id}.bim`, sinon.match.any); // Need matchers because GCS is also prefetched.
      const settingsSpy = sinon.spy(IModelHost.appWorkspace.settings, "getBoolean").withArgs("Checkpoints/prefetch");

      const checkpoint = { accessToken, iTwinId: testITwinId, iModelId: testIModelId, changeset: testChangeSet };
      await V2CheckpointManager.attach(checkpoint);
      expect(prefetchSpy.callCount).equal(1);
      expect(settingsSpy.callCount).equal(1);

      // Attach the same checkpoint a second time, quickly to make sure it doesn't start a second prefetch while one is active.
      // This simulates two processes attached to the same daemon requesting the same checkpoint.
      // Note: this is flaky since it depends on the first prefetch still being active. Usually it takes a
      // few seconds, so it doesn't finish before we start the second one, but may fail under
      // the debugger. I'm not sure this test (or even the policy of not starting a second prefetch) is a good idea.
      await V2CheckpointManager.attach(checkpoint);
      expect(prefetchSpy.callCount).equal(1);
      expect(settingsSpy.callCount).equal(2);

      sinon.restore();
      IModelHost.appWorkspace.settings.dropDictionary("prefetch");
    });

    it("should query bcv stat table", async () => {
      const containerSpy = sinon.spy(V2CheckpointManager, "attach");

      const iModel = await SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSet,
      });

      const container = (await containerSpy.returnValues[0]).container;
      let stats = container.queryBcvStats({ addClientInformation: true });
      const populatedCacheslots = stats.populatedCacheslots;
      // Opening the database causes some blocks to be downloaded.
      expect(stats.populatedCacheslots).to.be.greaterThan(0);
      // Only one database and this db has a default txn open so all it's local blocks should be locked.
      expect(stats.lockedCacheslots).greaterThan(0);
      // 10 GB (comes from daemonProps at the top of this test file) / 4 mb (imodel block size) should give us the number of total available entries in the cache.
      expect(stats.totalCacheslots).to.equal((10 * 1024 * 1024 * 1024) / (4 * 1024 * 1024));
      expect(stats.activeClients).to.equal(1);
      expect(stats.attachedContainers).to.equal(1);
      expect(stats.totalClients).to.equal(1);
      iModel.restartDefaultTxn();
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.populatedCacheslots).to.equal(populatedCacheslots);
      expect(stats.lockedCacheslots).to.equal(0);
      expect(stats.activeClients).to.equal(0);
      expect(stats.totalClients).to.equal(1);
      const prefetch = CloudSqlite.startCloudPrefetch(container, `${testChangeSet.id}.bim`);
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.ongoingPrefetches).to.equal(1);
      prefetch.cancel();
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.ongoingPrefetches).to.equal(0);

      // Open multiple imodels from same container
      const iModel2 = await SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSetFirstVersion,
      });
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.totalClients).to.equal(2);
      expect(stats.activeClients).to.equal(1);
      expect(stats.attachedContainers).to.equal(1);
      iModel2.restartDefaultTxn();
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.activeClients).to.equal(0);
      expect(stats.totalClients).to.equal(2);

      iModel.close();
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.totalClients).to.equal(1);

      iModel2.close();
      stats = container.queryBcvStats({ addClientInformation: true });
      expect(stats.totalClients).to.equal(0);
    });

    it("should be able to open and read checkpoint for Rpc with daemon running", async () => {
      let iModel = await SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSet,
      });
      assert.equal(iModel.iModelId, testIModelId);
      assert.equal(iModel.changeset.id, testChangeSet.id);
      assert.equal(iModel.iTwinId, testITwinId);
      assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
      let numModels = await queryBisModelCount(iModel);
      assert.equal(numModels, 32);

      await iModel.refreshContainerForRpc(accessToken);
      numModels = await queryBisModelCount(iModel);
      assert.equal(numModels, 32);

      const checkpointContainer = iModel.nativeDb.cloudContainer;
      iModel.close();

      iModel = await SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSet,
      });
      assert.equal(iModel.iModelId, testIModelId);
      assert.equal(iModel.changeset.id, testChangeSet.id);
      assert.equal(iModel.iTwinId, testITwinId);
      assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
      numModels = await queryBisModelCount(iModel);
      assert.equal(numModels, 32);

      // Open multiple imodels from same container
      const iModel2 = await SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId,
        iModelId: testIModelId,
        changeset: testChangeSetFirstVersion,
      });
      assert.equal(iModel2.iModelId, testIModelId);
      assert.equal(iModel2.changeset.id, testChangeSetFirstVersion.id);
      assert.equal(iModel2.iTwinId, testITwinId);
      assert.equal(iModel2.rootSubject.name, "Stadium Dataset 1");
      numModels = await queryBisModelCount(iModel2);
      assert.equal(numModels, 3);

      // Open imodels across multiple containers
      const iModel3 = await SnapshotDb.openCheckpointFromRpc({
        accessToken,
        iTwinId: testITwinId2,
        iModelId: testIModelId2,
        changeset: testChangeSet2,
      });

      assert.equal(iModel3.iModelId, testIModelId2);
      assert.equal(iModel3.changeset.id, testChangeSet2.id);
      assert.equal(iModel3.iTwinId, testITwinId2);
      assert.equal(iModel3.rootSubject.name, "ReadOnlyTest");
      numModels = await queryBisModelCount(iModel3);
      assert.equal(numModels, 4);

      // all checkpoints for the same iModel should share a cloud container
      expect(checkpointContainer).equal(iModel.nativeDb.cloudContainer);
      expect(checkpointContainer).equal(iModel2.nativeDb.cloudContainer);

      iModel.close();
      iModel2.close();
      iModel3.close();
    }).timeout(120000);

  });
});
