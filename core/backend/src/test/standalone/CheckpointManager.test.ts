/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { ClientRequestContext, Guid, IModelHubStatus } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext, WsgError } from "@bentley/itwin-client";
import { CheckpointManager, V1CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { SnapshotDb } from "../../IModelDb";
import { IModelHost } from "../../imodeljs-backend";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelHubBackend } from "../../IModelHubBackend";

describe("V1 Checkpoint Manager", () => {
  it("empty props", async () => {
    const props = {
      iTwinId: "",
      iModelId: "",
      changeset: { id: "" },
      requestContext: new AuthorizedClientRequestContext(new AccessToken()),
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "checkpoints", "first.bim"));
  });

  it("changeset only props", async () => {
    const props = {
      iTwinId: "",
      iModelId: "",
      changeset: { id: "1234" },
      requestContext: new AuthorizedClientRequestContext(new AccessToken()),
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "checkpoints", "1234.bim"));
  });

  it("changeset+context props", async () => {
    const props = {
      iTwinId: "5678",
      iModelId: "",
      changeset: { id: "1234" },
      requestContext: new AuthorizedClientRequestContext(new AccessToken()),
    };
    assert.equal(V1CheckpointManager.getFileName(props), path.join(IModelHost.cacheDir, "imodels", "checkpoints", "1234.bim"));
  });

  it("changeset+context+imodel props", async () => {
    const props = {
      iTwinId: "5678",
      iModelId: "910",
      changeset: { id: "1234" },
      requestContext: new AuthorizedClientRequestContext(new AccessToken()),
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
    snapshot.nativeDb.saveProjectGuid(Guid.normalize(iTwinId));
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();

    assert.notEqual(iModelId, snapshot.nativeDb.getDbGuid()); // Ensure the Snapshot dbGuid and iModelId are different
    snapshot.close();

    sinon.stub(V2CheckpointManager, "downloadCheckpoint").callsFake(async (arg) => {
      IModelJsFs.copySync(dbPath, arg.localFile);
      return changeset.id;
    });

    const ctx = ClientRequestContext.current as AuthorizedClientRequestContext;
    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { user: ctx, iTwinId, iModelId, changeset } };
    await CheckpointManager.downloadCheckpoint(request);
    const db = SnapshotDb.openCheckpointV1(localFile, request.checkpoint);
    assert.equal(iModelId, db.nativeDb.getDbGuid(), "expected the V1 Checkpoint download to fix the improperly set dbGuid.");
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
      requestContext: new AuthorizedClientRequestContext(new AccessToken()),
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
      requestContext: new AuthorizedClientRequestContext(new AccessToken()),  // Why is this on CheckpointProps rather than DownloadRequest
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
    const iModelId = snapshot.getGuid();
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.saveProjectGuid(Guid.normalize(iTwinId));
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();
    snapshot.close();

    const checkpointsV2Handler = IModelHubBackend.iModelClient.checkpointsV2;
    sinon.stub(checkpointsV2Handler, "get").callsFake(async () => { throw new WsgError(IModelHubStatus.Unknown, "Feature is disabled."); });
    sinon.stub(IModelHubBackend.iModelClient, "checkpointsV2").get(() => checkpointsV2Handler);

    const v1Spy = sinon.stub(V1CheckpointManager, "downloadCheckpoint").callsFake(async (arg) => {
      IModelJsFs.copySync(dbPath, arg.localFile);
      return changeset.id;
    });

    const user = ClientRequestContext.current as AuthorizedClientRequestContext;
    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { user, iTwinId, iModelId, changeset } };
    await CheckpointManager.downloadCheckpoint(request);
    assert.isTrue(v1Spy.calledOnce);
  });
});
