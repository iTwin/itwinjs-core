/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizationToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { RealityDataServicesClient, RealityData } from "../RealityDataServicesClient";
import { Range2d } from "@bentley/geometry-core";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

chai.should();

describe.skip("RealityDataServicesClient", () => {
  const realityDataServiceClient: RealityDataServicesClient = new RealityDataServicesClient();
  const projectId: string = "fb1696c8-c074-4c76-a539-a5546e048cc6";
  // const iModelId: string = "0c315eb1-d10c-4449-9c09-f36d54ad37f2";
  // let versionId: string;
  const tilesId: string = "593eff78-b757-4c07-84b2-a8fe31c19927";
  const tilesIdWithRootDocPath: string = "3317b4a0-0086-4f16-a979-6ceb496d785e";

  let requestContext: AuthorizedClientRequestContext;

  before(async function (this: Mocha.IHookCallbackContext) {
    const authToken: AuthorizationToken = await TestConfig.login();
    const accessToken = await realityDataServiceClient.getAccessToken(new ClientRequestContext(), authToken);
    requestContext = new AuthorizedClientRequestContext(accessToken);
  });

  it("should be able to retrieve reality data properties  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);
    chai.assert(realityData);
    chai.assert(realityData.id === tilesId);
    chai.assert(realityData.client);
    chai.assert(realityData.projectId === projectId);
  });

  it("should be able to retrieve reality data properties for every reality data associated to project (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInProject(requestContext, projectId);

    realityData.forEach((value) => {
      chai.assert(value.type === "RealityMesh3DTiles"); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      chai.assert(value.projectId === projectId);
      chai.assert(value.id);
    });

    chai.assert(realityData);
  });

  it("should be able to retrieve reality data properties for every reality data associated to project within an extent (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const theRange = Range2d.createXYXY(-80 * 3.1416 / 180, 39 * 3.1416 / 180, -74 * 3.1416 / 180, 42 * 3.1416 / 180); // Range encloses Pensylvania and should gather Shell project
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInProjectOverlapping(requestContext, projectId, theRange);

    realityData.forEach((value) => {
      chai.assert(value.type === "RealityMesh3DTiles"); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      chai.assert(value.projectId === projectId);
      chai.assert(value.id);
    });

    chai.assert(realityData);
  });

  it("should be able to retrieve app data json blob url  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const url: string = await realityData.getRootDocumentJson(requestContext);

    chai.assert(url);
  });

  it("should be able to get model data json  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const rootData: any = await realityData.getRootDocumentJson(requestContext);
    chai.assert(rootData);

    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    const modelName = rootDataJson.root.children[0].content.url;
    chai.assert(modelName);

    const modelData: any = await realityData.getModelData(requestContext, modelName);

    chai.assert(modelData);
  });

  it("should be able to get model data content  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const rootData: any = await realityData.getRootDocumentJson(requestContext);
    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    const modelName = rootDataJson.root.children[0].content.url;

    chai.assert(rootData);
    chai.assert(modelName);

    const modelData: any = await realityData.getModelData(requestContext, modelName);

    chai.assert(modelData);
  });

  it("should be able to parse a RDS URL and extract Reality Data Id", async function (this: Mocha.ITestCallbackContext) {
    const url1: string = "https://qa-connect-realitydataservices.bentley.com/v2.4/Repositories/S3MXECPlugin--Server/S3MX/RealityData/d629a312-1f8a-4c84-845f-87d0a27d6b9b";
    const url2: string = "https://qa-connect-realitydataservices.bentley.com/v2.4/Repositories/S3MXECPlugin--d629a312-1f8a-4c84-845f-87d0a27d6b9b/S3MX/Folder/09b676d1-f0ed-4eba-b47a-7991b05f280d~2FGraz~2F";
    const url3: string = "https://qa-connect-realitydataservices.bentley.com/v2.4/Repositories/S3MXECPlugin--caa80cb6-b3bd-44be-9178-a3d7cacaad51/S3MX/Document/a8136337-c563-424a-b3c3-17c41a984a94~2FGraz~2FScene~2FGraz.3mx";

    const realityDataId1 = realityDataServiceClient.getRealityDataIdFromUrl(url1);
    chai.assert(realityDataId1 === "d629a312-1f8a-4c84-845f-87d0a27d6b9b");

    const realityDataId2 = realityDataServiceClient.getRealityDataIdFromUrl(url2);
    chai.assert(realityDataId2 === "09b676d1-f0ed-4eba-b47a-7991b05f280d");

    const realityDataId3 = realityDataServiceClient.getRealityDataIdFromUrl(url3);
    chai.assert(realityDataId3 === "a8136337-c563-424a-b3c3-17c41a984a94");

    const invalidUrl1 = "http://myserver.com/v2.4/Reposi---es/S3MXECPlugin--Server/S3MX/RealityData/d629a312-1f8a-4c84-845f-87d0a27d6b9b";
    const invalidUrl2 = "https://myserver.com/path1/path2/path3/v2.4/Repositories/S3MXECPlugin--d629a312-1f8a-4c84-845f-87d0a27d6b9b/S3MX/Folder/09b676d1-f0ed-4eba-b47a-7991b05f280d~2FGraz~2F";
    const invalidUrl3 = "https://myserver.com/path1/path2/path3/v2.4/Repositories/--d629a312-1f8a-4c84-845f-87d0a27d6b9b/S3MX/Apple/09b676d1-f0ed-4eba-b47a-7991b05f280d~2FGraz~2F";

    const invalidRealityDataId1 = realityDataServiceClient.getRealityDataIdFromUrl(invalidUrl1);
    chai.assert(invalidRealityDataId1 === undefined);

    const invalidRealityDataId2 = realityDataServiceClient.getRealityDataIdFromUrl(invalidUrl2);
    chai.assert(invalidRealityDataId2 === undefined);

    const invalidRealityDataId3 = realityDataServiceClient.getRealityDataIdFromUrl(invalidUrl3);
    chai.assert(invalidRealityDataId3 === undefined);
  });

  it("should be able to get model data content with root doc not at blob root (root doc path) (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesIdWithRootDocPath);

    // The root document of this reality should not be at the root of the blob
    const rootParts = realityData.rootDocument!.split("/");
    chai.assert(rootParts.length >= 2);
    rootParts.pop();
    const rootDocPath: string = rootParts.join("/") + "/";

    const rootData: any = await realityData.getRootDocumentJson(requestContext);
    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    const modelName = rootDataJson.root.children[0].children[0].content.url;

    chai.assert(rootData);
    chai.assert(modelName);

    let exceptionThrown: boolean = false;
    try {
      // Should fail as we call with an incorrect content path.
      const data: any = await realityData.getTileContent(requestContext, modelName);
      chai.assert(!data); /// Should never be reached.
    } catch {
      exceptionThrown = true;
    }
    chai.assert(exceptionThrown);

    // Should succeed as we call with added root document path
    const data2: any = await realityData.getTileContent(requestContext, rootDocPath + modelName, false);

    chai.assert(data2);

    // Should succeed as we call with indicate that path is relative to root path
    const data3: any = await realityData.getTileContent(requestContext, modelName, true);

    chai.assert(data3);
  });

});
