/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { ChangesetIdWithIndex } from "@itwin/core-common";
import { CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelDb, SnapshotDb, StandaloneDb } from "../../IModelDb";
import { IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { IModelHost } from "../../IModelHost";
import { HubMock } from "../../internal/HubMock";
import { _hubAccess } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";
import { SpatialCategory } from "../../Category";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "path";
import { IModelJsFs } from "../../IModelJsFs";
import { withEditTxn } from "../../EditTxn";
import { expectIModelError, getIModelError } from "../imodel/IModelTestFixtures";

describe("SnapshotDb.refreshContainerForRpc", () => {
  afterEach(() => sinon.restore());

  const changeset: ChangesetIdWithIndex = { id: "fakeChangeSetId", index: 10 };
  const iTwinId = "fakeIModelId";
  const iModelId = "fakeIModelId";
  const makeToken = (date: string) => {
    const dateUri = encodeURIComponent(date);
    return `?sv=2018-03-28&st=${dateUri}&se=${dateUri}&sr=c&sp=rl&sig=bad`;
  };

  const mockCheckpointV2 = {
    accountName: "testAccount",
    containerId: "imodelblocks-123",
    sasToken: makeToken("2021-01-01T01:00:00Z"),
    dbName: "testDb",
    storageType: "azure?sas=1",
  };

  const cloudContainer = { accessToken: mockCheckpointV2.sasToken };
  const fakeSnapshotDb: any = {
    cloudContainer,
    isReadonly: () => true,
    isOpen: () => true,
    getIModelId: () => iModelId,
    getITwinId: () => iTwinId,
    getCurrentChangeset: () => changeset,
    hasUnsavedChanges: () => false,
    schemaSyncEnabled: () => false,
    setIModelDb: () => { },
    closeIModel: () => { },
    restartDefaultTxn: () => { },
    closeFile: () => { },
    getFilePath: () => "fakeFilePath",
    clearECDbCache: () => { },
  };
  it("perform checkpoint", async () => {
    const sourceFileName = path.join(KnownTestLocations.outputDir, "checkpoint1.bim");
    if (IModelJsFs.existsSync(sourceFileName))
      IModelJsFs.removeSync(sourceFileName);

    const iModel = StandaloneDb.createEmpty(sourceFileName, {
      rootSubject: { name: sourceFileName },
    });

    iModel.clearCaches();
    iModel.performCheckpoint();

    withEditTxn(iModel, (txn) => SpatialCategory.insert(
      txn,
      IModelDb.dictionaryId,
      "spatial category",
      {}
    ));

    // Use to throw error SQLITE_LOCKED
    iModel.performCheckpoint();
    iModel.close();
  });
  it("should restart default txn after inactivity", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    const defaultTxnSpy = sinon.spy(SnapshotDb.prototype, "restartDefaultTxn");
    sinon.stub(IModelHost, _hubAccess).get(() => HubMock);
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => {
      return { dbName: "fakeDb", container: cloudContainer } as any;
    });
    sinon.stub(IModelHost[_hubAccess], "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDbAsync").resolves(fakeSnapshotDb);
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
    sinon.stub(IModelDb.prototype, "loadIModelSettings" as any);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();

    const userAccessToken = "token";
    const checkpoint = await SnapshotDb.openCheckpointFromRpc({ accessToken: userAccessToken, iTwinId, iModelId, changeset, reattachSafetySeconds: 60 });
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("fakeDb");

    const tenMinutes = 10 * 60 * 1000;

    // Test 20 minute timer activated when opening v2 checkpoint works.
    await clock.tickAsync(tenMinutes - 100);
    expect(defaultTxnSpy.callCount).equal(0);
    await clock.tickAsync(101);
    expect(defaultTxnSpy.callCount).equal(1);

    // Make sure timeout doesn't trigger more than once unless refreshContainer is called.
    await clock.tickAsync(tenMinutes + 100);
    expect(defaultTxnSpy.callCount).equal(1);
    await checkpoint.refreshContainerForRpc(""); // activates timeout again by calling refresh on the timer.
    expect(defaultTxnSpy.callCount).equal(1);
    await clock.tickAsync(tenMinutes + 100);
    expect(defaultTxnSpy.callCount).equal(2);

    // Keep calling refreshContainer and make sure that restartDefaultTxn doesn't get called.
    await checkpoint.refreshContainerForRpc("");
    await clock.tickAsync(tenMinutes - 100);
    await checkpoint.refreshContainerForRpc("");
    await clock.tickAsync(tenMinutes - 100);
    expect(defaultTxnSpy.callCount).equal(2);

    // advance time past 20 minutes without refreshing container and make sure defaultTxn still restarts
    await clock.tickAsync(tenMinutes + 100);
    expect(defaultTxnSpy.callCount).equal(3);
  });

  it("should refresh checkpoint sasToken from RPC", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));

    sinon.stub(IModelHost, _hubAccess).get(() => HubMock);
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => {
      return { dbName: "fakeDb", container: cloudContainer } as any;
    });
    const queryStub = sinon.stub(IModelHost[_hubAccess], "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDbAsync").resolves(fakeSnapshotDb);
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
    sinon.stub(IModelDb.prototype, "loadIModelSettings" as any);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();

    const userAccessToken = "token";
    const checkpoint = await SnapshotDb.openCheckpointFromRpc({ accessToken: userAccessToken, iTwinId, iModelId, changeset, reattachSafetySeconds: 60 });
    expect(checkpoint.cloudContainer?.accessToken).equal(mockCheckpointV2.sasToken);
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("fakeDb");

    const errorLogStub = sinon.stub(Logger, "logError").callsFake(() => { });
    const infoLogStub = sinon.stub(Logger, "logInfo").callsFake(() => { });

    clock.setSystemTime(Date.parse("2021-01-01T00:58:10Z")); // within safety period
    void expect(checkpoint.refreshContainerForRpc("")).to.be.fulfilled;
    expect(queryStub.callCount).equal(0, "should not need reattach yet");

    clock.setSystemTime(Date.parse("2021-01-01T00:59:10Z")); // after safety period

    mockCheckpointV2.sasToken = makeToken("2021-01-01T02:00:00Z");
    const attachPromise = checkpoint.refreshContainerForRpc("");
    const promise2 = checkpoint.refreshContainerForRpc(""); // gets copy of first promise
    const promise3 = checkpoint.refreshContainerForRpc(""); // "
    expect(queryStub.callCount).equal(1); // shouldn't need to attach since first call already started the process
    expect(infoLogStub.callCount).equal(1);
    expect(infoLogStub.args[0][1]).include("attempting to refresh");
    expect(errorLogStub.callCount).equal(0);

    void expect(attachPromise).to.not.be.fulfilled;
    void expect(promise2).to.not.be.fulfilled;
    void expect(promise3).to.not.be.fulfilled;
    await attachPromise;
    void expect(attachPromise).to.be.fulfilled;
    void expect(promise2).to.be.fulfilled;
    void expect(promise3).to.be.fulfilled;
    expect(infoLogStub.callCount).equal(2);
    expect(infoLogStub.args[1][1]).include("refreshed checkpoint sasToken");

    clock.setSystemTime(Date.parse("2021-01-01T03:00:00Z"));
    mockCheckpointV2.sasToken = makeToken("2021-01-01T03:00:10Z"); // an expiry within safety interval should cause error log
    await checkpoint.refreshContainerForRpc("");
    expect(errorLogStub.callCount).equal(1);
    expect(errorLogStub.args[0][1]).include("timestamp that expires before safety interval");

    queryStub.resetHistory();
    errorLogStub.resetHistory();
    infoLogStub.resetHistory();
    mockCheckpointV2.sasToken = makeToken("2021-01-01T04:00:10Z"); // expiry after safety interval
    clock.setSystemTime(Date.parse("2021-01-01T03:00:02Z"));
    // next call to reattach daemon should work fine and correct problem
    await checkpoint.refreshContainerForRpc("");
    expect(queryStub.callCount).equal(1);
    expect(infoLogStub.callCount).equal(2);
    expect(errorLogStub.callCount).equal(0);
  });

  it("should not refreshContainer if SnapshotDb is not a checkpoint", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
    sinon.stub(IModelDb.prototype, "loadIModelSettings" as any);

    const snapshot = IModelTestUtils.openCheckpoint("fakeFilePath", { iTwinId: "fakeITwinId", iModelId: "fake1", changeset });
    const nowStub = sinon.stub(Date, "now");
    await snapshot.refreshContainerForRpc("");
    snapshot.close();
    expect(nowStub.called).to.be.false;
    nowStub.restore();
  });
});

