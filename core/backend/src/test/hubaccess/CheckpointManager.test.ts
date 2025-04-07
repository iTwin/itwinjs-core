/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, assert, beforeAll, describe, it } from "vitest";
import path from "node:path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { CheckpointManager, V2CheckpointManager } from "../../CheckpointManager.js";
import { IModelJsFs } from "../../IModelJsFs.js";
import { _hubAccess, _nativeDb } from "../../internal/Symbols.js";
import { TestUtils } from "../TestUtils.js";

describe("Checkpoint Manager", () => {
  beforeAll(async () => {
    await TestUtils.startBackend();
  });

  afterAll(async () => {
    await TestUtils.shutdownBackend();
  });

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
