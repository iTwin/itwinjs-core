/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import {
  BatchType, ContentIdProvider, defaultTileOptions, getTileObjectReference, IModelTileRpcInterface, iModelTileTreeIdToString,
  RpcManager, RpcRegistry, TileContentSource,
} from "@itwin/core-common";
import { AzureBlobStorageCredentials, GeometricModel3d, IModelDb, IModelHost, RpcTrace } from "@itwin/core-backend";
import { HubWrappers } from "@itwin/core-backend/lib/cjs/test";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import { HubUtility } from "../HubUtility";
import { startupForIntegration } from "./StartupShutdown";
import { gunzip } from "zlib";
import { promisify } from "util";

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

    const treeId = iModelTileTreeIdToString(modelId, { type: BatchType.Primary, edges: false }, defaultTileOptions);
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

/** https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azurite?tabs=visual-studio#well-known-storage-account-and-key */
const tileCacheAzureCredentials: AzureBlobStorageCredentials = {
  account: "devstoreaccount1",
  accessKey: "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
  baseUrl: "http://127.0.0.1:10000/devstoreaccount1",
};

describe("TileUpload", () => {
  let tileRpcInterface: IModelTileRpcInterface;
  let accessToken: AccessToken;
  let iTwinId: GuidString;
  let iModelId: GuidString;
  let objectReference: ReturnType<typeof getTileObjectReference> | undefined;

  before(async () => {
    // Shutdown IModelHost to allow this test to use it.
    await IModelHost.shutdown();

    await startupForIntegration({ tileCacheAzureCredentials });
    assert.isTrue(IModelHost.usingExternalTileCache);
    IModelHost.applicationId = "TestApplication";

    RpcManager.initializeInterface(IModelTileRpcInterface);
    tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);
    accessToken = await TestUtility.getAccessToken(TestUsers.regular);
    iTwinId = await HubUtility.getTestITwinId(accessToken);
    iModelId = await HubUtility.getTestIModelId(accessToken, HubUtility.testIModelNames.stadium);

    // Open and close the iModel to ensure it works and is closed
    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId, iModelId });
    assert.isDefined(iModel);
    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);

    await IModelHost.tileStorage!.initialize(iModelId);
  });

  after(async () => {
    // Delete cached tile
    if (objectReference)
      await IModelHost.tileStorage!.storage.deleteObject(objectReference);
    // Restart backend with default config
    await IModelHost.shutdown();
    await startupForIntegration({});
  });

  it("should upload tile to external cache with metadata", async () => {
    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken, iTwinId, iModelId });
    assert.isDefined(iModel);

    // Generate tile
    const tileProps = await getTileProps(iModel);
    assert.isDefined(tileProps);
    const tile = await RpcTrace.run({
      accessToken,
      activityId: "",
      applicationId: "",
      applicationVersion: "",
      sessionId: "",
    }, async () => tileRpcInterface.generateTileContent(iModel.getRpcProps(), tileProps!.treeId, tileProps!.contentId, tileProps!.guid));
    assert.equal(tile, TileContentSource.ExternalCache);

    // Query tile from tile cache
    objectReference = getTileObjectReference(iModel.iModelId, iModel.changeset.id, tileProps!.treeId, tileProps!.contentId, tileProps!.guid);
    const blobBuffer = await IModelHost.tileStorage!.storage.download(objectReference, "buffer");
    const blobProperties = await IModelHost.tileStorage!.storage.getObjectProperties(objectReference);

    const tileSize = IModelHost.compressCachedTiles
      ? (await promisify(gunzip)(blobBuffer) as Buffer).byteLength      // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
      : blobBuffer.byteLength;

    // Verify metadata in blob properties
    assert.isDefined(blobProperties.metadata);
    assert.isDefined(blobProperties.metadata!.tilegenerationtime);
    assert.equal(blobProperties.metadata!.backendname, IModelHost.applicationId);
    assert.equal(Number.parseInt(blobProperties.metadata!.tilesize, 10), tileSize);

    await HubWrappers.closeAndDeleteBriefcaseDb(accessToken, iModel);
  });
});
