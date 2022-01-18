/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { AccessToken, Guid, Logger } from "@itwin/core-bentley";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { DownloadAndOpenArgs, RpcBriefcaseUtility } from "../../rpc-impl/RpcBriefcaseUtility";
import { SyncMode } from "@itwin/core-common";
import { CheckpointManager, V1CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelTestUtils } from "..";
import { IModelJsFs } from "../../IModelJsFs";

describe("RpcBriefcaseUtility", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("RpcBriefcaseUtility.findOpenIModel should return open SnapshotDb and call reattachDaemon", async () => {
    const reattachStub = sinon.stub<[AccessToken], Promise<void>>();
    const fakeIModel: IModelDb = { reattachDaemon: reattachStub } as any;
    sinon.stub(IModelDb, "tryFindByKey").returns(fakeIModel);

    const result = await RpcBriefcaseUtility.findOpenIModel("fake", {} as any);

    expect(result).to.equal(fakeIModel);
    expect(reattachStub.calledOnce).to.be.true;
    expect(reattachStub.firstCall.firstArg).to.equal("fake");
  });

  it("RpcBriefcaseUtility.open should fall back to downloading V2 checkpoint if opening V2 checkpoint fails", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint.bim");
    const snapshot = SnapshotDb.createEmpty(dbPath, { rootSubject: { name: "test" } });
    const iModelId = snapshot.iModelId;
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.setITwinId(iTwinId);
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();
    snapshot.close();
    const args: DownloadAndOpenArgs = {
      syncMode: SyncMode.FixedVersion,
      tokenProps: {
        changeset,
        iModelId,
        iTwinId,
      },
      activity: {
        activityId: "activityId",
        applicationId: "applicationid",
        applicationVersion: "applicationVersion",
        sessionId: "sessionId",
        accessToken: "token",
      },
    };
    sinon.stub(SnapshotDb, "openCheckpointV2").throws(new Error("fake error"));
    const spy = sinon.spy(CheckpointManager, "downloadCheckpoint");
    const v1ManagerDownloadCheckpointSpy = sinon.spy(V1CheckpointManager, "downloadCheckpoint");
    sinon.stub(V2CheckpointManager, "downloadCheckpoint").callsFake(async (_request) => {
      IModelJsFs.copySync(dbPath, _request.localFile);
      return changeset.id;
    });
    const result = await RpcBriefcaseUtility.open(args);
    expect(spy.firstCall.args[0].downloadV2Only).to.equal(true);
    expect(result.iModelId).to.equal(iModelId);
    expect(result.iTwinId).to.equal(iTwinId);
    expect(v1ManagerDownloadCheckpointSpy.callCount).to.equal(0);

  });
  it("RpcBriefcaseUtility.open should report that appropriately when we open a checkpoint already on disk", async () => {
    const traceLogs: string[] = [];
    sinon.stub(Logger, "logTrace").callsFake((_category, _message) => {
      traceLogs.push(_message);
    });
    const searchTraceLogs = (msgToFind: string): boolean => {
      return traceLogs.some((value: string) => {
        return value.includes(msgToFind);
      });
    };
    // maybe call the onProgress function in the request?
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint.bim");
    const snapshot = SnapshotDb.createEmpty(dbPath, { rootSubject: { name: "test" } });
    const iModelId = snapshot.iModelId;
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.setITwinId(iTwinId);
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();
    snapshot.close();
    const args: DownloadAndOpenArgs = {
      syncMode: SyncMode.FixedVersion,
      tokenProps: {
        changeset,
        iModelId,
        iTwinId,
      },
      activity: {
        activityId: "activityId",
        applicationId: "applicationid",
        applicationVersion: "applicationVersion",
        sessionId: "sessionId",
        accessToken: "token",
      },
    };
    sinon.stub(SnapshotDb, "openCheckpointV2").throws(new Error("fake error"));
    const spy = sinon.spy(CheckpointManager, "downloadCheckpoint");
    const v1ManagerDownloadCheckpointSpy = sinon.spy(V1CheckpointManager, "downloadCheckpoint");
    sinon.stub(V2CheckpointManager, "downloadCheckpoint").callsFake(async (_request) => {
      IModelJsFs.copySync(dbPath, _request.localFile);
      return changeset.id;
    });
    const result = await RpcBriefcaseUtility.open(args);
    expect(spy.firstCall.args[0].downloadV2Only).to.equal(true);
    expect(result.iModelId).to.equal(iModelId);
    expect(result.iTwinId).to.equal(iTwinId);
    expect(v1ManagerDownloadCheckpointSpy.callCount).to.equal(0);
    expect(searchTraceLogs("Opened checkpoint")).to.be.true;
  });
  it("RpcBriefcaseUtility.open should report that its opened a v2 checkpoint", async () => {
    const traceLogs: string[] = [];
    sinon.stub(Logger, "logTrace").callsFake((_category, _message) => {
      traceLogs.push(_message);
    });
    const searchTraceLogs = (msgToFind: string): boolean => {
      return traceLogs.some((value: string) => {
        return value.includes(msgToFind);
      });
    };
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint.bim");
    const snapshot = SnapshotDb.createEmpty(dbPath, { rootSubject: { name: "test" } });
    const iModelId = snapshot.iModelId;
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.setITwinId(iTwinId);
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();
    snapshot.close();
    const args: DownloadAndOpenArgs = {
      syncMode: SyncMode.FixedVersion,
      tokenProps: {
        changeset,
        iModelId,
        iTwinId,
      },
      activity: {
        activityId: "activityId",
        applicationId: "applicationid",
        applicationVersion: "applicationVersion",
        sessionId: "sessionId",
        accessToken: "token",
      },
    };
    sinon.stub(SnapshotDb, "openCheckpointV2").throws(new Error("fake error"));
    const spy = sinon.spy(CheckpointManager, "downloadCheckpoint");
    const v1ManagerDownloadCheckpointSpy = sinon.spy(V1CheckpointManager, "downloadCheckpoint");
    sinon.stub(V2CheckpointManager, "downloadCheckpoint").callsFake(async (_request) => {
      // RpcBriefcaseUtility.open looks for an "onProgress" call in order to know we started dling a v2 checkpoint
      if (_request.onProgress !== undefined) _request.onProgress(1, 1);
      IModelJsFs.copySync(dbPath, _request.localFile);
      return changeset.id;
    });
    const result = await RpcBriefcaseUtility.open(args);
    expect(spy.firstCall.args[0].downloadV2Only).to.equal(true);
    expect(result.iModelId).to.equal(iModelId);
    expect(result.iTwinId).to.equal(iTwinId);
    expect(v1ManagerDownloadCheckpointSpy.callCount).to.equal(0);
    expect(searchTraceLogs("Opened V2 checkpoint")).to.be.true;
    expect(searchTraceLogs("Opened checkpoint")).to.be.false;
  });
});
