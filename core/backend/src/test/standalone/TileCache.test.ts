/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as sinon from "sinon";
import * as path from "path";
import { BlobDaemon } from "@bentley/imodeljs-native";
import { DbResult, Guid, Logger } from "@itwin/core-bentley";
import { BatchType, ContentIdProvider, defaultTileOptions, IModelTileRpcInterface, iModelTileTreeIdToString, RpcActivity, RpcManager, RpcRegistry } from "@itwin/core-common";
import { V2CheckpointAccessProps } from "../../BackendHubAccess";
import { IModelHost, IModelHostConfiguration } from "../../IModelHost";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { RpcTrace } from "../../RpcBackend";
import { IModelTestUtils, TestUtils } from "../index";
import { IModelJsFs } from "../../IModelJsFs";

import { HubMock } from "..";
import { GeometricModel3d } from "../../Model";

const fakeRpc: RpcActivity = {
  accessToken: "dummy",
  activityId: "activity123",
  applicationId: "rpc test app",
  applicationVersion: "1.2.3",
  sessionId: "session 123",
};

interface TileContentRequestProps {
  treeId: string;
  contentId: string;
  guid: string;
}

// Goes through models in imodel until it finds a root tile for a non empty model, returns tile content request props for that tile
export async function getTileProps(iModel: IModelDb): Promise<TileContentRequestProps | undefined> {
  const queryParams = { from: GeometricModel3d.classFullName, limit: IModelDb.maxLimit };
  for (const modelId of iModel.queryEntityIds(queryParams)) {
    let model;
    try {
      model = iModel.models.getModel<GeometricModel3d>(modelId);
    } catch (err) {
      continue;
    }

    if (model.isNotSpatiallyLocated || model.isTemplate)
      continue;

    iModelTileTreeIdToString;
    const treeId = iModelTileTreeIdToString(modelId, { type: BatchType.Primary, edgesRequired: false }, defaultTileOptions);
    const treeProps = await iModel.tiles.requestTileTreeProps(treeId);
    // Ignore empty tile trees.
    if (treeProps.rootTile.maximumSize === 0 && treeProps.rootTile.isLeaf === true)
      continue;

    let guid = model.geometryGuid || iModel.changeset.id || "first";
    if (treeProps.contentIdQualifier)
      guid = `${guid}_${treeProps.contentIdQualifier}`;

    const idProvider = ContentIdProvider.create(true, defaultTileOptions);
    const contentId = idProvider.rootContentId;

    return {
      treeId,
      contentId,
      guid,
    };
  }

  return undefined;
}

describe("TileCache open v1", () => {
  let tileRpcInterface: IModelTileRpcInterface;

  const verifyTileCache = async (dbPath: string) => {
    RpcManager.initializeInterface(IModelTileRpcInterface);
    tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    const iModel = SnapshotDb.openFile(dbPath);
    assert.isDefined(iModel);
    // Generate tile
    const tileProps = await getTileProps(iModel);
    assert.isDefined(tileProps);
    await RpcTrace.run(fakeRpc, async () => tileRpcInterface.generateTileContent(iModel.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid));

    const tilesCache = `${iModel.pathName}.Tiles`;
    assert.isTrue(IModelJsFs.existsSync(tilesCache));

    iModel.close();
  };
  it("should create .tiles file next to .bim with default cacheDir", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await TestUtils.shutdownBackend();
    const config = new IModelHostConfiguration();
    await TestUtils.startBackend(config);

    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    const snapshot = IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    snapshot.close();
    await verifyTileCache(dbPath);

  });
  it("should create .tiles file next to .bim with set cacheDir", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await TestUtils.shutdownBackend();
    const config = new IModelHostConfiguration();
    config.cacheDir = path.join(__dirname, ".cache");
    await TestUtils.startBackend(config);

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
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id); // even fake checkpoints need a changesetId!
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

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);
    const daemonSuccessResult = { result: DbResult.BE_SQLITE_OK, errMsg: "" };
    sinon.stub(BlobDaemon, "command").callsFake(async () => daemonSuccessResult);
    // Mock blockcacheVFS daemon
    sinon.stub(BlobDaemon, "getDbFileName").callsFake(() => dbPath);

    process.env.BLOCKCACHE_DIR = "/foo/";
    const checkpointProps = { accessToken: "dummy", iTwinId, iModelId, changeset };

    const errorLogStub = sinon.stub(Logger, "logError").callsFake(() => Logger.stringifyMetaData());
    const errorStringify = sinon.spy(Logger, "stringifyMetaData");

    const checkpoint = await SnapshotDb.openCheckpointV2(checkpointProps);
    assert.equal(errorLogStub.callCount, 1); // checkpoint token expiry bad
    assert.equal(errorStringify.getCall(0).returnValue, ""); // not from RPC, no metadata

    // Generate tile
    const tileProps = await getTileProps(checkpoint);
    assert.isDefined(tileProps);
    errorStringify.resetHistory();

    await RpcTrace.run(fakeRpc, async () => tileRpcInterface.generateTileContent(checkpoint.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid));
    assert.equal(errorLogStub.callCount, 2); // checkpoint token expiry bad, should be logged with RPC info

    assert.include(errorStringify.getCall(0).returnValue, `"ActivityId":"${fakeRpc.activityId}"`); // from rpc, should include RPC activity
    expect(errorStringify.getCall(0).returnValue).to.not.include("token"); // but token should not appear

    // Make sure .Tiles exists in the cacheDir. This was enforced by opening it as a V2 Checkpoint which passes as part of its open params a tempFileBasename.
    const tempFileBase = path.join(IModelHost.cacheDir, `${checkpointProps.iModelId}\$${checkpointProps.changeset.id}`);
    assert.isTrue(IModelJsFs.existsSync(`${tempFileBase}.Tiles`));
    checkpoint.close();
  });
});

