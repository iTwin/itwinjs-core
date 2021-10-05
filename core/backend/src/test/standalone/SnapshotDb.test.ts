/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { ChangesetIdWithIndex } from "@itwin/core-common";
import { CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { Logger } from "@itwin/core-bentley";

describe("SnapshotDb.reattachDaemon", () => {
  afterEach(() => sinon.restore());

  const fakeChangeset: ChangesetIdWithIndex = { id: "fakeChangeSetId", index: 10 };
  const fakeSnapshotDb: any = {
    isReadonly: () => true,
    getIModelId: () => "fakeIModelId",
    getITwinId: () => "fakeITwinId",
    getCurrentChangeset: () => fakeChangeset,
    setIModelDb: () => { },
  };

  it("should reattach V2 checkpoint", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));

    const returnValue = { filePath: "testFilePath1", expiryTimestamp: Date.parse("2021-01-01T01:00:00Z") };

    const attachStub = sinon.stub(V2CheckpointManager, "attach").callsFake(async () => returnValue);
    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);

    const checkpoint = await SnapshotDb.openCheckpointV2({ iTwinId: "fakeITwinId", iModelId: "fake1", changeset: fakeChangeset, reattachSafetySeconds: 60 });
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("testFilePath1");

    const errorLogStub = sinon.stub(Logger, "logError").callsFake(() => { });
    const infoLogStub = sinon.stub(Logger, "logInfo").callsFake(() => { });

    attachStub.resetHistory();
    clock.setSystemTime(Date.parse("2021-01-01T00:58:10Z")); // within safety period
    void expect(checkpoint.reattachDaemon("")).to.be.fulfilled;
    assert.equal(attachStub.callCount, 0, "should not need reattach yet");

    clock.setSystemTime(Date.parse("2021-01-01T00:59:10Z")); // after safety period
    returnValue.expiryTimestamp = Date.parse("2021-01-01T02:00:00Z");
    const attachPromise = checkpoint.reattachDaemon("");
    const promise2 = checkpoint.reattachDaemon(""); // gets copy of first promise
    const promise3 = checkpoint.reattachDaemon(""); // "
    assert.equal(attachStub.callCount, 1); // shouldn't need to attach since first call already started the process
    assert.equal(infoLogStub.callCount, 1);
    assert.include(infoLogStub.args[0][1], "attempting to reattach");
    assert.equal(errorLogStub.callCount, 0);

    void expect(attachPromise).to.not.be.fulfilled;
    void expect(promise2).to.not.be.fulfilled;
    void expect(promise3).to.not.be.fulfilled;
    await attachPromise;
    void expect(attachPromise).to.be.fulfilled;
    void expect(promise2).to.be.fulfilled;
    void expect(promise3).to.be.fulfilled;
    assert.equal(infoLogStub.callCount, 2);
    assert.include(infoLogStub.args[1][1], "reattached checkpoint");

    clock.setSystemTime(Date.parse("2021-01-01T03:00:00Z"));
    returnValue.expiryTimestamp = Date.parse("2021-01-01T03:00:10Z"); // an expiry within safety interval should cause error log
    await checkpoint.reattachDaemon("");
    assert.equal(errorLogStub.callCount, 1);
    assert.include(errorLogStub.args[0][1], "timestamp that expires before safety interval");

    attachStub.resetHistory();
    errorLogStub.resetHistory();
    infoLogStub.resetHistory();
    returnValue.expiryTimestamp = Date.parse("2021-01-01T04:00:10Z"); // expiry after safety interval
    clock.setSystemTime(Date.parse("2021-01-01T03:00:02Z"));
    // next call to reattach daemon should work fine and correct problem
    await checkpoint.reattachDaemon("");
    assert.equal(attachStub.callCount, 1);
    assert.equal(infoLogStub.callCount, 2);
    assert.equal(errorLogStub.callCount, 0);
  });

  it("should not reattach if SnapshotDb is not a V2 checkpoint", async () => {
    const clock = sinon.useFakeTimers();
    clock.setSystemTime(Date.parse("2021-01-01T00:00:00Z"));
    sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(CheckpointManager, "validateCheckpointGuids").returns();
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);

    const snapshot = SnapshotDb.openCheckpointV1("fakeFilePath", { iTwinId: "fakeITwinId", iModelId: "fake1", changeset: fakeChangeset });
    const nowStub = sinon.stub(Date, "now");
    await snapshot.reattachDaemon("");
    expect(nowStub.called).to.be.false;
  });
});
