/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { ChangesetIdWithIndex } from "@itwin/core-common";
import { CheckpointManager, V1CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { Logger } from "@itwin/core-bentley";
import { IModelHost } from "../../IModelHost";
import { HubMock } from "../../HubMock";

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
    isOpen: () => false,
    getIModelId: () => iModelId,
    getITwinId: () => iTwinId,
    getCurrentChangeset: () => changeset,
    setIModelDb: () => { },
    closeIModel: () => { },
    restartDefaultTxn: () => { },
  };

  it("should restart default txn after inactivity", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    const defaultTxnSpy = sinon.spy(SnapshotDb.prototype, "restartDefaultTxn");
    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => {
      return { dbName: "fakeDb", container: cloudContainer } as any;
    });
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
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

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => {
      return { dbName: "fakeDb", container: cloudContainer } as any;
    });
    const queryStub = sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();

    const userAccessToken = "token";
    const checkpoint = await SnapshotDb.openCheckpointFromRpc({ accessToken: userAccessToken, iTwinId, iModelId, changeset, reattachSafetySeconds: 60 });
    expect(checkpoint.nativeDb.cloudContainer?.accessToken).equal(mockCheckpointV2.sasToken);
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

    const snapshot = V1CheckpointManager.openCheckpointV1("fakeFilePath", { iTwinId: "fakeITwinId", iModelId: "fake1", changeset });
    const nowStub = sinon.stub(Date, "now");
    await snapshot.refreshContainerForRpc("");
    expect(nowStub.called).to.be.false;
  });
});
