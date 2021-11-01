/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AccessToken, Guid, GuidString } from "@itwin/core-bentley";
import {
  Briefcase, ChangeSet, IModelClient, Thumbnail, ThumbnailQuery, ThumbnailSize, Version, VersionQuery,
} from "@bentley/imodelhub-client";
import { RequestGlobalOptions, RequestTimeoutOptions } from "@bentley/itwin-client";
import { TestUsers } from "@itwin/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
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

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "Version", `${versionId}?$select=${getSelectStatement(thumbnailSizes)}`);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetVersionsByNameWithThumbnails(imodelId: GuidString, name: string, thumbnailSizes: ThumbnailSize[], ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "Version", `?$filter=Name+eq+%27${name}%27&$select=${getSelectStatement(thumbnailSizes)}`);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

async function createNamedVersionWithThumbnail(accessToken: AccessToken, imodelClient: IModelClient, imodelId: GuidString, versionName: string) {
  const changeSets = (await imodelClient.changeSets.get(accessToken, imodelId));
  const briefcase2 = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
  let changeSet: ChangeSet;
  if (changeSets.length === 0 || changeSets.length > 9) {
    changeSet = (await utils.createChangeSets(accessToken, imodelId, briefcase2, 0, 1))[0];
  } else {
    changeSet = changeSets[0];
  }
  const version: Version = await imodelClient.versions.create(accessToken, imodelId, changeSet.id!, versionName);

  if (utils.getCloudEnv().isIModelHub) {
    // Wait for large thumbnail.
    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line deprecation/deprecation
      const largeThumbnails = (await imodelClient.thumbnails.get(accessToken, imodelId, "Large", new ThumbnailQuery().byVersionId(version.id!)));
      if (largeThumbnails.length > 0)
        break;
      await utils.delay(6000);
    }
  }
}

