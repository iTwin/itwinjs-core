/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { CheckpointManager, V1CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelHost, V2CheckpointAccessProps } from "../../core-backend";
import { SnapshotDb } from "../../IModelDb";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubMock } from "../../HubMock";

describe("V1 Checkpoint Manager", () => {
  it("empty props", async () => {
    const props = {
      iTwinId: "",
      iModelId: "",
      changeset: { id: "" },
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "checkpoints", "first.bim"));
  });

  it("changeset only props", async () => {
    const props = {
      iTwinId: "",
      iModelId: "",
      changeset: { id: "1234" },
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "checkpoints", "1234.bim"));
  });

  it("changeset+itwin props", async () => {
    const props = {
      iTwinId: "5678",
      iModelId: "",
      changeset: { id: "1234" },
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "checkpoints", "1234.bim"));
  });

  it("changeset+itwin+imodel props", async () => {
    const props = {
      iTwinId: "5678",
      iModelId: "910",
      changeset: { id: "1234" },
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "910", "checkpoints", "1234.bim"));
  });

  it("getFolder", async () => {
    assert.equal(V1CheckpointManager.getFolder("1234"), path.join(IModelHost.cacheDir, "imodels", "1234", "checkpoints"));
    assert.equal(V1CheckpointManager.getFolder(""), path.join(IModelHost.cacheDir, "imodels", "checkpoints"));
  });

  it("should fix invalid dbGuid during download", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint.bim");
    const snapshot = SnapshotDb.createEmpty(dbPath, { rootSubject: { name: "test" } });
    const iModelId = Guid.createValue();  // This is wrong - it should be `snapshot.getGuid()`!
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.setITwinId(iTwinId);
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();

    assert.notEqual(iModelId, snapshot.nativeDb.getIModelId()); // Ensure the Snapshot dbGuid and iModelId are different
    snapshot.close();

    sinon.stub(V2CheckpointManager, "downloadCheckpoint").callsFake(async (arg) => {
      IModelJsFs.copySync(dbPath, arg.localFile);
      return changeset.id;
    });

    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { iTwinId, iModelId, changeset } };
    await CheckpointManager.downloadCheckpoint(request);
    const db = SnapshotDb.openCheckpointV1(localFile, request.checkpoint);
    assert.equal(iModelId, db.nativeDb.getIModelId(), "expected the V1 Checkpoint download to fix the improperly set dbGuid.");
    db.close();
  });
});

describe("Checkpoint Manager", () => {

  afterEach(() => {
    sinon.restore();
  });

  it("open missing local file should return undefined", async () => {
    const checkpoint = {
      iTwinId: "5678",
      iModelId: "910",
      changeset: { id: "1234" },
    };
    const request = {
      localFile: V1CheckpointManager.getFileName(checkpoint),
      checkpoint,
    };
    const db = CheckpointManager.tryOpenLocalFile(request);
    assert.isUndefined(db);
  });

  it("open a bad bim file should return undefined", async () => {
    const checkpoint = {
      iTwinId: "5678",
      iModelId: "910",
      changeset: { id: "1234" },
    };

    // Setup a local file
    const folder = V1CheckpointManager.getFolder(checkpoint.iModelId);
    if (!IModelJsFs.existsSync(folder))
      IModelJsFs.recursiveMkDirSync(folder);

    const outputFile = V1CheckpointManager.getFileName(checkpoint);
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.unlinkSync(outputFile);

    IModelJsFs.writeFileSync(outputFile, "Testing");

    // Attempt to open the file
    const request = {
      localFile: V1CheckpointManager.getFileName(checkpoint),
      checkpoint,
    };
    const db = CheckpointManager.tryOpenLocalFile(request);
    assert.isUndefined(db);
  });

  it("should fail when downloadCheckpoint does not throw a transient error", async () => {
    // Mock iModelHub
    const mockCheckpointV2: V2CheckpointAccessProps = {
      accountName: "testAccount",
      containerId: "imodelblocks-123",
      sasToken: "testSAS",
      dbName: "testDb",
      storageType: "azure?sas=1",
    };

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const v2Spy = sinon.stub(V2CheckpointManager, "downloadCheckpoint").onCall(0).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(1).callsFake(async () => {
      throw Error("Failure when receiving data from the"); // Not a retryable error so we'll fail
    }).callThrough();

    const iModelId = Guid.createValue();
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");
    const request = { localFile, checkpoint: { accessToken: "dummy", iTwinId, iModelId, changeset } };
    await expect(CheckpointManager.downloadCheckpoint(request)).to.eventually.be.rejectedWith("Failure when receiving data from the");
    assert.isTrue(v2Spy.callCount === 2, `Expected call count of 2, but got ${v2Spy.callCount}`);
  });

  it("should fail when downloadCheckpoint throws transient error too many times", async () => {
    // Mock iModelHub
    const mockCheckpointV2: V2CheckpointAccessProps = {
      accountName: "testAccount",
      containerId: "imodelblocks-123",
      sasToken: "testSAS",
      dbName: "testDb",
      storageType: "azure?sas=1",
    };

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    // Should break out of the loop to try downloadCheckpoint, we'll hit the max number of attempts here in this scenario and then throw in doDownload in CheckpointManager
    const v2Spy = sinon.stub(V2CheckpointManager, "downloadCheckpoint").onCall(0).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(1).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(2).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(3).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(4).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(5).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).onCall(6).callsFake(async () => {
      throw Error("Failure when receiving data from the peer");
    }).callThrough();

    const iModelId = Guid.createValue();
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");
    const request = { localFile, checkpoint: { accessToken: "dummy", iTwinId, iModelId, changeset } };
    await expect(CheckpointManager.downloadCheckpoint(request)).to.eventually.be.rejectedWith("Failure when receiving data from the peer");
    assert.isTrue(v2Spy.callCount === 5, `Expected call count of 5, but got ${v2Spy.callCount}`);
  });

  it("downloadCheckpoint should fall back to use v1 checkpoints if v2 checkpoints are not enabled", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint.bim");
    const snapshot = SnapshotDb.createEmpty(dbPath, { rootSubject: { name: "test" } });
    const iModelId = snapshot.iModelId;
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.setITwinId(iTwinId);
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();
    snapshot.close();

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => { return undefined; });

    const v1Spy = sinon.stub(V1CheckpointManager, "downloadCheckpoint").callsFake(async (arg) => {
      IModelJsFs.copySync(dbPath, arg.localFile);
      return changeset.id;
    });

    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { accessToken: "dummy", iTwinId, iModelId, changeset } };
    await CheckpointManager.downloadCheckpoint(request);
    assert.isTrue(v1Spy.calledOnce);
  });
});
