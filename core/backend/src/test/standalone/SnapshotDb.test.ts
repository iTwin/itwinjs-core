/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";
import { CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelDb, SnapshotDb } from "../../IModelDb";

describe("SnapshotDb.reattachDaemon", () => {
  afterEach(() => sinon.restore());

  const fakeChangeset = { id: "fakeChangeSetId" };
  const fakeSnapshotDb: any = {
    isReadonly: () => true,
    getIModelId: () => "fakeIModelId",
    getITwinId: () => "fakeITwinId",
    getCurrentChangeset: () => fakeChangeset,
    setIModelDb: () => { },
  };

  it("should reattach if SAS key is almost expired", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    const attachStub = sinon.stub(V2CheckpointManager, "attach")
      .onFirstCall().resolves({ filePath: "testFilePath1", expiryTimestamp: Date.parse("2021-01-01T01:00:00Z") })
      .onSecondCall().resolves({ filePath: "testFilePath2", expiryTimestamp: Date.parse("2021-01-01T01:30:00Z") });
    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);

    const checkpoint = await SnapshotDb.openCheckpointV2({ iTwinId: "fakeITwinId", iModelId: "fake1", changeset: fakeChangeset });
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("testFilePath1");

    clock.setSystemTime(Date.parse("2021-01-01T00:30:01Z")); // 1 second past half the expiry time

    await checkpoint.reattachDaemon();

    expect(attachStub.calledTwice).to.be.true;
    expect(attachStub.secondCall.firstArg.iTwinId).to.equal("fakeITwinId");
    expect(attachStub.secondCall.firstArg.iModelId).to.equal("fakeIModelId");
    expect(attachStub.secondCall.firstArg.changeset.id).to.equal("fakeChangeSetId");
  });

  it("should not reattach if SAS key is fresh", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    const attachStub = sinon.stub(V2CheckpointManager, "attach")
      .onFirstCall().resolves({ filePath: "testFilePath1", expiryTimestamp: Date.parse("2021-01-01T01:00:00Z") })
      .onSecondCall().resolves({ filePath: "testFilePath2", expiryTimestamp: Date.parse("2021-01-01T01:30:00Z") });
    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);

    const checkpoint = await SnapshotDb.openCheckpointV2({ iTwinId: "fakeITwinId", iModelId: "fake1", changeset: fakeChangeset });
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("testFilePath1");
    expect(attachStub.calledOnce).to.be.true;

    clock.setSystemTime(Date.parse("2021-01-01T00:29:59Z")); // 1 second before half the expiry time

    await checkpoint.reattachDaemon();
    expect(attachStub.calledOnce).to.be.true;
  });

  it("should not reattach if SnapshotDb is not a V2 checkpoint", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);

    const snapshot = SnapshotDb.openCheckpointV1("fakeFilePath", { iTwinId: "fakeITwinId", iModelId: "fake1", changeset: fakeChangeset });
    const nowStub = sinon.stub(Date, "now");
    await snapshot.reattachDaemon();
    expect(nowStub.called).to.be.false;
  });
});
