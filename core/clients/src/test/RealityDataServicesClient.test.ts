/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext, Guid } from "@bentley/bentleyjs-core";
import { AuthorizationToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { RealityDataServicesClient, RealityData, RealityDataRelationship } from "../RealityDataServicesClient";
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

  it("should be able to retrieve the azure blob url  (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const url: URL = await realityData.getBlobUrl(requestContext);

    chai.assert(url);
  });

  it("should be able to retrieve the azure blob url (write access) (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const url: URL = await realityData.getBlobUrl(requestContext, true);

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

  it("should be able to create a reality data (without specific identifier) and delete it", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = new RealityData();
    realityData.name = "Test reality data 1";
    realityData.dataSet = "Test Dataset for iModelJS";
    realityData.group = "Test group";
    realityData.description = "Dummy description for a test reality data";
    realityData.rootDocument = "RootDocumentFile.txt";
    realityData.classification = "Undefined";
    realityData.streamed = false;
    realityData.type = "Undefined";
    realityData.approximateFootprint = true;
    realityData.copyright = "Bentley Systems inc. (c) 2019";
    realityData.termsOfUse = "Free for testing purposes only";
    realityData.metadataUrl = "";
    realityData.resolutionInMeters = "2.0x2.1";
    realityData.accuracyInMeters = undefined;
    realityData.visibility = "PERMISSION";
    realityData.listable = true;
    realityData.version = "1.1.1.1";

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(requestContext, projectId, realityData);
    chai.assert(realityDataAdded1.id && realityDataAdded1.id.length === 36);
    chai.assert(realityDataAdded1.name === realityData.name);
    chai.assert(realityDataAdded1.group === realityData.group);
    chai.assert(realityDataAdded1.dataSet === realityData.dataSet);
    chai.assert(realityDataAdded1.description === realityData.description);
    chai.assert(realityDataAdded1.rootDocument === realityData.rootDocument);
    chai.assert(realityDataAdded1.classification === realityData.classification);
    chai.assert(realityDataAdded1.streamed === realityData.streamed);
    chai.assert(realityDataAdded1.type === realityData.type);
    chai.assert(realityDataAdded1.copyright === realityData.copyright);
    chai.assert(realityDataAdded1.termsOfUse === realityData.termsOfUse);
    chai.assert(realityDataAdded1.metadataUrl === realityData.metadataUrl);
    chai.assert(realityDataAdded1.resolutionInMeters === realityData.resolutionInMeters);
    chai.assert(realityDataAdded1.accuracyInMeters === null);
    chai.assert(realityDataAdded1.visibility === realityData.visibility);
    chai.assert(realityDataAdded1.listable === realityData.listable);
    chai.assert(realityDataAdded1.version === realityData.version);

    chai.assert(realityDataAdded1.ultimateId && realityDataAdded1.ultimateId.length === 36);
    chai.assert(realityDataAdded1.creatorId && realityDataAdded1.creatorId.length === 36);
    chai.assert(realityDataAdded1.ownerId && realityDataAdded1.ownerId.length === 36);
    chai.assert(realityDataAdded1.ownedBy && realityDataAdded1.ownedBy.length > 0);
    chai.assert(realityDataAdded1.dataLocationGuid && realityDataAdded1.dataLocationGuid.length === 36);
    chai.assert(realityDataAdded1.containerName && realityDataAdded1.containerName.length === 36);
    chai.assert(realityDataAdded1.modifiedTimestamp && Date.parse(realityDataAdded1.modifiedTimestamp) !== undefined);
    chai.assert(realityDataAdded1.createdTimestamp && Date.parse(realityDataAdded1.createdTimestamp) !== undefined);
    // At creation the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);
    chai.assert(realityDataAdded1.hidden === false);

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataAdded1.id as string);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId as string);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded1.id as string);
  });

  it("should be able to create a reality data (with fixed specific identifier) and delete it", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = new RealityData();

    // Generate a temporary GUID. Data will be generated using this GUID.
    realityData.id = Guid.createValue();

    realityData.name = "Test reality data 1";
    realityData.dataSet = "Test Dataset for iModelJS";
    realityData.group = "Test group";
    realityData.description = "Dummy description for a test reality data";
    realityData.rootDocument = "RootDocumentFile.txt";
    realityData.classification = "Undefined";
    realityData.streamed = false;
    realityData.type = "Undefined";
    realityData.approximateFootprint = true;
    realityData.copyright = "Bentley Systems inc. (c) 2019";
    realityData.termsOfUse = "Free for testing purposes only";
    realityData.metadataUrl = "";
    realityData.resolutionInMeters = "2.0x2.1";
    realityData.accuracyInMeters = undefined;
    realityData.visibility = "PERMISSION";
    realityData.listable = true;
    realityData.version = "1.1.1.1";

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(requestContext, projectId, realityData);

    chai.assert(realityDataAdded1.id && realityDataAdded1.id.length === 36);
    chai.assert(realityDataAdded1.name === realityData.name);
    chai.assert(realityDataAdded1.group === realityData.group);
    chai.assert(realityDataAdded1.dataSet === realityData.dataSet);
    chai.assert(realityDataAdded1.description === realityData.description);
    chai.assert(realityDataAdded1.rootDocument === realityData.rootDocument);
    chai.assert(realityDataAdded1.classification === realityData.classification);
    chai.assert(realityDataAdded1.streamed === realityData.streamed);
    chai.assert(realityDataAdded1.type === realityData.type);
    chai.assert(realityDataAdded1.copyright === realityData.copyright);
    chai.assert(realityDataAdded1.termsOfUse === realityData.termsOfUse);
    chai.assert(realityDataAdded1.metadataUrl === realityData.metadataUrl);
    chai.assert(realityDataAdded1.resolutionInMeters === realityData.resolutionInMeters);
    chai.assert(realityDataAdded1.accuracyInMeters === null);
    chai.assert(realityDataAdded1.visibility === realityData.visibility);
    chai.assert(realityDataAdded1.listable === realityData.listable);
    chai.assert(realityDataAdded1.version === realityData.version);

    chai.assert(realityDataAdded1.ultimateId && realityDataAdded1.ultimateId.length === 36);
    chai.assert(realityDataAdded1.creatorId && realityDataAdded1.creatorId.length === 36);
    chai.assert(realityDataAdded1.ownerId && realityDataAdded1.ownerId.length === 36);
    chai.assert(realityDataAdded1.ownedBy && realityDataAdded1.ownedBy.length > 0);
    chai.assert(realityDataAdded1.dataLocationGuid && realityDataAdded1.dataLocationGuid.length === 36);
    chai.assert(realityDataAdded1.containerName && realityDataAdded1.containerName.length === 36);
    chai.assert(realityDataAdded1.modifiedTimestamp && Date.parse(realityDataAdded1.modifiedTimestamp) !== undefined);
    chai.assert(realityDataAdded1.createdTimestamp && Date.parse(realityDataAdded1.createdTimestamp) !== undefined);
    // At creation the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);
    chai.assert(realityDataAdded1.hidden === false);

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataAdded1.id as string);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId as string);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded1.id as string);
  });

  it("should be able to duplicate a reality data and delete it", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = new RealityData();

    // Generate a temporary GUID. Data will be generated using this GUID.
    realityData.id = Guid.createValue();

    realityData.name = "Test reality data 1";
    realityData.dataSet = "Test Dataset for iModelJS";
    realityData.group = "Test group";
    realityData.description = "Dummy description for a test reality data";
    realityData.rootDocument = "RootDocumentFile.txt";
    realityData.classification = "Undefined";
    realityData.streamed = false;
    realityData.type = "Undefined";
    realityData.approximateFootprint = true;
    realityData.copyright = "Bentley Systems inc. (c) 2019";
    realityData.termsOfUse = "Free for testing purposes only";
    realityData.metadataUrl = "";
    realityData.resolutionInMeters = "2.0x2.1";
    realityData.accuracyInMeters = undefined;
    realityData.visibility = "PERMISSION";
    realityData.listable = true;
    realityData.version = "1.1.1.1";

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(requestContext, projectId, realityData);

    chai.assert(realityDataAdded1.id && realityDataAdded1.id.length === 36);
    chai.assert(realityDataAdded1.name === realityData.name);
    chai.assert(realityDataAdded1.group === realityData.group);
    chai.assert(realityDataAdded1.dataSet === realityData.dataSet);
    chai.assert(realityDataAdded1.description === realityData.description);
    chai.assert(realityDataAdded1.rootDocument === realityData.rootDocument);
    chai.assert(realityDataAdded1.classification === realityData.classification);
    chai.assert(realityDataAdded1.streamed === realityData.streamed);
    chai.assert(realityDataAdded1.type === realityData.type);
    chai.assert(realityDataAdded1.copyright === realityData.copyright);
    chai.assert(realityDataAdded1.termsOfUse === realityData.termsOfUse);
    chai.assert(realityDataAdded1.metadataUrl === realityData.metadataUrl);
    chai.assert(realityDataAdded1.resolutionInMeters === realityData.resolutionInMeters);
    chai.assert(realityDataAdded1.accuracyInMeters === null);
    chai.assert(realityDataAdded1.visibility === realityData.visibility);
    chai.assert(realityDataAdded1.listable === realityData.listable);
    chai.assert(realityDataAdded1.version === realityData.version);

    chai.assert(realityDataAdded1.ultimateId && realityDataAdded1.ultimateId.length === 36);
    chai.assert(realityDataAdded1.creatorId && realityDataAdded1.creatorId.length === 36);
    chai.assert(realityDataAdded1.ownerId && realityDataAdded1.ownerId.length === 36);
    chai.assert(realityDataAdded1.ownedBy && realityDataAdded1.ownedBy.length > 0);
    chai.assert(realityDataAdded1.dataLocationGuid && realityDataAdded1.dataLocationGuid.length === 36);
    chai.assert(realityDataAdded1.containerName && realityDataAdded1.containerName.length === 36);
    chai.assert(realityDataAdded1.modifiedTimestamp && Date.parse(realityDataAdded1.modifiedTimestamp) !== undefined);
    chai.assert(realityDataAdded1.createdTimestamp && Date.parse(realityDataAdded1.createdTimestamp) !== undefined);
    // At creation the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);
    chai.assert(realityDataAdded1.hidden === false);

    // Set to undefined read-only values (that can prevent creation)
    realityDataAdded1.createdTimestamp = undefined;
    realityDataAdded1.dataLocationGuid = undefined;  // This one is not a read-only value but we do not want to impose the data location.
    realityDataAdded1.sizeUpToDate = undefined;
    realityDataAdded1.size = undefined;
    realityDataAdded1.ultimateId = undefined;
    realityDataAdded1.ultimateSite = undefined;
    realityDataAdded1.containerName = undefined;
    realityDataAdded1.creatorId = undefined;
    realityDataAdded1.lastAccessedTimestamp = undefined;
    realityDataAdded1.modifiedTimestamp = undefined;
    realityDataAdded1.organizationId = undefined;
    realityDataAdded1.ownedBy = undefined;
    realityDataAdded1.ownerId = undefined;

    // Note in a cross environment duplication there is no need to undefine the id
    const realityDataId1: string = realityDataAdded1.id as string;
    realityDataAdded1.id = undefined;
    realityDataAdded1.wsgId = "";

    const realityDataAdded2 = await realityDataServiceClient.createRealityData(requestContext, projectId, realityDataAdded1);

    chai.assert(realityDataAdded2.id && realityDataAdded2.id.length === 36);
    chai.assert(realityDataAdded2.name === realityDataAdded1.name);
    chai.assert(realityDataAdded2.group === realityDataAdded1.group);
    chai.assert(realityDataAdded2.dataSet === realityDataAdded1.dataSet);
    chai.assert(realityDataAdded2.description === realityDataAdded1.description);
    chai.assert(realityDataAdded2.rootDocument === realityDataAdded1.rootDocument);
    chai.assert(realityDataAdded2.classification === realityDataAdded1.classification);
    chai.assert(realityDataAdded2.streamed === realityDataAdded1.streamed);
    chai.assert(realityDataAdded2.type === realityDataAdded1.type);
    chai.assert(realityDataAdded2.copyright === realityDataAdded1.copyright);
    chai.assert(realityDataAdded2.termsOfUse === realityDataAdded1.termsOfUse);
    chai.assert(realityDataAdded2.metadataUrl === realityDataAdded1.metadataUrl);
    chai.assert(realityDataAdded2.resolutionInMeters === realityDataAdded1.resolutionInMeters);
    chai.assert(realityDataAdded2.accuracyInMeters === null);
    chai.assert(realityDataAdded2.visibility === realityDataAdded1.visibility);
    chai.assert(realityDataAdded2.listable === realityDataAdded1.listable);
    chai.assert(realityDataAdded2.version === realityDataAdded1.version);

    chai.assert(realityDataAdded2.ultimateId && realityDataAdded2.ultimateId.length === 36);
    chai.assert(realityDataAdded2.creatorId && realityDataAdded2.creatorId.length === 36);
    chai.assert(realityDataAdded2.ownerId && realityDataAdded2.ownerId.length === 36);
    chai.assert(realityDataAdded2.ownedBy && realityDataAdded2.ownedBy.length > 0);
    chai.assert(realityDataAdded2.dataLocationGuid && realityDataAdded2.dataLocationGuid.length === 36);
    chai.assert(realityDataAdded2.containerName && realityDataAdded2.containerName.length === 36);
    chai.assert(realityDataAdded2.modifiedTimestamp && Date.parse(realityDataAdded2.modifiedTimestamp) !== undefined);
    chai.assert(realityDataAdded2.createdTimestamp && Date.parse(realityDataAdded2.createdTimestamp) !== undefined);
    // At creation the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);
    chai.assert(realityDataAdded2.hidden === false);

    const relationships1: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataId1 as string);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships1) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId as string);
    }

    const relationships2: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataAdded2.id as string);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships2) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId as string);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataId1 as string);
    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded2.id as string);
  });

  it("should be able to create a reality data then modify it then delete it", async function (this: Mocha.ITestCallbackContext) {
    const realityData: RealityData = new RealityData();

    realityData.name = "Test reality data 1";
    realityData.dataSet = "Test Dataset for iModelJS";
    realityData.group = "Test group";
    realityData.description = "Dummy description for a test reality data";
    realityData.rootDocument = "RootDocumentFile.txt";
    realityData.classification = "Undefined";
    realityData.streamed = false;
    realityData.type = "Undefined";
    realityData.approximateFootprint = true;
    realityData.copyright = "Bentley Systems inc. (c) 2019";
    realityData.termsOfUse = "Free for testing purposes only";
    realityData.metadataUrl = "";
    realityData.resolutionInMeters = "2.0x2.1";
    realityData.accuracyInMeters = undefined;
    realityData.visibility = "PERMISSION";
    realityData.listable = true;
    realityData.version = "1.1.1.1";

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(requestContext, projectId, realityData);

    chai.assert(realityDataAdded1.id && realityDataAdded1.id.length === 36);
    chai.assert(realityDataAdded1.name === realityData.name);
    chai.assert(realityDataAdded1.group === realityData.group);
    chai.assert(realityDataAdded1.dataSet === realityData.dataSet);
    chai.assert(realityDataAdded1.description === realityData.description);
    chai.assert(realityDataAdded1.rootDocument === realityData.rootDocument);
    chai.assert(realityDataAdded1.classification === realityData.classification);
    chai.assert(realityDataAdded1.streamed === realityData.streamed);
    chai.assert(realityDataAdded1.type === realityData.type);
    chai.assert(realityDataAdded1.copyright === realityData.copyright);
    chai.assert(realityDataAdded1.termsOfUse === realityData.termsOfUse);
    chai.assert(realityDataAdded1.metadataUrl === realityData.metadataUrl);
    chai.assert(realityDataAdded1.resolutionInMeters === realityData.resolutionInMeters);
    chai.assert(realityDataAdded1.accuracyInMeters === null);
    chai.assert(realityDataAdded1.visibility === realityData.visibility);
    chai.assert(realityDataAdded1.listable === realityData.listable);
    chai.assert(realityDataAdded1.version === realityData.version);

    chai.assert(realityDataAdded1.ultimateId && realityDataAdded1.ultimateId.length === 36);
    chai.assert(realityDataAdded1.creatorId && realityDataAdded1.creatorId.length === 36);
    chai.assert(realityDataAdded1.ownerId && realityDataAdded1.ownerId.length === 36);
    chai.assert(realityDataAdded1.ownedBy && realityDataAdded1.ownedBy.length > 0);
    chai.assert(realityDataAdded1.dataLocationGuid && realityDataAdded1.dataLocationGuid.length === 36);
    chai.assert(realityDataAdded1.containerName && realityDataAdded1.containerName.length === 36);
    chai.assert(realityDataAdded1.modifiedTimestamp && Date.parse(realityDataAdded1.modifiedTimestamp) !== undefined);
    chai.assert(realityDataAdded1.createdTimestamp && Date.parse(realityDataAdded1.createdTimestamp) !== undefined);
    // At creation the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);
    chai.assert(realityDataAdded1.hidden === false);

    realityDataAdded1.name = "Test reality data 1 - modified";
    realityDataAdded1.dataSet = "Test Dataset for iModelJS - modified";
    realityDataAdded1.group = "Test group - modified";
    realityDataAdded1.description = "Dummy description for a test reality data - modified";
    realityDataAdded1.rootDocument = "RootDocumentFile-modified.txt";
    realityDataAdded1.classification = "Imagery";
    realityDataAdded1.streamed = true;
    realityDataAdded1.type = "DummyType";
    realityDataAdded1.approximateFootprint = false;
    realityDataAdded1.copyright = "Bentley Systems inc. (c) 2019 - modified";
    realityDataAdded1.termsOfUse = "Free for testing purposes only - modified";
    realityDataAdded1.metadataUrl = "Incorrect data produced randomly";
    realityDataAdded1.resolutionInMeters = "3.0x3.2";
    //    realityDataAdded1.accuracyInMeters = "10.7x10.7"; currently does not work ... obviously a bug somewhere in schema or WSG
    realityDataAdded1.visibility = "ENTERPRISE";
    realityDataAdded1.listable = false;
    realityDataAdded1.version = "Named Version 1";

    realityDataAdded1.organizationId = undefined;
    realityDataAdded1.sizeUpToDate = undefined;
    realityDataAdded1.ownedBy = undefined;
    realityDataAdded1.ownerId = undefined;

    const realityDataAdded2 = await realityDataServiceClient.updateRealityData(requestContext, projectId, realityDataAdded1);

    chai.assert(realityDataAdded2.id === realityDataAdded1.id);
    chai.assert(realityDataAdded2.name === realityDataAdded1.name);
    chai.assert(realityDataAdded2.group === realityDataAdded1.group);
    chai.assert(realityDataAdded2.dataSet === realityDataAdded1.dataSet);
    chai.assert(realityDataAdded2.description === realityDataAdded1.description);
    chai.assert(realityDataAdded2.rootDocument === realityDataAdded1.rootDocument);
    chai.assert(realityDataAdded2.classification === realityDataAdded1.classification);
    chai.assert(realityDataAdded2.streamed === realityDataAdded1.streamed);
    chai.assert(realityDataAdded2.type === realityDataAdded1.type);
    chai.assert(realityDataAdded2.copyright === realityDataAdded1.copyright);
    chai.assert(realityDataAdded2.termsOfUse === realityDataAdded1.termsOfUse);
    chai.assert(realityDataAdded2.metadataUrl === realityDataAdded1.metadataUrl);
    chai.assert(realityDataAdded2.resolutionInMeters === realityDataAdded1.resolutionInMeters);
    chai.assert(realityDataAdded2.accuracyInMeters === null);
    chai.assert(realityDataAdded2.visibility === realityDataAdded1.visibility);
    chai.assert(realityDataAdded2.listable === realityDataAdded1.listable);
    chai.assert(realityDataAdded2.version === realityDataAdded1.version);

    chai.assert(realityDataAdded2.ultimateId === realityDataAdded1.ultimateId);
    chai.assert(realityDataAdded2.creatorId === realityDataAdded1.creatorId);
    chai.assert(realityDataAdded2.dataLocationGuid === realityDataAdded1.dataLocationGuid);
    chai.assert(realityDataAdded2.containerName === realityDataAdded1.containerName);
    // Modified time stamp must have been modifed.
    chai.assert(realityDataAdded2.modifiedTimestamp && Date.parse(realityDataAdded2.modifiedTimestamp) !== undefined && realityDataAdded2.modifiedTimestamp !== realityDataAdded1.modifiedTimestamp);
    // Creation time must be unchanged.
    chai.assert(realityDataAdded2.createdTimestamp && Date.parse(realityDataAdded2.createdTimestamp) !== undefined && realityDataAdded2.createdTimestamp === realityDataAdded1.createdTimestamp);
    // At update the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataAdded1.id as string);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId as string);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded2.id as string);
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
