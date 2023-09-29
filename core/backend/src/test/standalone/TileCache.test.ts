/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Guid, Logger } from "@itwin/core-bentley";
import {
  BatchType, ContentIdProvider, defaultTileOptions, IModelTileRpcInterface, iModelTileTreeIdToString, RpcActivity, RpcManager, RpcRegistry,
} from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { GeometricModel3d } from "../../Model";
import { RpcTrace } from "../../rpc/tracing";
import { TestUtils } from "../TestUtils";
import { IModelTestUtils } from "../IModelTestUtils";

const fakeRpc: RpcActivity = { // eslint-disable-line deprecation/deprecation
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
    const treeId = iModelTileTreeIdToString(modelId, { type: BatchType.Primary, edges: false as const }, defaultTileOptions);
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
    expect(iModel);
    // Generate tile
    const tileProps = await getTileProps(iModel);
    expect(tileProps);
    await RpcTrace.run(fakeRpc, async () => tileRpcInterface.generateTileContent(iModel.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid)); // eslint-disable-line deprecation/deprecation

    const tilesCache = `${iModel.pathName}.Tiles`;
    expect(IModelJsFs.existsSync(tilesCache)).true;

    iModel.close();
  };
  it("should create .tiles file next to .bim with default cacheDir", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();

    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    const snapshot = IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    snapshot.close();
    await verifyTileCache(dbPath);

  });
  it("should create .tiles file next to .bim with set cacheDir", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await TestUtils.shutdownBackend();
    const config = {
      cacheDir: TestUtils.getCacheDir(),
    };
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

    RpcManager.initializeInterface(IModelTileRpcInterface);
    const key = `${iModelId}\$${changeset.id}`;
    const tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);
    const tempFileBase = path.join(IModelHost.cacheDir, key);
    const checkpoint = SnapshotDb.openFile(dbPath, { key, tempFileBase });
    expect(checkpoint.nativeDb.getTempFileBaseName()).equals(tempFileBase);
    // Generate tile
    const tileProps = await getTileProps(checkpoint);
    expect(tileProps).not.undefined;

    sinon.stub(Logger, "logError").callsFake(() => Logger.stringifyMetaData());
    const errorStringify = sinon.spy(Logger, "stringifyMetaData");

    await RpcTrace.run(fakeRpc, async () => { // eslint-disable-line deprecation/deprecation
      Logger.logError("fake", "fake message");
      return tileRpcInterface.generateTileContent(checkpoint.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid);
    });

    const logMsg = errorStringify.getCall(0).returnValue;
    expect(logMsg).includes(`"ActivityId":"${fakeRpc.activityId}"`); // from rpc, should include RPC activity
    expect(logMsg).to.not.include("token"); // but token should not appear

    expect(IModelJsFs.existsSync(`${tempFileBase}.Tiles`)).true;
    checkpoint.close();
  });
});

