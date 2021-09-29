/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Guid } from "@bentley/bentleyjs-core";
import { IModelTileRpcInterface, RpcInvocation, RpcManager, RpcRegistry } from "@bentley/imodeljs-common";
import { BlobDaemon } from "@bentley/imodeljs-native";
import { SnapshotDb } from "../../IModelDb";
import { AuthorizedBackendRequestContext, BackendRequestContext, IModelHost, IModelHostConfiguration } from "../../imodeljs-backend";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";
import { getTileProps } from "../integration/TileUpload.test";

import sinon = require("sinon");
import { V2CheckpointAccessProps } from "../../BackendHubAccess";

describe("TileCache open v1", () => {
  let tileRpcInterface: IModelTileRpcInterface;

  before(async () => {

  });
  const verifyTileCache = async (dbPath: string) => {
    RpcManager.initializeInterface(IModelTileRpcInterface);
    tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    const iModel = SnapshotDb.openFile(dbPath);
    assert.isDefined(iModel);
    // Generate tile
    const tileProps = await getTileProps(iModel);
    assert.isDefined(tileProps);
    await tileRpcInterface.generateTileContent(iModel.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid);

    const tilesCache = `${iModel.pathName}.Tiles`;
    assert.isTrue(IModelJsFs.existsSync(tilesCache));

    iModel.close();
  };
  it("should create .tiles file next to .bim with default cacheDir", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await IModelTestUtils.shutdownBackend();
    const config = new IModelHostConfiguration();
    await IModelTestUtils.startBackend(config);

    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    const snapshot = IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    snapshot.close();
    await verifyTileCache(dbPath);

  });
  it("should create .tiles file next to .bim with set cacheDir", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await IModelTestUtils.shutdownBackend();
    const config = new IModelHostConfiguration();
    config.cacheDir = path.join(__dirname, ".cache");
    await IModelTestUtils.startBackend(config);

    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    const snapshot = IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    snapshot.close();

    await verifyTileCache(dbPath);
  });
});

describe("TileCache, open v2", async () => {
  it("should place .Tiles in tempFileBase for V2 checkpoints", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    const snapshot = IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    const iModelId = snapshot.iModelId;
    const iTwinId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.setITwinId(iTwinId);
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id); // even fake checkpoints need a changeSetId!
    snapshot.saveChanges();
    snapshot.close();
    // Mock iModelHub
    const mockCheckpointV2: V2CheckpointAccessProps = {
      user: "testAccount",
      container: `imodelblocks-${iModelId}`,
      auth: "testSAS",
      dbAlias: "testDb",
      storageType: "azure?sas=1",
    };

    RpcManager.initializeInterface(IModelTileRpcInterface);
    const tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    // const checkpointsV2Handler = IModelHost.hubAccess;
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").get(() => mockCheckpointV2);
    const daemonSuccessResult = { result: DbResult.BE_SQLITE_OK, errMsg: "" };
    sinon.stub(BlobDaemon, "command").callsFake(async () => daemonSuccessResult);
    // Mock blockcacheVFS daemon
    sinon.stub(BlobDaemon, "getDbFileName").callsFake(() => dbPath);

    process.env.BLOCKCACHE_DIR = "/foo/";
    const user = new BackendRequestContext() as AuthorizedBackendRequestContext;
    const checkpointProps = { user, iTwinId, iModelId, changeset };
    const checkpoint = await SnapshotDb.openCheckpointV2(checkpointProps);

    // Generate tile
    const tileProps = await getTileProps(checkpoint);
    assert.isDefined(tileProps);
    RpcInvocation.currentRequest = user; // we're simulating an RPC call - set up the current invocation request that would normally come from PRC call
    await tileRpcInterface.generateTileContent(checkpoint.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid);

    // Make sure .Tiles exists in the cacheDir. This was enforced by opening it as a V2 Checkpoint which passes as part of its open params a tempFileBasename.
    const tempFileBase = path.join(IModelHost.cacheDir, `${checkpointProps.iModelId}\$${checkpointProps.changeset.id}`);
    assert.isTrue(IModelJsFs.existsSync(`${tempFileBase}.Tiles`));
    checkpoint.close();
  });
});
