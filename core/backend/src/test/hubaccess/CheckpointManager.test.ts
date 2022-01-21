/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Guid, IModelStatus } from "@itwin/core-bentley";
import { ChangesetIdWithIndex, IModelError } from "@itwin/core-common";
import { HubMock } from "../";
import { CheckpointManager, V1CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelHost } from "../../core-backend";
import { SnapshotDb } from "../../IModelDb";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";

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
    sinon.stub(IModelHost.hubAccess, "downloadV2Checkpoint").callsFake(async () => { throw new IModelError(IModelStatus.NotFound, "Feature is disabled."); });

    const v1Spy = sinon.stub(V1CheckpointManager, "downloadCheckpoint").callsFake(async (arg) => {
      IModelJsFs.copySync(dbPath, arg.localFile);
      return changeset.id;
    });

    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { accessToken: "dummy", iTwinId, iModelId, changeset } };
    await CheckpointManager.downloadCheckpoint(request);
    assert.isTrue(v1Spy.calledOnce);
  });

  it("downloadCheckpoint should not fall back to use v1 checkpoints if v2 checkpoints are not enabled and only V2 is requested", async () => {
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
    const iModelError = new IModelError(IModelStatus.NotFound, "Feature is disabled.");
    sinon.stub(IModelHost.hubAccess, "downloadV2Checkpoint").callsFake(async () => { throw iModelError; });

    const v1Spy = sinon.stub(V1CheckpointManager, "downloadCheckpoint").callsFake(async (arg) => {
      IModelJsFs.copySync(dbPath, arg.localFile);
      return changeset.id;
    });

    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { accessToken: "dummy", iTwinId, iModelId, changeset }, downloadV2Only: true };
    await expect(CheckpointManager.downloadCheckpoint(request)).to.be.rejectedWith(iModelError);
    assert.isTrue(v1Spy.callCount === 0);
  });
  it("attempting to get a v2 checkpoint should throw if one doesn't exist at the requested changeset while dontApplyChangesets is true", async () => {
    const changeset: ChangesetIdWithIndex = { id: "dummyid", index: 1};
    const errorToBeThrown = new IModelError(IModelStatus.NotFound, `No v2 checkpoint exists at the requested changeset id dummyid AND dontApplyChangesets is true.`);
    const request = { localFile: "any", checkpoint: { accessToken: "dummy", iTwinId: "any", iModelId: "any", changeset }, dontApplyChangesets: true };
    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => undefined);
    await expect(V2CheckpointManager.getCheckpointDb(request)).to.be.rejectedWith("No v2 checkpoint exists at the requested changeset id dummyid AND dontApplyChangesets is true.");
  });
});
