/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { CheckpointManager } from "../../CheckpointManager";
import { _nativeDb, IModelHost } from "../../core-backend";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubMock } from "../../HubMock";

describe("Checkpoint Manager", () => {

  afterEach(() => {
    sinon.restore();
  });



  it("downloadCheckpoint should throw error if v2 checkpoints are not enabled", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint.bim");
    const snapshot = SnapshotDb.createEmpty(dbPath, { rootSubject: { name: "test" } });
    const iModelId = snapshot.iModelId;
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot[_nativeDb].setITwinId(iTwinId);
    snapshot[_nativeDb].saveLocalValue("ParentChangeSetId", changeset.id);
    snapshot.saveChanges();
    snapshot.close();

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => undefined);

    const localFile = IModelTestUtils.prepareOutputFile("IModel", "TestCheckpoint2.bim");

    const request = { localFile, checkpoint: { accessToken: "dummy", iTwinId, iModelId, changeset } };
    await CheckpointManager.downloadCheckpoint(request);
  });
});
