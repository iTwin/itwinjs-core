/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
// import { Version } from "../imodelhub/Versions";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { RealityDataServicesClient, RealityData } from "../RealityDataServicesClient";
// import { IModelHubClient } from "../imodeljs-clients";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
chai.should();

describe.skip("RealityDataServicesClient", () => {

  let accessToken: AccessToken;
  // const imodelHubClient: IModelHubClient = new IModelHubClient();
  const realityDataServiceClient: RealityDataServicesClient = new RealityDataServicesClient();
  const projectId: string = "fb1696c8-c074-4c76-a539-a5546e048cc6";
  // const iModelId: string = "0c315eb1-d10c-4449-9c09-f36d54ad37f2";
  // let versionId: string;
  const tilesId: string = "62ad85eb-854f-4814-b7de-3479855a2165";
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await realityDataServiceClient.getAccessToken(actx, authToken);

    // const imodelHubToken = await imodelHubClient.getAccessToken(actx, authToken);
    // const versions: Version[] = await imodelHubClient.versions.get(actx, imodelHubToken, iModelId);
    // chai.expect(versions);
    // versionId = versions[0].wsgId;
    // chai.expect(versionId);

    // const instanceId: string = `${projectId}--${iModelId}--${versionId}`;
    // const queryOptions: RequestQueryOptions = {
    //   $select: "*",
    //   $filter: `$id+eq+'${instanceId}'`,
    // };

    chai.expect(tilesId);
  });

  it("should be able to retrieve reality data properties  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData[] = await realityDataServiceClient.getRealityData(actx, accessToken, projectId, tilesId);
    // ##TODO Alain Robert - Should validate content (same tileid, proper type and so one)
    chai.assert(realityData);
  });

  it("should be able to retrieve reality data properties for every reality data associated to project (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInProject(actx, accessToken, projectId);

    // ##TODO Alain Robert - Should validate content (verify that there is indeed an association to the project for example)
    realityData.forEach((value) => {
      chai.assert(value.type === "RealityMesh3DTiles"); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      // We should also make sure the footprint is set but we have legacy data
    });

    chai.assert(realityData);
  });

  it("should be able to retrieve app data json blob url  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const url: string = await realityDataServiceClient.getRootDocumentJson(actx, accessToken, projectId, tilesId);

    chai.assert(url);
  });

  // ##TODO Alain Robert - Should be modified ... Appdata is a cesium thing that does not exist for newer Reality Data.
  it("should be able to get model data json  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const rootData: any = await realityDataServiceClient.getRootDocumentJson(actx, accessToken, projectId, tilesId);
    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    chai.assert(rootData);

    // ##TODO Alain Robert ... should check for root JSON props not AppData.
    const modelName = rootDataJson.models[Object.keys(rootDataJson.models)[0]].tilesetUrl;
    chai.assert(modelName);

    const modelData: any = await realityDataServiceClient.getModelData(actx, accessToken, projectId, tilesId, modelName);

    chai.assert(modelData);
  });

  // ##TODO Alain Robert - Should be modified ... Appdata is a cesium thing that does not exist for newer Reality Data.
  it("should be able to get model data content  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const rootData: any = await realityDataServiceClient.getRootDocumentJson(actx, accessToken, projectId, tilesId);
    const rootDataJson = JSON.parse(rootData.toString("utf8"));
    const modelName = rootDataJson.models[Object.keys(rootDataJson.models)[0]].tilesetUrl;

    chai.assert(rootData);
    chai.assert(modelName);

    const modelData: any = await realityDataServiceClient.getModelData(actx, accessToken, projectId, tilesId, modelName);
    const modelDataJson = JSON.parse(modelData.toString("utf8"));

    let contentPath = modelDataJson.root.content.url;
    contentPath = `TileSets//Bim//${contentPath.split(".")[0]}/${contentPath}`;

    const data: any = await realityDataServiceClient.getTileContent(actx, accessToken, projectId, tilesId, contentPath);

    chai.assert(data);
  });

});
