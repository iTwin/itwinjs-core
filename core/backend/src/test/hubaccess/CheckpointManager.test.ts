/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Guid, Logger } from "@itwin/core-bentley";
import { CheckpointProps, V2CheckpointManager } from "../../CheckpointManager";
import { CloudSqlite } from "../../CloudSqlite";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { _hubAccess, _nativeDb } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";

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
    const db = IModelTestUtils.tryOpenLocalFile(request);
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
    const db = IModelTestUtils.tryOpenLocalFile(request);
    assert.isUndefined(db);
  });

  it("should redact the sasToken when logging that prefetch was skipped", async () => {
    const checkpoint: CheckpointProps = {
      iTwinId: Guid.createValue(),
      iModelId: Guid.createValue(),
      changeset: { id: "1234", index: 1 },
      accessToken: "userAccessToken",
    };
    const v2props = {
      accountName: "testAccount",
      containerId: Guid.createValue(), // unique so this test doesn't reuse a container cached by another test
      sasToken: "?sv=2018-03-28&sr=c&sp=rl&sig=superSecretSignature",
      dbName: "testDb",
      storageType: "azure",
    };

    sinon.stub(IModelHost, _hubAccess).get(() => ({ queryV2Checkpoint: async () => v2props } as any));
    sinon.stub(IModelHost, "appWorkspace").get(() => ({
      settings: {
        getBoolean: (name: string, defaultVal: boolean) => name === "Checkpoints/prefetch" ? true : defaultVal,
        getNumber: (_name: string, defaultVal: number) => defaultVal,
      },
    } as any));
    sinon.stub(CloudSqlite, "createCloudContainer").returns({
      containerId: v2props.containerId,
      accessToken: v2props.sasToken,
      isConnected: true,
      checkForChanges: () => { },
      disconnect: () => { }, // V2CheckpointManager caches this container, and disconnects it when IModelHost shuts down
      queryDatabase: () => ({ totalBlocks: 1, nPrefetch: 1 }), // an in-progress prefetch forces the "skipping prefetch" path
    } as any);
    const logInfo = sinon.stub(Logger, "logInfo");

    await V2CheckpointManager.attach(checkpoint);

    const skipped = logInfo.args.find((args) => args[1].includes("Skipping prefetch"));
    if (undefined === skipped)
      assert.fail("expected a log message about skipping prefetch");

    const metaData = skipped[2] as any;
    assert.equal(metaData.v2props.sasToken, "...");
    assert.equal(metaData.v2props.containerId, v2props.containerId);
    assert.notInclude(JSON.stringify(metaData), "superSecretSignature");
  });
});
