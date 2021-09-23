/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as Azure from "@azure/storage-blob";
import { GuidString } from "@bentley/bentleyjs-core";
import {
  BatchType, CloudStorageTileCache, ContentIdProvider, defaultTileOptions, IModelRpcProps, IModelTileRpcInterface, iModelTileTreeIdToString, RpcManager, RpcRegistry, TileContentSource,
} from "@bentley/imodeljs-common";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import * as zlib from "zlib";
import { IModelDb } from "../../IModelDb";
import { AuthorizedBackendRequestContext, GeometricModel3d, IModelHost, IModelHostConfiguration } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

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

describe("TileUpload (#integration)", () => {
  let user: AuthorizedBackendRequestContext;
  let testIModelId: GuidString;
  let testContextId: GuidString;
  let tileRpcInterface: IModelTileRpcInterface;
  let blobService: Azure.BlobServiceClient;

  before(async () => {
    // Shutdown IModelHost to allow this test to use it.
    await IModelTestUtils.shutdownBackend();

    const config = new IModelHostConfiguration();

    // Default account and key for azurite
    config.tileCacheCredentials = {
      service: "azure",
      account: "devstoreaccount1",
      accessKey: "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    };

    await IModelTestUtils.startBackend(config);

    assert.isTrue(IModelHost.usingExternalTileCache);
    IModelHost.applicationId = "TestApplication";

    RpcManager.initializeInterface(IModelTileRpcInterface);
    tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    user = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testContextId = await HubUtility.getTestITwinId(user);
    testIModelId = await HubUtility.getTestIModelId(user, HubUtility.testIModelNames.stadium);

    // Get URL for cached tile
    const credentials = new Azure.StorageSharedKeyCredential(config.tileCacheCredentials.account, config.tileCacheCredentials.accessKey);
    const pipeline = Azure.newPipeline(credentials);
    blobService = new Azure.BlobServiceClient(`http://127.0.0.1:10000/${credentials.accountName}`, pipeline);

    // Point tileCacheService towards azurite URL
    (IModelHost.tileCacheService as any)._service = blobService;

    // Open and close the iModel to ensure it works and is closed
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ user, iTwinId: testContextId, iModelId: testIModelId });
    assert.isDefined(iModel);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(user, iModel);
  });

  after(async () => {
    // Re-start backend with default config
    await IModelTestUtils.shutdownBackend();
    await IModelTestUtils.startBackend();
  });

  it("should upload tile to external cache with metadata", async () => {
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ user, iTwinId: testContextId, iModelId: testIModelId });
    assert.isDefined(iModel);

    // Generate tile
    const tileProps = await getTileProps(iModel);
    assert.isDefined(tileProps);
    const tile = await tileRpcInterface.generateTileContent(iModel.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid);

    assert.equal(tile, TileContentSource.ExternalCache);

    // Query tile from tile cache
    const blobName = CloudStorageTileCache.getCache().formResourceName({ ...tileProps!, tokenProps: {} as IModelRpcProps });
    const containerUrl = blobService.getContainerClient(testIModelId);
    const blob = containerUrl.getBlockBlobClient(blobName);
    const blobProperties = await blob.getProperties();
    const blobStream = (await blob.download()).readableStreamBody!;
    const decompressor: NodeJS.ReadableStream = IModelHost.compressCachedTiles ? blobStream.pipe(zlib.createGunzip()) : blobStream;

    let tileSize = 0;
    decompressor.on("data", (chunk: Buffer | string) => { tileSize += chunk.length; });
    await new Promise((resolve, reject) => {
      decompressor.on("end", resolve).on("error", reject);
    });

    // Verify metadata in blob properties
    assert.isDefined(blobProperties.metadata);
    assert.isDefined(blobProperties.metadata!.tilegenerationtime);
    assert.equal(blobProperties.metadata!.backendname, IModelHost.applicationId);
    assert.equal(Number.parseInt(blobProperties.metadata!.tilesize, 10), tileSize);

    await blob.delete();
    await IModelTestUtils.closeAndDeleteBriefcaseDb(user, iModel);
  });
});

