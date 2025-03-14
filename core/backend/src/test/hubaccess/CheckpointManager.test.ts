/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { CheckpointManager, V2CheckpointManager } from "../../CheckpointManager";
import { IModelJsFs } from "../../IModelJsFs";
import { _hubAccess, _nativeDb } from "../../internal/Symbols";

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
      localFile: path.join(V2CheckpointManager.getFolder(), Guid.createValue()),
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
    const folder = path.join(V2CheckpointManager.getFolder(), checkpoint.iModelId);
    if (!IModelJsFs.existsSync(folder))
      IModelJsFs.recursiveMkDirSync(folder);

    const outputFile = path.join(V2CheckpointManager.getFolder(), `${checkpoint.changeset.id}.bim`);
    if (IModelJsFs.existsSync(outputFile))
      IModelJsFs.unlinkSync(outputFile);

    IModelJsFs.writeFileSync(outputFile, "Testing");

    // Attempt to open the file
    const request = {
      localFile: outputFile,
      checkpoint,
    };
    const db = CheckpointManager.tryOpenLocalFile(request);
    assert.isUndefined(db);
  });
});
