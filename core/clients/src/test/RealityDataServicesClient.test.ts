/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Version } from "../imodelhub";
import { TilesGeneratorClient, Job } from "../TilesGeneratorClient";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { RequestQueryOptions } from "../Request";
import { RealityDataServicesClient, RealityData } from "../RealityDataServicesClient";
import { IModelHubClient } from "..";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { KnownRegions } from "../Client";
import { Config } from "../Config";
chai.should();

describe.skip("RealityDataServicesClient", () => {

  let accessToken: AccessToken;
  const imodelHubClient: IModelHubClient = new IModelHubClient();
  const tilesGeneratorClient: TilesGeneratorClient = new TilesGeneratorClient();
  const realityDataServiceClient: RealityDataServicesClient = new RealityDataServicesClient();
  const projectId: string = "b2101b1a-0c1f-451e-97f2-6599bf900d36";
  const iModelId: string = "0c315eb1-d10c-4449-9c09-f36d54ad37f2";
  let versionId: string;
  let tilesId: string;
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== Number(KnownRegions.DEV))
      this.skip();

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await realityDataServiceClient.getAccessToken(actx, authToken);

    const imodelHubToken = await imodelHubClient.getAccessToken(actx, authToken);
    const versions: Version[] = await imodelHubClient.Versions().get(actx, imodelHubToken, new Guid(iModelId));
    chai.expect(versions);
    versionId = versions[0].wsgId;
    chai.expect(versionId);

    // Update access token to that for TilesGeneratorClient
    const tilesGeneratorToken = await tilesGeneratorClient.getAccessToken(actx, authToken);
    const instanceId: string = `${projectId}--${iModelId}--${versionId}`;
    const queryOptions: RequestQueryOptions = {
      $select: "*",
      $filter: `$id+eq+'${instanceId}'`,
    };

    const job: Job = await tilesGeneratorClient.getJob(actx, tilesGeneratorToken, queryOptions);
    chai.expect(job);

    chai.expect(job.tilesId);
    tilesId = job.tilesId!;
  });

  it("should be able to retrieve reality data properties  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData[] = await realityDataServiceClient.getRealityData(actx, accessToken, projectId, tilesId);

    chai.assert(realityData);
  });

  it("should be able to retrieve app data json blob url  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const url: string = await realityDataServiceClient.getAppDataBlobUrl(actx, accessToken, projectId, tilesId);

    chai.assert(url);
  });

  it("should be able to get app data json  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const appData: any = await realityDataServiceClient.getAppData(actx, accessToken, projectId, tilesId);

    chai.assert(appData);
  });

  it("should be able to get model data json  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const appData: any = await realityDataServiceClient.getAppData(actx, accessToken, projectId, tilesId);
    const appDataJson = JSON.parse(appData.toString("utf8"));

    const modelName = appDataJson.models[Object.keys(appDataJson.models)[0]].tilesetUrl;

    chai.assert(appData);
    chai.assert(modelName);

    const modelData: any = await realityDataServiceClient.getModelData(actx, accessToken, projectId, tilesId, modelName);

    chai.assert(modelData);
  });

  it("should be able to get model data content  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const appData: any = await realityDataServiceClient.getAppData(actx, accessToken, projectId, tilesId);
    const appDataJson = JSON.parse(appData.toString("utf8"));
    const modelName = appDataJson.models[Object.keys(appDataJson.models)[0]].tilesetUrl;

    chai.assert(appData);
    chai.assert(modelName);

    const modelData: any = await realityDataServiceClient.getModelData(actx, accessToken, projectId, tilesId, modelName);
    const modelDataJson = JSON.parse(modelData.toString("utf8"));

    let contentPath = modelDataJson.root.content.url;
    contentPath = `TileSets//Bim//${contentPath.split(".")[0]}/${contentPath}`;

    const data: any = await realityDataServiceClient.getTileContent(actx, accessToken, projectId, tilesId, contentPath);

    chai.assert(data);
  });

});
