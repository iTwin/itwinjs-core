/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ActivityLoggingContext, GuidString } from "@bentley/bentleyjs-core";
import {
  AccessToken, Version, VersionQuery, Briefcase, ChangeSet, Thumbnail,
  ThumbnailQuery, ThumbnailSize, IModelClient,
} from "@bentley/imodeljs-clients";
import { TestConfig, TestUsers } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

function getSelectStatement(thumbnailSizes: ThumbnailSize[]) {
  let selectStatement: string = "*";
  for (const size of thumbnailSizes)
    selectStatement += `,HasThumbnail-forward-${size}Thumbnail.*`;
  return selectStatement;
}

function mockGetVersionsByIdWithThumbnails(imodelId: GuidString, versionId: GuidString, thumbnailSizes: ThumbnailSize[], ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "Version", `${versionId}?$select=` + getSelectStatement(thumbnailSizes));
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetVersionsByNameWithThumbnails(imodelId: GuidString, name: string, thumbnailSizes: ThumbnailSize[], ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "Version", `?$filter=Name+eq+%27${name}%27&$select=` + getSelectStatement(thumbnailSizes));
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

async function createNamedVersionWithThumbnail(actx: ActivityLoggingContext, imodelClient: IModelClient, accessToken: AccessToken, imodelId: GuidString, versionName: string) {
  const changeSetCount = (await imodelClient.changeSets.get(actx, accessToken, imodelId)).length;
  const briefcase2 = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
  let changeSet: ChangeSet;
  if (changeSetCount === 0 || changeSetCount > 9) {
    changeSet = (await utils.createChangeSets(accessToken, imodelId, briefcase2, 0, 1))[0];
  } else {
    changeSet = (await imodelClient.changeSets.get(actx, accessToken, imodelId))[0];
  }
  const version: Version = await imodelClient.versions.create(actx, accessToken, imodelId, changeSet.id!, versionName);

  if (utils.getCloudEnv().isIModelHub) {
    // Wait for large thumbnail.
    for (let i = 0; i < 50; i++) {
      const largeThumbnails = (await imodelClient.thumbnails.get(actx, accessToken, imodelId, "Large", new ThumbnailQuery().byVersionId(version.id!)));
      if (largeThumbnails.length > 0)
        break;
      await utils.delay(6000);
    }
  }
}