describe("iModelHub VersionHandler", () => {
  let iTwinId: string;
  let iModelId: GuidString;
  let iModelId2: GuidString;
  let iModelClient: IModelClient;
  let briefcase: Briefcase;
  let accessToken: AccessToken;

  let backupTimeout: RequestTimeoutOptions;

  const imodelName2 = "imodeljs-clients Versions test 2";
  const baselineiModelName = "imodeljs-clients baseline versions iModel";

  before(async function () {
    backupTimeout = RequestGlobalOptions.timeout;
    RequestGlobalOptions.timeout = {
      deadline: 100000,
      response: 100000,
    };

    this.timeout(0);
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DisableGlobalEvents");
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DoNotScheduleRenderThumbnailJob");
    }

    accessToken = TestConfig.enableMocks ? "" : await utils.login(TestUsers.super);

    iTwinId = await utils.getITwinId(accessToken);
    await utils.createIModel(accessToken, utils.sharedimodelName, iTwinId, true, false, true);
    iModelId = await utils.getIModelId(accessToken, utils.sharedimodelName, iTwinId);
    iModelClient = utils.getDefaultClient();
    briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];
    if (!TestConfig.enableMocks) {
      // Prepare first iModel
      iModelClient.requestOptions.setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
      const changeSetCount = (await iModelClient.changeSets.get(accessToken, iModelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can't create any new changesets
        await utils.createIModel(accessToken, utils.sharedimodelName, iTwinId, true, true, true);
        iModelId = await utils.getIModelId(accessToken, utils.sharedimodelName, iTwinId);
        briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];
      }
    }
  });

  after(async () => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      iModelClient?.requestOptions.setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }

    await utils.deleteIModelByName(accessToken, iTwinId, imodelName2);
    await utils.deleteIModelByName(accessToken, iTwinId, baselineiModelName);

    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(accessToken, iTwinId, utils.sharedimodelName);
    }

    RequestGlobalOptions.timeout = backupTimeout;
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should create named version (#iModelBank)", async () => {
    const mockedChangeSets = Array(1).fill(0).map(() => utils.generateChangeSet());
    utils.mockGetChangeSet(iModelId, false, "?$top=1000", ...mockedChangeSets);
    const changeSetsCount = (await iModelClient.changeSets.get(accessToken, iModelId)).length;

    // creating changeset for new named version
    const changeSet = (await utils.createChangeSets(accessToken, iModelId, briefcase, changeSetsCount, 1))[0];

    const versionName = `Version ${changeSetsCount + 1}`;
    utils.mockCreateVersion(iModelId, versionName, changeSet.id);
    const version: Version = await iModelClient.versions.create(accessToken, iModelId, changeSet.id!, versionName);

    chai.assert(!!version);
    chai.expect(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(changeSet.id);
    chai.expect(version.name).to.be.equal(versionName);
  });

  it("should create and get baseline named version", async () => {
    // Cleanup baseline version's iModels if they left undeleted
    await utils.deleteIModelByName(accessToken, iTwinId, baselineiModelName);

    // Create new iModel
    let baselineiModelId = Guid.createValue();
    if (!TestConfig.enableMocks) {
      await utils.createIModel(accessToken, baselineiModelName, iTwinId);
      baselineiModelId = await utils.getIModelId(accessToken, baselineiModelName, iTwinId);
    }

    // Create baseline version
    const versionName = `Version0`;
    utils.mockCreateVersion(baselineiModelId, versionName, "");
    const newBaselineVersion: Version = await iModelClient.versions.create(accessToken, baselineiModelId, "", versionName);

    chai.assert(!!newBaselineVersion);
    chai.expect(!!newBaselineVersion.id);
    chai.expect(newBaselineVersion.changeSetId).to.be.equal("");
    chai.expect(newBaselineVersion.name).to.be.equal(versionName);

    // Get
    const mockedVersion = utils.generateVersion(undefined, "");
    utils.mockGetVersions(baselineiModelId, `?$filter=ChangeSetId+eq+%27%27`, mockedVersion);

    const existingBaselineVersion: Version[] = await iModelClient.versions.get(accessToken, baselineiModelId, new VersionQuery().byChangeSet(""));
    chai.assert(existingBaselineVersion);
    chai.expect(existingBaselineVersion.length).to.be.equal(1);
    chai.expect(existingBaselineVersion[0].changeSetId).to.be.empty;
  });

  it("should get named versions (#iModelBank)", async () => {
    const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);
    // Needs to create before expecting more than 0
    const versions: Version[] = await iModelClient.versions.get(accessToken, iModelId);

    let i = 0;
    for (const expectedVersion of versions) {
      utils.mockGetVersionById(iModelId, mockedVersions[i++]);
      const actualVersion: Version = (await iModelClient.versions.get(accessToken, iModelId, new VersionQuery().byId(expectedVersion.id!)))[0];
      chai.assert(!!actualVersion);
      chai.expect(actualVersion.changeSetId).to.be.equal(expectedVersion.changeSetId);
    }
  });

  it("should query named versions by ChangeSet id (#iModelBank)", async () => {
    const mockedVersion = utils.generateVersion();
    utils.mockGetVersions(iModelId, undefined, mockedVersion);
    utils.mockGetVersions(iModelId, `?$filter=ChangeSetId+eq+%27${mockedVersion.changeSetId!}%27`, mockedVersion);

    const expectedVersion: Version = (await iModelClient.versions.get(accessToken, iModelId))[0];
    chai.assert(expectedVersion);

    const version: Version[] = await iModelClient.versions.get(accessToken, iModelId, new VersionQuery().byChangeSet(expectedVersion.changeSetId!));
    chai.assert(version);
    chai.expect(version.length).to.be.equal(1);
    chai.expect(version[0].changeSetId).to.be.equal(expectedVersion.changeSetId);
  });

  it("should get named versions with thumbnail id", async () => {
    const firstVersionName = "Version 1";

    await utils.createIModel(accessToken, imodelName2, iTwinId, true, false, true);
    iModelId2 = await utils.getIModelId(accessToken, imodelName2, iTwinId);
    if (!TestConfig.enableMocks) {
      const versionsCount = (await iModelClient.versions.get(accessToken, iModelId2)).length;
      if (versionsCount === 0) {
        // Create at least 1 named version
        await createNamedVersionWithThumbnail(accessToken, iModelClient, iModelId2, firstVersionName);
      }
    }

    let mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId2, `?$filter=Name+eq+%27Version%201%27`, ...mockedVersions);
    let versions: Version[] = await iModelClient.versions.get(accessToken, iModelId2, new VersionQuery().byName(firstVersionName));
    chai.expect(versions.length).to.be.equal(1);
    const firstVersion = versions[0];
    // eslint-disable-next-line deprecation/deprecation
    chai.expect(firstVersion.smallThumbnailId).to.be.undefined;
    // eslint-disable-next-line deprecation/deprecation
    chai.expect(firstVersion.largeThumbnailId).to.be.undefined;

    const mockedSmallThumbnail = utils.generateThumbnail("Small");
    utils.mockGetThumbnailsByVersionId(iModelId2, "Small", firstVersion.id!, mockedSmallThumbnail);
    // eslint-disable-next-line deprecation/deprecation
    const smallThumbnail: Thumbnail = (await iModelClient.thumbnails.get(accessToken, iModelId2, "Small", new ThumbnailQuery().byVersionId(firstVersion.id!)))[0];

    const mockedLargeThumbnail = utils.generateThumbnail("Large");
    utils.mockGetThumbnailsByVersionId(iModelId2, "Large", firstVersion.id!, mockedLargeThumbnail);
    // eslint-disable-next-line deprecation/deprecation
    const largeThumbnail: Thumbnail = (await iModelClient.thumbnails.get(accessToken, iModelId2, "Large", new ThumbnailQuery().byVersionId(firstVersion.id!)))[0];

    mockedVersions = Array(1).fill(0).map(() => utils.generateVersion(undefined, undefined, true, mockedSmallThumbnail.id, mockedLargeThumbnail.id));
    mockGetVersionsByIdWithThumbnails(iModelId2, firstVersion.id!, ["Small", "Large"], ...mockedVersions);
    // eslint-disable-next-line deprecation/deprecation
    versions = await iModelClient.versions.get(accessToken, iModelId2, new VersionQuery().byId(firstVersion.id!).selectThumbnailId("Small", "Large"));
    chai.expect(versions.length === 1);
    // eslint-disable-next-line deprecation/deprecation
    chai.assert(!!versions[0].smallThumbnailId);
    // eslint-disable-next-line deprecation/deprecation
    chai.expect(versions[0].smallThumbnailId!.toString()).to.be.equal(smallThumbnail.id!.toString());
    // eslint-disable-next-line deprecation/deprecation
    chai.assert(!!versions[0].largeThumbnailId);
    // eslint-disable-next-line deprecation/deprecation
    chai.expect(versions[0].largeThumbnailId!.toString()).to.be.equal(largeThumbnail.id!.toString());

    mockedVersions = Array(1).fill(0).map(() => utils.generateVersion(undefined, undefined, true, undefined, mockedLargeThumbnail.id));
    mockGetVersionsByNameWithThumbnails(iModelId2, firstVersion.name!, ["Large"], ...mockedVersions);
    // eslint-disable-next-line deprecation/deprecation
    versions = await iModelClient.versions.get(accessToken, iModelId2, new VersionQuery().byName(firstVersion.name!).selectThumbnailId("Large"));
    chai.expect(versions.length === 1);
    // eslint-disable-next-line deprecation/deprecation
    chai.expect(versions[0].smallThumbnailId).to.be.undefined;
    // eslint-disable-next-line deprecation/deprecation
    chai.assert(!!versions[0].largeThumbnailId);
    // eslint-disable-next-line deprecation/deprecation
    chai.expect(versions[0].largeThumbnailId!.toString()).to.be.equal(largeThumbnail.id!.toString());

    chai.expect(smallThumbnail.id!.toString()).to.be.not.equal(largeThumbnail.id!.toString());
  });

  it("should update named version (#iModelBank)", async () => {
    const mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);

    let version: Version = (await iModelClient.versions.get(accessToken, iModelId))[0];
    chai.assert(!!version);
    chai.assert(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);

    version.name += " updated";
    utils.mockUpdateVersion(iModelId, version);
    version = await iModelClient.versions.update(accessToken, iModelId, version);

    chai.assert(!!version);
    chai.expect(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);
  });

  it("should handle special characters in get by name query", async () => {
    const mockedChangeSets = Array(1).fill(0).map(() => utils.generateChangeSet());
    utils.mockGetChangeSet(iModelId, false, "?$top=1000", ...mockedChangeSets);
    const changeSetsCount: number = (await iModelClient.changeSets.get(accessToken, iModelId)).length;
    const changeSet = (await utils.createChangeSets(accessToken, iModelId, briefcase, changeSetsCount, 1))[0];

    const versionName = `Д-${changeSetsCount + 1}`;
    utils.mockCreateVersion(iModelId, versionName, changeSet.id);
    const version: Version = await iModelClient.versions.create(accessToken, iModelId, changeSet.id!, versionName);
    chai.assert(!!version);

    const mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, `?$filter=Name+eq+%27%D0%94-${changeSetsCount + 1}%27`, ...mockedVersions);
    const versions: Version[] = await iModelClient.versions.get(accessToken, iModelId, new VersionQuery().byName(versionName));
    chai.expect(versions.length).to.be.equal(1);
  });

  it("should hide named version", async () => {
    const mockedVersions = Array(1)
      .fill(0)
      .map(() => utils.generateVersion(undefined, undefined, undefined, undefined, undefined, false));
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);

    let version: Version = (await iModelClient.versions.get(accessToken, iModelId))[0];
    chai.assert(!!version);
    chai.assert(!!version.id);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);
    chai.expect(version.hidden).to.be.equal(false);

    version.hidden = true;
    utils.mockUpdateVersion(iModelId, version);
    version = await iModelClient.versions.update(
      accessToken,
      iModelId,
      version
    );

    chai.assert(!!version);
    chai.assert(!!version.id);
    chai.expect(version.hidden).to.be.equal(true);
  });

  it("should get only not hidden named versions", async () => {
    const mockedVersions = [
      utils.generateVersion(undefined, undefined, undefined, undefined, undefined, false),
      utils.generateVersion(undefined, undefined, undefined, undefined, undefined, true),
    ];
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);
    utils.mockGetVersions(
      iModelId,
      `?$filter=Hidden+eq+false`,
      ...mockedVersions.filter((v) => !v.hidden)
    );
    const versions: Version[] = await iModelClient.versions.get(
      accessToken,
      iModelId,
      new VersionQuery()
    );
    const notHiddenversions: Version[] = await iModelClient.versions.get(
      accessToken,
      iModelId,
      new VersionQuery().notHidden()
    );
    chai.expect(versions.length - notHiddenversions.length).to.be.equal(1);
  });

  it("should get the application data for a named version", async () => {
    const applicationId: string = `testApplicationId`;
    const applicationName: string = `testApplicationName`;
    const mockedVersion: Version = utils.generateVersion(undefined, undefined, undefined, undefined, undefined, false, applicationId, applicationName);
    utils.mockGetVersions(iModelId, `?$select=*,CreatedByApplication-forward-Application.*`, mockedVersion);
    const version: Version = (await iModelClient.versions.get(accessToken, iModelId, new VersionQuery().selectApplicationData()))[0];

    if (TestConfig.enableMocks) {
      chai.assert(version.applicationId);
      chai.expect(version.applicationId).equals("testApplicationId");
      chai.assert(version.applicationName);
      chai.expect(version.applicationName).equals("testApplicationName");
    }
  });
});
