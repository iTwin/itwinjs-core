/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext, DbResult, Guid } from "@bentley/bentleyjs-core";
import { IModelTileRpcInterface, RpcManager, RpcRegistry } from "@bentley/imodeljs-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelHost, IModelHostConfiguration } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import * as path from "path";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelHubBackend } from "../../IModelHubBackend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BlobDaemon } from "@bentley/imodeljs-native";
import { getTileProps } from "../integration/TileUpload.test";
import { CheckpointV2 } from "@bentley/imodelhub-client";
import sinon = require("sinon");

describe("TileCache open v1", () => {
  let tileRpcInterface: IModelTileRpcInterface;

  before(async () => {

  });
  const verifyTileCache = async (dbPath: string) => {
    RpcManager.initializeInterface(IModelTileRpcInterface);
    tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    const iModel = SnapshotDb.openFile(dbPath);
    assert.isDefined(iModel);
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    // Generate tile
    // eslint-disable-next-line deprecation/deprecation
    const tileProps = await getTileProps(iModel, requestContext);
    assert.isDefined(tileProps);
    await tileRpcInterface.requestTileContent(iModel.getRpcProps(), tileProps!.treeId, tileProps!.contentId, undefined, tileProps!.guid); // eslint-disable-line deprecation/deprecation

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
  it("should place .Tiles in cacheDir", async () => {
    const dbPath = IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim");
    const snapshot = IModelTestUtils.createSnapshotFromSeed(dbPath, IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
    const iModelId = snapshot.getGuid();
    const contextId = Guid.createValue();
    const changeset = IModelTestUtils.generateChangeSetId();
    snapshot.nativeDb.saveProjectGuid(Guid.normalize(contextId));
    snapshot.nativeDb.saveLocalValue("ParentChangeSetId", changeset.id); // even fake checkpoints need a changeSetId!
    snapshot.saveChanges();
    snapshot.close();
    // Mock iModelHub
    const mockCheckpointV2: CheckpointV2 = {
      wsgId: "INVALID",
      ecId: "INVALID",
      changeset,
      containerAccessKeyAccount: "testAccount",
      containerAccessKeyContainer: `imodelblocks-${iModelId}`,
      containerAccessKeySAS: "testSAS",
      containerAccessKeyDbName: "testDb",
    };

    RpcManager.initializeInterface(IModelTileRpcInterface);
    const tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    const checkpointsV2Handler = IModelHubBackend.iModelClient.checkpointsV2;
    sinon.stub(checkpointsV2Handler, "get").callsFake(async () => [mockCheckpointV2]);
    sinon.stub(IModelHubBackend.iModelClient, "checkpointsV2").get(() => checkpointsV2Handler);
    const daemonSuccessResult = { result: DbResult.BE_SQLITE_OK, errMsg: "" };
    sinon.stub(BlobDaemon, "command").callsFake(async () => daemonSuccessResult);
    // Mock blockcacheVFS daemon
    sinon.stub(BlobDaemon, "getDbFileName").callsFake(() => dbPath);

    process.env.BLOCKCACHE_DIR = "/foo/";
    const ctx = ClientRequestContext.current as AuthorizedClientRequestContext;
    const checkpointProps = { requestContext: ctx, contextId, iModelId, changeset };
    const checkpoint = await SnapshotDb.openCheckpointV2(checkpointProps);

    // Generate tile
    // eslint-disable-next-line deprecation/deprecation
    const tileProps = await getTileProps(checkpoint, ctx);
    assert.isDefined(tileProps);
    await tileRpcInterface.requestTileContent(checkpoint.getRpcProps(), tileProps!.treeId, tileProps!.contentId, undefined, tileProps!.guid); // eslint-disable-line deprecation/deprecation

    // Make sure .Tiles exists in the cacheDir. This was enforced by opening it as a V2 Checkpoint which passes as part of its open params a tempFileBasename.
    const tempFileBase = path.join(IModelHost.cacheDir, `${checkpointProps.iModelId}\$${checkpointProps.changeset.id}`);
    assert.isTrue(IModelJsFs.existsSync(`${tempFileBase}.Tiles`));
    checkpoint.close();
  });
});