describe("iModelHub VersionHandler", () => {
  let accessToken: AccessToken;
  let imodelId: GuidString;
  let imodelId2: GuidString;
  let iModelClient: IModelClient;
  let briefcase: Briefcase;
  const imodelName = "imodeljs-clients Versions test";
  const imodelName2 = "imodeljs-clients Versions test 2";
  const firstVersionName = "Version 1";
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DisableGlobalEvents");
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DoNotScheduleRenderThumbnailJob");
    }

    accessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    await utils.createIModel(accessToken, imodelName, undefined, false, true);
    await utils.createIModel(accessToken, imodelName2, undefined, false, true);
    imodelId = await utils.getIModelId(accessToken, imodelName);
    imodelId2 = await utils.getIModelId(accessToken, imodelName2);
    iModelClient = utils.getDefaultClient();
    briefcase = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
    if (!TestConfig.enableMocks) {
      // Prepare first iModel
      iModelClient.requestOptions.setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
      const changeSetCount = (await iModelClient.changeSets.get(actx, accessToken, imodelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can't create any new changesets
        await utils.createIModel(accessToken, imodelName, undefined, true, true);
        imodelId = await utils.getIModelId(accessToken, imodelName);
        briefcase = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
      }
      // Prepared second iModel
      const versionsCount = (await iModelClient.versions.get(actx, accessToken, imodelId2)).length;
      if (versionsCount === 0) {
        // Create at least 1 named version
        await createNamedVersionWithThumbnail(actx, iModelClient, accessToken, imodelId2, firstVersionName);
      }
    }
  });

  after(() => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      iModelClient.requestOptions.setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should create named version", async function (this: Mocha.ITestCallbackContext) {
    const mockedChangeSets = Array(1).fill(0).map(() => utils.generateChangeSet());
    utils.mockGetChangeSet(imodelId, false, undefined, ...mockedChangeSets);
    const changeSetsCount = (await iModelClient.changeSets.get(actx, accessToken, imodelId)).length;

    // creating changeset for new named version
    const changeSet = (await utils.createChangeSets(accessToken, imodelId, briefcase, changeSetsCount, 1))[0];

    const versionName = `Version ${changeSetsCount + 1}`;
    utils.mockCreateVersion(imodelId, versionName, changeSet.id);
    const version: Version = await iModelClient.versions.create(actx, accessToken, imodelId, changeSet.id!, versionName);

    chai.assert(!!version);
    chai.expect(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(changeSet.id);
    chai.expect(version.name).to.be.equal(versionName);
  });

  it("should get named versions", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(imodelId, undefined, ...mockedVersions);
    // Needs to create before expecting more than 0
    const versions: Version[] = await iModelClient.versions.get(actx, accessToken, imodelId);

    let i = 0;
    for (const expectedVersion of versions) {
      utils.mockGetVersionById(imodelId, mockedVersions[i++]);
      const actualVersion: Version = (await iModelClient.versions.get(actx, accessToken, imodelId, new VersionQuery().byId(expectedVersion.id!)))[0];
      chai.assert(!!actualVersion);
      chai.expect(actualVersion.changeSetId).to.be.equal(expectedVersion.changeSetId);
    }
  });

  it("should query named versions by ChangeSet id", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersion = utils.generateVersion();
    utils.mockGetVersions(imodelId, undefined, mockedVersion);
    utils.mockGetVersions(imodelId, `?$filter=ChangeSetId+eq+%27${mockedVersion.changeSetId!}%27`, mockedVersion);

    const expectedVersion: Version = (await iModelClient.versions.get(actx, accessToken, imodelId))[0];
    chai.assert(expectedVersion);

    const version: Version[] = await iModelClient.versions.get(actx, accessToken, imodelId, new VersionQuery().byChangeSet(expectedVersion.changeSetId!));
    chai.assert(version);
    chai.expect(version.length).to.be.equal(1);
    chai.expect(version[0].changeSetId).to.be.equal(expectedVersion.changeSetId);
  });

  it("should get named versions with thumbnail id", async () => {
    let mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(imodelId2, `?$filter=Name+eq+%27Version%201%27`, ...mockedVersions);
    let versions: Version[] = await iModelClient.versions.get(actx, accessToken, imodelId2, new VersionQuery().byName(firstVersionName));
    chai.expect(versions.length).to.be.equal(1);
    const firstVersion = versions[0];
    chai.expect(firstVersion.smallThumbnailId).to.be.undefined;
    chai.expect(firstVersion.largeThumbnailId).to.be.undefined;

    const mockedSmallThumbnail = utils.generateThumbnail("Small");
    utils.mockGetThumbnailsByVersionId(imodelId2, "Small", firstVersion.id!, mockedSmallThumbnail);
    const smallThumbnail: Thumbnail = (await iModelClient.thumbnails.get(actx, accessToken, imodelId2, "Small", new ThumbnailQuery().byVersionId(firstVersion.id!)))[0];

    const mockedLargeThumbnail = utils.generateThumbnail("Large");
    utils.mockGetThumbnailsByVersionId(imodelId2, "Large", firstVersion.id!, mockedLargeThumbnail);
    const largeThumbnail: Thumbnail = (await iModelClient.thumbnails.get(actx, accessToken, imodelId2, "Large", new ThumbnailQuery().byVersionId(firstVersion.id!)))[0];

    mockedVersions = Array(1).fill(0).map(() => utils.generateVersion(undefined, undefined, true, mockedSmallThumbnail.id!, mockedLargeThumbnail.id!));
    mockGetVersionsByIdWithThumbnails(imodelId2, firstVersion.id!, ["Small", "Large"], ...mockedVersions);
    versions = await iModelClient.versions.get(actx, accessToken, imodelId2, new VersionQuery().byId(firstVersion.id!).selectThumbnailId("Small", "Large"));
    chai.expect(versions.length === 1);
    chai.assert(!!versions[0].smallThumbnailId);
    chai.expect(versions[0].smallThumbnailId!.toString()).to.be.equal(smallThumbnail.id!.toString());
    chai.assert(!!versions[0].largeThumbnailId);
    chai.expect(versions[0].largeThumbnailId!.toString()).to.be.equal(largeThumbnail.id!.toString());

    mockedVersions = Array(1).fill(0).map(() => utils.generateVersion(undefined, undefined, true, undefined, mockedLargeThumbnail.id!));
    mockGetVersionsByNameWithThumbnails(imodelId2, firstVersion.name!, ["Large"], ...mockedVersions);
    versions = await iModelClient.versions.get(actx, accessToken, imodelId2, new VersionQuery().byName(firstVersion.name!).selectThumbnailId("Large"));
    chai.expect(versions.length === 1);
    chai.expect(versions[0].smallThumbnailId).to.be.undefined;
    chai.assert(!!versions[0].largeThumbnailId);
    chai.expect(versions[0].largeThumbnailId!.toString()).to.be.equal(largeThumbnail.id!.toString());

    chai.expect(smallThumbnail.id!.toString()).to.be.not.equal(largeThumbnail.id!.toString());
  });

  it("should update named version", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(imodelId, undefined, ...mockedVersions);

    let version: Version = (await iModelClient.versions.get(actx, accessToken, imodelId))[0];
    chai.assert(!!version);
    chai.assert(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);

    version.name += " updated";
    utils.mockUpdateVersion(imodelId, version);
    version = await iModelClient.versions.update(actx, accessToken, imodelId, version);

    chai.assert(!!version);
    chai.expect(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);
  });
});
