/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ImsAuthorizationClient } from "@bentley/itwin-client";
import { AccessToken, Guid, GuidString, Logger, LogLevel } from "@itwin/core-bentley";
import { Angle, Range2d } from "@itwin/core-geometry";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import * as chai from "chai";
import * as jsonpath from "jsonpath";
import { DefaultSupportedTypes, RealityData, RealityDataAccessClient, RealityDataRelationship } from "../../RealityDataClient";
import { TestConfig } from "../TestConfig";

chai.should();

const LOG_CATEGORY: string = "RealityDataClient.Test";

Logger.initializeToConsole();
Logger.setLevel(LOG_CATEGORY, LogLevel.Info);

describe("RealityServicesClient Normal (#integration)", () => {
  const realityDataServiceClient: RealityDataAccessClient = new RealityDataAccessClient();
  const imsClient: ImsAuthorizationClient = new ImsAuthorizationClient();

  let iTwinId: GuidString;

  const tilesId: string = "593eff78-b757-4c07-84b2-a8fe31c19927";
  const tilesIdWithRootDocPath: string = "3317b4a0-0086-4f16-a979-6ceb496d785e";

  let accessToken: AccessToken;

  before(async () => {
    accessToken = await TestConfig.getAccessToken();
    iTwinId = (await TestConfig.getITwinByName(accessToken, TestConfig.iTwinName)).id;
    chai.assert.isDefined(iTwinId);
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
    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesId);
    chai.assert(realityData);
    chai.assert(realityData.id === tilesId);
    chai.assert(realityData.client);
    chai.assert(realityData.iTwinId === iTwinId);
  });

  it("should be able to retrieve reality data properties for every reality data associated with iTwin", async () => {
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInITwin(accessToken, iTwinId);

    realityData.forEach((value) => {
      chai.assert(value.type === DefaultSupportedTypes.RealityMesh3dTiles); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      chai.assert(value.iTwinId === iTwinId);
      chai.assert(value.id);
    });

    chai.assert(realityData);
  });

  it("should be able to retrieve reality data properties for every reality data associated with iTwin within an extent", async () => {
    const theRange = Range2d.createXYXY(-81 * 3.1416 / 180, 39 * 3.1416 / 180, -74 * 3.1416 / 180, 42 * 3.1416 / 180); // Range encloses Pennsylvania and should gather Shell iTwin
    const minLongDeg = Angle.radiansToDegrees(theRange.low.x);
    const maxLongDeg = Angle.radiansToDegrees(theRange.high.x);
    const minLatDeg = Angle.radiansToDegrees(theRange.low.y);
    const maxLatDeg = Angle.radiansToDegrees(theRange.high.y);
    const realityData: RealityData[] = await realityDataServiceClient.getRealityDataInITwinOverlapping(accessToken, iTwinId, minLongDeg, maxLongDeg, minLatDeg, maxLatDeg);

    chai.expect(realityData).that.is.not.empty;
    realityData.forEach((value) => {
      chai.assert(value.type === DefaultSupportedTypes.RealityMesh3dTiles); // iModelJS only supports this type
      chai.assert(value.rootDocument && value.rootDocument !== ""); // All such type require a root document to work correctly
      chai.assert(value.iTwinId === iTwinId);
      chai.assert(value.id);
    });

  });

  it("should be able to retrieve app data json blob url", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesId);

    const url: string = await realityData.getRootDocumentJson(accessToken);

    chai.assert(url);
  });

  it("should be able to retrieve the azure blob url", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesId);

    const url: URL = await realityData.getContainerUrl(accessToken);

    chai.assert(url);
  });

  it("should be able to retrieve the azure blob url (write access)", async function () {
    // Skip this test if the issuing authority is not imsoidc.
    // The iTwin Platform currently does not support the reality-data:write scope.
    const imsUrl = await imsClient.getUrl();
    if (-1 === imsUrl.indexOf("imsoidc"))
      this.skip();

    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesId);

    const url: URL = await realityData.getContainerUrl(accessToken, true);

    chai.assert(url);
  });

  it("should be able to get model data json", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesId);

    const rootData: any = await realityData.getRootDocumentJson(accessToken);
    chai.assert(rootData);

    const jsonName = jsonpath.query(rootData.root.children, "$..url").find((u) => u.endsWith(".json"));

    chai.assert(jsonName);
    const jsonData: any = await realityData.getTileJson(accessToken, jsonName);
    chai.assert(jsonData);
    chai.assert(jsonData.asset.version);
  });

  it("should be able to get model data content", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesId);
    const decoder = new TextDecoder("utf-8");

    const rootData: any = await realityData.getRootDocumentJson(accessToken);
    chai.assert(rootData);

    const modelName = jsonpath.query(rootData.root.children, "$..url").find((u) => u.endsWith(".b3dm"));
    chai.assert(modelName);

    const modelData: any = await realityData.getTileContent(accessToken, modelName);
    chai.assert(modelData);
    const modelDataString = decoder.decode(new Uint8Array(modelData)).substring(0, 4);
    chai.assert(modelDataString === "b3dm");
  });

  it("should be able to create a reality data (without specific identifier) and delete it", async function () {
    // Skip this test if the issuing authority is not imsoidc.
    // The iTwin Platform currently does not support the reality-data:write scope.
    const imsUrl = await imsClient.getUrl();
    if (-1 === imsUrl.indexOf("imsoidc"))
      this.skip();

    const realityData: RealityData = new RealityData();
    realityData.name = "Test reality data 1";
    realityData.dataSet = "Test Dataset for iModelJS";
    realityData.group = "Test group";
    realityData.description = "Dummy description for a test reality data";
    realityData.rootDocument = "RootDocumentFile.txt";
    realityData.classification = "Undefined";
    realityData.streamed = false;
    realityData.type = undefined;
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
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16Z";
    realityData.referenceElevation = 234.3;

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(accessToken, iTwinId, realityData);
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

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(accessToken, iTwinId, realityDataAdded1.id as string);

    // Remove any relationship (can only be one to an iTwin at creation)
    for (const relationship of relationships) {
      await realityDataServiceClient.deleteRealityDataRelationship(accessToken, iTwinId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(accessToken, iTwinId, realityDataAdded1.id as string);
  });

  it("should be able to create a reality data (with fixed specific identifier) and delete it", async function () {
    // Skip this test if the issuing authority is not imsoidc.
    // The iTwin Platform currently does not support the reality-data:write scope.
    const imsUrl = await imsClient.getUrl();
    if (-1 === imsUrl.indexOf("imsoidc"))
      this.skip();

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
    realityData.type = undefined;
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
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16Z";
    realityData.referenceElevation = 234.3;

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(accessToken, iTwinId, realityData);

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

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(accessToken, iTwinId, realityDataAdded1.id as string);

    // Remove any relationship (can only be one to an iTwin at creation)
    for (const relationship of relationships) {
      await realityDataServiceClient.deleteRealityDataRelationship(accessToken, iTwinId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(accessToken, iTwinId, realityDataAdded1.id as string);
  });

  it("should be able to duplicate a reality data and delete it", async function () {
    // Skip this test if the issuing authority is not imsoidc.
    // The iTwin Platform currently does not support the reality-data:write scope.
    const imsUrl = await imsClient.getUrl();
    if (-1 === imsUrl.indexOf("imsoidc"))
      this.skip();

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
    realityData.type = undefined;
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
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16Z";
    realityData.referenceElevation = 234.3;

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(accessToken, iTwinId, realityData);

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

    const realityDataAdded2 = await realityDataServiceClient.createRealityData(accessToken, iTwinId, realityDataAdded1);

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

    const relationships1: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(accessToken, iTwinId, realityDataId1);

    // Remove any relationship (can only be one to an iTwin at creation)
    for (const relationship of relationships1) {
      await realityDataServiceClient.deleteRealityDataRelationship(accessToken, iTwinId, relationship.wsgId);
    }

    const relationships2: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(accessToken, iTwinId, realityDataAdded2.id as string);

    // Remove any relationship (can only be one to an iTwin at creation)
    for (const relationship of relationships2) {
      await realityDataServiceClient.deleteRealityDataRelationship(accessToken, iTwinId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(accessToken, iTwinId, realityDataId1);
    await realityDataServiceClient.deleteRealityData(accessToken, iTwinId, realityDataAdded2.id as string);
  });

  it("should be able to create a reality data then modify it then delete it", async function () {
    // Skip this test if the issuing authority is not imsoidc.
    // The iTwin Platform currently does not support the reality-data:write scope.
    const imsUrl = await imsClient.getUrl();
    if (-1 === imsUrl.indexOf("imsoidc"))
      this.skip();

    const realityData: RealityData = new RealityData();

    realityData.name = "Test reality data 1";
    realityData.dataSet = "Test Dataset for iModelJS";
    realityData.group = "Test group";
    realityData.description = "Dummy description for a test reality data";
    realityData.rootDocument = "RootDocumentFile.txt";
    realityData.classification = "Undefined";
    realityData.streamed = false;
    realityData.type = undefined;
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
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16Z";
    realityData.referenceElevation = 234.3;

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(accessToken, iTwinId, realityData);

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

    realityDataAdded1.name = "Test reality data 1 - modified";
    realityDataAdded1.dataSet = "Test Dataset for iModelJS - modified";
    realityDataAdded1.group = "Test group - modified";
    realityDataAdded1.description = "Dummy description for a test reality data - modified";
    realityDataAdded1.rootDocument = "RootDocumentFile-modified.txt";
    realityDataAdded1.classification = "Imagery";
    realityDataAdded1.streamed = true;
    realityDataAdded1.type = DefaultSupportedTypes.Terrain3dTiles;
    realityDataAdded1.approximateFootprint = false;
    realityDataAdded1.copyright = "Bentley Systems inc. (c) 2019 - modified";
    realityDataAdded1.termsOfUse = "Free for testing purposes only - modified";
    realityDataAdded1.metadataUrl = "Incorrect data produced randomly";
    realityDataAdded1.resolutionInMeters = "3.0x3.2";
    //    realityDataAdded1.accuracyInMeters = "10.7x10.7"; currently does not work ... obviously a bug somewhere in schema or WSG
    realityDataAdded1.visibility = "ENTERPRISE";
    realityDataAdded1.listable = true;
    realityDataAdded1.version = "Named Version 1";
    realityDataAdded1.dataAcquirer = "PIPO";
    realityDataAdded1.dataAcquisitionDate = "2019-05-10T09:46:17Z";
    realityDataAdded1.dataAcquisitionStartDate = "2019-05-10T09:46:17Z";
    realityDataAdded1.dataAcquisitionEndDate = "2019-05-10T09:46:17Z";
    realityDataAdded1.referenceElevation = 42.0;

    realityDataAdded1.organizationId = undefined;
    realityDataAdded1.sizeUpToDate = undefined;
    realityDataAdded1.ownedBy = undefined;
    realityDataAdded1.ownerId = undefined;

    const realityDataAdded2 = await realityDataServiceClient.updateRealityData(accessToken, iTwinId, realityDataAdded1);

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
    chai.assert(realityDataAdded2.modifiedTimestamp && Date.parse(realityDataAdded2.modifiedTimestamp) !== undefined);
    // Creation time must be unchanged.
    chai.assert(realityDataAdded2.createdTimestamp && Date.parse(realityDataAdded2.createdTimestamp) !== undefined && realityDataAdded2.createdTimestamp === realityDataAdded1.createdTimestamp);
    // At update the last accessed time stamp remains null.
    // chai.assert(realityDataAdded1.lastAccessedTimestamp && Date.parse(realityDataAdded1.lastAccessedTimestamp as string) !== undefined);

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(accessToken, iTwinId, realityDataAdded1.id as string);

    // Remove any relationship (can only be one to an iTwin at creation)
    for (const relationship of relationships) {
      await realityDataServiceClient.deleteRealityDataRelationship(accessToken, iTwinId, relationship.wsgId);
    }

    await realityDataServiceClient.deleteRealityData(accessToken, iTwinId, realityDataAdded2.id as string);
  });

  it("should be able to get model data content with root doc not at blob root (root doc path)", async () => {
    const realityData: RealityData = await realityDataServiceClient.getRealityData(accessToken, iTwinId, tilesIdWithRootDocPath);

    // The root document of this reality should not be at the root of the blob
    const rootParts = realityData.rootDocument!.split("/");
    chai.assert(rootParts.length >= 2);
    rootParts.pop();
    const rootDocPath: string = `${rootParts.join("/")}/`;

    const rootData: any = await realityData.getRootDocumentJson(accessToken);

    const modelName = rootData.root.children[0].children[0].content.url;

    chai.assert(rootData);
    chai.assert(modelName);

    let exceptionThrown: boolean = false;
    try {
      // Should fail as we call with an incorrect content path.
      const data: any = await realityData.getTileContent(accessToken, modelName);
      chai.assert(!data); // Should never be reached.
    } catch {
      exceptionThrown = true;
    }
    chai.assert(exceptionThrown);

    // Should succeed as we call with added root document path
    const data2: any = await realityData.getTileContent(accessToken, rootDocPath + modelName);

    chai.assert(data2);
  });

});

describe("RealityServicesClient Admin (#integration)", () => {
  const realityDataServiceClient: RealityDataAccessClient = new RealityDataAccessClient();
  const imsClient: ImsAuthorizationClient = new ImsAuthorizationClient();
  let accessToken: AccessToken;

  before(async () => {
    accessToken = await TestConfig.getAccessToken(TestUsers.manager);
  });

  it("should be able to create a reality data as an admin (without specific iTwin and admin) and delete it", async function () {
    // Skip this test if the issuing authority is not imsoidc.
    // The iTwin Platform currently does not support the reality-data:write scope.
    const imsUrl = await imsClient.getUrl();
    if (-1 === imsUrl.indexOf("imsoidc"))
      this.skip();

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
    realityData.type = undefined;
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
    realityData.dataAcquisitionDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionStartDate = "2019-05-10T09:46:16Z";
    realityData.dataAcquisitionEndDate = "2019-05-10T09:46:16Z";
    realityData.referenceElevation = 234.3;

    const realityDataAdded1 = await realityDataServiceClient.createRealityData(accessToken, undefined, realityData);
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

    const relationships: RealityDataRelationship[] = await realityDataServiceClient.getRealityDataRelationships(accessToken, "Server", realityDataAdded1.id as string);

    // Check empty Array
    chai.expect(relationships).that.is.empty;

    await realityDataServiceClient.deleteRealityData(accessToken, undefined, realityDataAdded1.id as string);
  });

});
