/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as Azure from "@azure/storage-blob";
import { GuidString } from "@bentley/bentleyjs-core";
import { IModelTileRpcInterface, IModelVersion, RpcManager, RpcRegistry } from "@bentley/imodeljs-common";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import { AuthorizedBackendRequestContext, BriefcaseManager, IModelHost, IModelHostConfiguration } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

interface TileContentRequestProps {
  treeId: string;
  contentId: string;
  guid: string;
}

describe("TileUpload (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  const testProjectName = "DesignReviewTestDatasets";
  const testIModelName = "RetailBuilding_OBD09_20190521";
  const testTileProps: TileContentRequestProps = {
    treeId: "17_1-E:0_0x20000000024",
    contentId: "-3-0-0-0-0-1",
    guid: "912c1c83ef5529214b66a4bd6fca9c5e28d250ac_82f852eccdc338a6",
  };
  let testIModelId: GuidString;
  let testProjectId: GuidString;
  let testChangeSetId: GuidString;
  let tileRpcInterface: IModelTileRpcInterface;
  let blockBlobUrl: Azure.BlockBlobURL;

  before(async () => {
    await IModelHost.shutdown();
    const config = new IModelHostConfiguration();

    // Default account and key for azurite
    config.tileCacheCredentials = {
      service: "azure",
      account: "devstoreaccount1",
      accessKey: "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    };

    await IModelHost.startup(config);
    assert.isTrue(IModelHost.usingExternalTileCache);
    IModelHost.applicationId = "TestApplication";

    RpcManager.initializeInterface(IModelTileRpcInterface);
    tileRpcInterface = RpcRegistry.instance.getImplForInterface<IModelTileRpcInterface>(IModelTileRpcInterface);

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testProjectId = await HubUtility.queryProjectIdByName(requestContext, testProjectName);
    testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, testIModelName);
    testChangeSetId = (await HubUtility.queryLatestChangeSet(requestContext, testIModelId))!.wsgId;

    // Get URL for cached tile
    const credentials = new Azure.SharedKeyCredential(config.tileCacheCredentials.account, config.tileCacheCredentials.accessKey);
    const pipeline = Azure.StorageURL.newPipeline(credentials);
    const serviceUrl = new Azure.ServiceURL(`http://127.0.0.1:10000/${credentials.accountName}`, pipeline);
    const containerUrl = Azure.ContainerURL.fromServiceURL(serviceUrl, testIModelId);
    const blobUrl = Azure.BlobURL.fromContainerURL(containerUrl, `tiles/${testTileProps.treeId}/${testTileProps.guid}/${testTileProps.contentId}`);
    blockBlobUrl = Azure.BlockBlobURL.fromBlobURL(blobUrl);

    // Point tileCacheService towards azurite URL
    (IModelHost.tileCacheService as any)._service = serviceUrl;

    // Open and close the iModel to ensure it works and is closed
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testIModelId, asOf: IModelVersion.asOfChangeSet(testChangeSetId).toJSON() });
    assert.isDefined(iModel);
    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);
  });

  after(async () => {
    await blockBlobUrl.delete(Azure.Aborter.none, { deleteSnapshots: "include" });
  });

  const deleteTestIModelCache = () => {
    const path = (BriefcaseManager as any).getIModelPath(testIModelId);
    (BriefcaseManager as any).deleteFolderAndContents(path);
  };

  it("should upload tile to external cache with metadata", async () => {
    // Clean folder to re-fetch briefcase
    deleteTestIModelCache();

    const version = IModelVersion.asOfChangeSet(testChangeSetId).toJSON();
    const iModel = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testIModelId, asOf: version });
    assert.isDefined(iModel);

    // Generate tile
    // eslint-disable-next-line deprecation/deprecation
    const tile = await tileRpcInterface.requestTileContent(iModel.getRpcProps(), testTileProps.treeId, testTileProps.contentId, undefined, testTileProps.guid);

    // Uploads to the cloud storage tile cache happen asynchronously. Don't resolve until they have all finished.
    await Promise.all(IModelHost.tileUploader.activeUploads);

    // Query tile from tile cache
    const blobProperties = await blockBlobUrl.getProperties(Azure.Aborter.none);

    // Verify metadata in blob properties
    assert.isDefined(blobProperties.metadata);
    assert.isDefined(blobProperties.metadata!.tilegenerationtime);
    assert.equal(blobProperties.metadata!.backendname, IModelHost.applicationId);
    assert.equal(blobProperties.metadata!.tilesize, tile.byteLength.toString());

    await IModelTestUtils.closeAndDeleteBriefcaseDb(requestContext, iModel);
  });
});
