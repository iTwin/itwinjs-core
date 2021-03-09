/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { Angle, Range2d } from "@bentley/geometry-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { RealityData, RealityDataClient, RealityDataRelationship } from "../../RealityDataClient";
import { TestConfig } from "../TestConfig";

chai.should();

describe("RealityServicesClient Normal (#integration)", () => {
  const realityDataServiceClient: RealityDataClient = new RealityDataClient();
  let projectId: GuidString;

  const tilesId: string = "593eff78-b757-4c07-84b2-a8fe31c19927";
  const tilesIdWithRootDocPath: string = "3317b4a0-0086-4f16-a979-6ceb496d785e";

  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    requestContext = await TestConfig.getAuthorizedClientRequestContext();

    projectId = (await TestConfig.queryProject(requestContext, TestConfig.projectName)).wsgId;
    chai.assert.isDefined(projectId);
  });

  it("should be able to parse RDS/Context Share URL both valid and invalid.", async () => {
    // Test
    const realityDataId: string | undefined = realityDataServiceClient.getRealityDataIdFromUrl("http://connect-realitydataservices.bentley.com/v2.4/Repositories/S3MXECPlugin--95b8160c-8df9-437b-a9bf-22ad01fecc6b/S3MX/RealityData/73226b81-6d95-45d3-9473-20e52703aea5");
    chai.assert(realityDataId);
    chai.assert(realityDataId === "73226b81-6d95-45d3-9473-20e52703aea5");

    const realityDataId2: string | undefined = realityDataServiceClient.getRealityDataIdFromUrl("http:\\\\connect-realitydataservices.bentley.com\\v2.4\\Repositories/S3MXECPlugin--95b8160c-8df9-437b-a9bf-22ad01fecc6b\\S3MX\\RealityData\\73226b81-6d95-45d3-9473-20e52703aea5");

    chai.assert(realityDataId2);
    chai.assert(realityDataId2 === "73226b81-6d95-45d3-9473-20e52703aea5");

    const realityDataId3: string | undefined = realityDataServiceClient.getRealityDataIdFromUrl("http:\\connect-realitydataservices.bentley.com\\v2.4\\Repositories/S3MXECPlugin--95b8160c-8df9-437b-a9bf-22ad01fecc6b\\S3MX\\RealityData\\73226b81-6d95-45d3-9473-20e52703aea5");

    chai.assert(realityDataId3);
    chai.assert(realityDataId3 === "73226b81-6d95-45d3-9473-20e52703aea5");
  });

  it("should be able to retrieve reality data properties", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);
    chai.assert(realityData);
    chai.assert(realityData.id === tilesId);
    chai.assert(realityData.client);
    chai.assert(realityData.projectId === projectId);
  });

  it("should be able to retrieve reality data properties for every reality data associated to project", async () => {
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInProject(requestContext, projectId);

    realityData.forEach((value) => {
      chai.assert(value.type === "RealityMesh3DTiles"); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      chai.assert(value.projectId === projectId);
      chai.assert(value.id);
    });

    chai.assert(realityData);
  });

  it("should be able to retrieve reality data properties for every reality data associated to project within an extent", async () => {
    const theRange = Range2d.createXYXY(-81 * 3.1416 / 180, 39 * 3.1416 / 180, -74 * 3.1416 / 180, 42 * 3.1416 / 180); // Range encloses Pennsylvania and should gather Shell project
    const minLongDeg = Angle.radiansToDegrees(theRange.low.x);
    const maxLongDeg = Angle.radiansToDegrees(theRange.high.x);
    const minLatDeg = Angle.radiansToDegrees(theRange.low.y);
    const maxLatDeg = Angle.radiansToDegrees(theRange.high.y);
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInProjectOverlapping(requestContext, projectId, minLongDeg, maxLongDeg, minLatDeg, maxLatDeg);

    chai.expect(realityData).that.is.not.empty;
    realityData.forEach((value) => {
      chai.assert(value.type === "RealityMesh3DTiles"); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      chai.assert(value.projectId === projectId);
      chai.assert(value.id);
    });

  });

  it("should be able to retrieve app data json blob url", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const url: string = await realityData.getRootDocumentJson(requestContext);

    chai.assert(url);
  });

  it("should be able to retrieve the azure blob url", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const url: URL = await realityData.getBlobUrl(requestContext);

    chai.assert(url);
  });

  it("should be able to retrieve the azure blob url (write access)", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const url: URL = await realityData.getBlobUrl(requestContext, true);

    chai.assert(url);
  });

  // NEEDS_WORK: Reality Data Services team - filed TFS#265604
  it.skip("should be able to get model data json", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const rootData: any = await realityData.getRootDocumentJson(requestContext);
    chai.assert(rootData);

    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    const modelName = rootDataJson.root.children[0].content.url;
    chai.assert(modelName);

    const modelData: any = await realityData.getModelData(requestContext, modelName);

    chai.assert(modelData);
  });

  // NEEDS_WORK: Reality Data Services team - filed TFS#265604
  it.skip("should be able to get model data content", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesId);

    const rootData: any = await realityData.getRootDocumentJson(requestContext);
    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    const modelName = rootDataJson.root.children[0].content.url;

    chai.assert(rootData);
    chai.assert(modelName);

    const modelData: any = await realityData.getModelData(requestContext, modelName);

    chai.assert(modelData);
  });

  it("should be able to create a reality data (without specific identifier) and delete it", async () => {
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
    realityData.dataAcquirer = "John Doe Surveying using Leico model 123A Point Cloud Scanner";
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16.0000000Z";
    realityData.referenceElevation = 234.3;

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
    chai.assert(realityDataAdded1.dataAcquirer === realityData.dataAcquirer);
    chai.assert(realityDataAdded1.dataAcquisitionDate === realityData.dataAcquisitionDate);
    chai.assert(realityDataAdded1.dataAcquisitionStartDate === realityData.dataAcquisitionStartDate);
    chai.assert(realityDataAdded1.dataAcquisitionEndDate === realityData.dataAcquisitionEndDate);
    chai.assert(realityDataAdded1.referenceElevation === realityData.referenceElevation);

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
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded1.id as string);
  });

  it("should be able to create a reality data (with fixed specific identifier) and delete it", async () => {
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
    realityData.dataAcquirer = "John Doe Surveying using Leico model 123A Point Cloud Scanner";
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16.0000000Z";
    realityData.referenceElevation = 234.3;

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
    chai.assert(realityDataAdded1.dataAcquirer === realityData.dataAcquirer);
    chai.assert(realityDataAdded1.dataAcquisitionDate === realityData.dataAcquisitionDate);
    chai.assert(realityDataAdded1.dataAcquisitionStartDate === realityData.dataAcquisitionStartDate);
    chai.assert(realityDataAdded1.dataAcquisitionEndDate === realityData.dataAcquisitionEndDate);
    chai.assert(realityDataAdded1.referenceElevation === realityData.referenceElevation);

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
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded1.id as string);
  });

  it("should be able to duplicate a reality data and delete it", async () => {
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
    realityData.dataAcquirer = "John Doe Surveying using Leico model 123A Point Cloud Scanner";
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16.0000000Z";
    realityData.referenceElevation = 234.3;

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
    chai.assert(realityDataAdded1.dataAcquirer === realityData.dataAcquirer);
    chai.assert(realityDataAdded1.dataAcquisitionDate === realityData.dataAcquisitionDate);
    chai.assert(realityDataAdded1.dataAcquisitionStartDate === realityData.dataAcquisitionStartDate);
    chai.assert(realityDataAdded1.dataAcquisitionEndDate === realityData.dataAcquisitionEndDate);
    chai.assert(realityDataAdded1.referenceElevation === realityData.referenceElevation);

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
    chai.assert(realityDataAdded2.dataAcquirer === realityDataAdded1.dataAcquirer);
    chai.assert(realityDataAdded2.dataAcquisitionDate === realityDataAdded1.dataAcquisitionDate);
    chai.assert(realityDataAdded2.dataAcquisitionStartDate === realityDataAdded1.dataAcquisitionStartDate);
    chai.assert(realityDataAdded2.dataAcquisitionEndDate === realityDataAdded1.dataAcquisitionEndDate);
    chai.assert(realityDataAdded2.referenceElevation === realityDataAdded1.referenceElevation);

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

    const relationships1: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataId1);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships1) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId);
    }

    const relationships2: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, projectId, realityDataAdded2.id as string);

    // Remove any relationship (can only be one to context at creation)
    for (const relationship of relationships2) {
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataId1);
    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded2.id as string);
  });

  it("should be able to create a reality data then modify it then delete it", async () => {
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
    realityData.dataAcquirer = "John Doe Surveying using Leico model 123A Point Cloud Scanner";
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16.0000000Z";
    realityData.referenceElevation = 234.3;

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
    chai.assert(realityDataAdded1.dataAcquirer === realityData.dataAcquirer);
    chai.assert(realityDataAdded1.dataAcquisitionDate === realityData.dataAcquisitionDate);
    chai.assert(realityDataAdded1.dataAcquisitionStartDate === realityData.dataAcquisitionStartDate);
    chai.assert(realityDataAdded1.dataAcquisitionEndDate === realityData.dataAcquisitionEndDate);
    chai.assert(realityDataAdded1.referenceElevation === realityData.referenceElevation);

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
    realityDataAdded1.dataAcquirer = "PIPO";
    realityDataAdded1.dataAcquisitionDate = "2019-05-10T09:46:17.0000000Z";
    realityDataAdded1.dataAcquisitionStartDate = "2019-05-10T09:46:17.0000000Z";
    realityDataAdded1.dataAcquisitionEndDate = "2019-05-10T09:46:17.0000000Z";
    realityDataAdded1.referenceElevation = 42.0;

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
    chai.assert(realityDataAdded2.dataAcquirer === realityDataAdded1.dataAcquirer);
    chai.assert(realityDataAdded2.dataAcquisitionDate === realityDataAdded1.dataAcquisitionDate);
    chai.assert(realityDataAdded2.dataAcquisitionStartDate === realityDataAdded1.dataAcquisitionStartDate);
    chai.assert(realityDataAdded2.dataAcquisitionEndDate === realityDataAdded1.dataAcquisitionEndDate);
    chai.assert(realityDataAdded2.referenceElevation === realityDataAdded1.referenceElevation);

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
      await realityDataServiceClient.deleteRealityDataRelationship(requestContext, projectId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(requestContext, projectId, realityDataAdded2.id as string);
  });

  // NEEDS_WORK: Reality Data Services team - filed TFS#265604
  it.skip("should be able to get model data content with root doc not at blob root (root doc path)", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(requestContext, projectId, tilesIdWithRootDocPath);

    // The root document of this reality should not be at the root of the blob
    const rootParts = realityData.rootDocument!.split("/");
    chai.assert(rootParts.length >= 2);
    rootParts.pop();
    const rootDocPath: string = `${rootParts.join("/")}/`;

    const rootData: any = await realityData.getRootDocumentJson(requestContext);
    const rootDataJson = JSON.parse(rootData.toString("utf8"));

    const modelName = rootDataJson.root.children[0].children[0].content.url;

    chai.assert(rootData);
    chai.assert(modelName);

    let exceptionThrown: boolean = false;
    try {
      // Should fail as we call with an incorrect content path.
      const data: any = await realityData.getTileContent(requestContext, modelName);
      chai.assert(!data); // Should never be reached.
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

describe("RealityServicesClient Admin (#integration)", () => {
  const realityDataServiceClient: RealityDataClient = new RealityDataClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    requestContext = await TestConfig.getAuthorizedClientRequestContext(TestUsers.manager);
  });

  // NEEDS_WORK: Reality Data Services team - filed TFS#265604
  it.skip("should be able to create a reality data as an admin (without specific context and admin) and delete it", async () => {
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
    realityData.dataAcquirer = "John Doe Surveying using Leico model 123A Point Cloud Scanner";
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16.0000000Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16.0000000Z";
    realityData.referenceElevation = 234.3;

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(requestContext, undefined, realityData);
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
    chai.assert(realityDataAdded1.dataAcquirer === realityData.dataAcquirer);
    chai.assert(realityDataAdded1.dataAcquisitionDate === realityData.dataAcquisitionDate);
    chai.assert(realityDataAdded1.dataAcquisitionStartDate === realityData.dataAcquisitionStartDate);
    chai.assert(realityDataAdded1.dataAcquisitionEndDate === realityData.dataAcquisitionEndDate);
    chai.assert(realityDataAdded1.referenceElevation === realityData.referenceElevation);

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

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(requestContext, "Server", realityDataAdded1.id as string);

    // Check empty Array
    chai.expect(relationships).that.is.empty;

    await realityDataServiceClient.deleteRealityData(requestContext, undefined, realityDataAdded1.id as string);
  });

});