describe("IModelDb.openDgnDbAsync", () => {
  afterEach(() => sinon.restore());

  it("opens read-only and reserves its key until the open completes", async () => {
    const fileName = IModelTestUtils.resolveAssetFile("test.bim");
    const key = "openDgnDbAsync-test-key";
    const opening = IModelDb.openDgnDbAsync({ path: fileName, key });

    // while the open is pending, other opens with the same key are rejected
    expectIModelError(IModelStatus.AlreadyOpen, await getIModelError(IModelDb.openDgnDbAsync({ path: fileName, key })));
    expect(() => IModelDb.openDgnDb({ path: fileName, key }, OpenMode.Readonly)).to.throw("already in use");

    const nativeDb = await opening;
    expect(nativeDb.isOpen()).to.be.true;
    expect(nativeDb.isReadonly()).to.be.true;
    nativeDb.closeFile();

    // the key is released once the open completes
    const reopened = await IModelDb.openDgnDbAsync({ path: fileName, key });
    reopened.closeFile();
  });

  it("reports failures the same way as openDgnDb and releases the key", async () => {
    const fileName = path.join(KnownTestLocations.outputDir, "openDgnDbAsync-does-not-exist.bim");
    const key = "openDgnDbAsync-missing-key";
    let syncError: any;
    try {
      IModelDb.openDgnDb({ path: fileName, key }, OpenMode.Readonly);
    } catch (err) {
      syncError = err;
    }
    const asyncError = await getIModelError(IModelDb.openDgnDbAsync({ path: fileName, key }));
    expect(asyncError).to.not.be.undefined;
    expect(asyncError?.errorNumber).to.equal(syncError.errorNumber);
    expect(asyncError?.message).to.equal(syncError.message);
    expect(asyncError?.message).to.contain(fileName);

    // the key was released, so a retry fails for the same reason rather than with AlreadyOpen
    expect((await getIModelError(IModelDb.openDgnDbAsync({ path: fileName, key })))?.errorNumber).to.equal(syncError.errorNumber);
  });

  it("is used to open checkpoints, so the open does not block the JavaScript thread", async () => {
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => ({ dbName: "fakeDb", container: { accessToken: "sas" } as any }));
    const syncOpen = sinon.stub(SnapshotDb, "openDgnDb");
    const fileName = IModelTestUtils.resolveAssetFile("test.bim");
    const asyncOpen = sinon.stub(SnapshotDb, "openDgnDbAsync").callsFake(async () => IModelDb.openDgnDb({ path: fileName }, OpenMode.Readonly));
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();

    const changeset = { id: "fakeChangeSetId", index: 10 };
    const checkpoint = await SnapshotDb.openCheckpointFromRpc({ accessToken: "token", iTwinId: "fakeITwinId", iModelId: "fakeIModelId", changeset });
    try {
      expect(asyncOpen.calledOnce).to.be.true;
      expect(asyncOpen.firstCall.args[0].path).to.equal("fakeDb");
      expect(asyncOpen.firstCall.args[0].key).to.equal(CheckpointManager.getKey({ iTwinId: "fakeITwinId", iModelId: "fakeIModelId", changeset }));
      expect(syncOpen.called).to.be.false;
    } finally {
      checkpoint.close();
    }
  });
});
