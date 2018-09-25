/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { AccessToken } from "../../";
import {
  Version, VersionQuery, Briefcase, ChangeSet, Thumbnail,
  ThumbnailQuery, ThumbnailSize,
} from "../../";

import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelClient } from "../../IModelClient";

function getSelectStatement(thumbnailSizes: ThumbnailSize[]) {
  let selectStatement: string = "*";
  for (const size of thumbnailSizes)
    selectStatement += `,HasThumbnail-forward-${size}Thumbnail.*`;
  return selectStatement;
}

function mockGetVersionsByIdWithThumbnails(imodelId: string, versionId: string, thumbnailSizes: ThumbnailSize[], ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Version", `${versionId}?$select=` + getSelectStatement(thumbnailSizes));
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockGetVersionsByNameWithThumbnails(imodelId: string, name: string, thumbnailSizes: ThumbnailSize[], ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Version", `?$filter=Name+eq+%27${name}%27&$select=` + getSelectStatement(thumbnailSizes));
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

describe("iModelHub VersionHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let iModelClient: IModelClient;
  let briefcase: Briefcase;
  const imodelName = "imodeljs-clients Versions test";
  const actx = new ActivityLoggingContext("");

  before(async () => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DisableGlobalEvents");
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DoNotScheduleRenderThumbnailJob");
    }

    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    iModelClient = await utils.getClient(iModelId);
    briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];
    if (!TestConfig.enableMocks) {
      iModelClient.RequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
      const changeSetCount = (await iModelClient.ChangeSets().get(actx, accessToken, iModelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can't create any new changesets
        await utils.createIModel(accessToken, imodelName, undefined, true);
        iModelId = await utils.getIModelId(accessToken, imodelName);
        briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];
      }
      const versionsCount = (await iModelClient.Versions().get(actx, accessToken, iModelId)).length;
      if (versionsCount === 0) {
        // Create at least 1 named version
        let changeSet: ChangeSet;
        if (changeSetCount === 0 || changeSetCount > 9) {
          changeSet = (await utils.createChangeSets(accessToken, iModelId, briefcase, 0, 1))[0];
        } else {
          changeSet = (await iModelClient.ChangeSets().get(actx, accessToken, iModelId))[0];
        }
        const version: Version = await iModelClient.Versions().create(actx, accessToken, iModelId, changeSet.id!, "Version 1");

        if (utils.getCloudEnv().isIModelHub) {
          // Wait for large thumbnail.
          for (let i = 0; i < 5; i++) {
            const largeThumbnails = (await iModelClient.Thumbnails().get(actx, accessToken, iModelId, "Large", new ThumbnailQuery().byVersionId(version.wsgId)));
            if (largeThumbnails.length > 0)
              break;
            await utils.delay(6000);
          }
        }
      }
    }
  });

  after(() => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      iModelClient.RequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should create named version", async function (this: Mocha.ITestCallbackContext) {
    const mockedChangeSets = Array(1).fill(0).map(() => utils.generateChangeSet());
    utils.mockGetChangeSet(iModelId, false, undefined, ...mockedChangeSets);
    const changeSetsCount = (await iModelClient.ChangeSets().get(actx, accessToken, iModelId)).length;

    // creating changeset for new named version
    const changeSet = (await utils.createChangeSets(accessToken, iModelId, briefcase, changeSetsCount, 1))[0];

    const versionName = `Version ${changeSetsCount + 1}`;
    utils.mockCreateVersion(iModelId, versionName, changeSet.id);
    const version: Version = await iModelClient.Versions().create(actx, accessToken, iModelId, changeSet.id!, versionName);

    chai.assert(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(changeSet.id);
    chai.expect(version.name).to.be.equal(versionName);
  });

  it("should get named versions", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);
    // Needs to create before expecting more than 0
    const versions: Version[] = await iModelClient.Versions().get(actx, accessToken, iModelId);

    let i = 0;
    for (const expectedVersion of versions) {
      utils.mockGetVersionById(iModelId, mockedVersions[i++]);
      const actualVersion: Version = (await iModelClient.Versions().get(actx, accessToken, iModelId, new VersionQuery().byId(expectedVersion.wsgId)))[0];
      chai.assert(!!actualVersion);
      chai.expect(actualVersion.changeSetId).to.be.equal(expectedVersion.changeSetId);
    }
  });

  it("should query named versions by ChangeSet id", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersion = utils.generateVersion();
    utils.mockGetVersions(iModelId, undefined, mockedVersion);
    utils.mockGetVersions(iModelId, `?$filter=ChangeSetId+eq+%27${mockedVersion.changeSetId!}%27`, mockedVersion);

    const expectedVersion: Version = (await iModelClient.Versions().get(actx, accessToken, iModelId))[0];
    chai.assert(expectedVersion);

    const version: Version[] = await iModelClient.Versions().get(actx, accessToken, iModelId, new VersionQuery().byChangeSet(expectedVersion.changeSetId!));
    chai.assert(version);
    chai.expect(version.length).to.be.equal(1);
    chai.expect(version[0].changeSetId).to.be.equal(expectedVersion.changeSetId);
  });

  it("should get named versions with thumbnail id", async () => {
    let mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);
    let versions: Version[] = await iModelClient.Versions().get(actx, accessToken, iModelId, new VersionQuery());
    chai.expect(versions.length >= 1);
    const firstVersion = versions[versions.length - 1];
    chai.expect(firstVersion.smallThumbnailId).to.be.undefined;
    chai.expect(firstVersion.largeThumbnailId).to.be.undefined;

    const mockedSmallThumbnail = utils.generateThumbnail("Small");
    utils.mockGetThumbnailsByVersionId(iModelId, "Small", firstVersion.wsgId, mockedSmallThumbnail);
    const smallThumbnail: Thumbnail = (await iModelClient.Thumbnails().get(actx, accessToken, iModelId, "Small", new ThumbnailQuery().byVersionId(firstVersion.wsgId)))[0];

    const mockedLargeThumbnail = utils.generateThumbnail("Large");
    utils.mockGetThumbnailsByVersionId(iModelId, "Large", firstVersion.wsgId, mockedLargeThumbnail);
    const largeThumbnail: Thumbnail = (await iModelClient.Thumbnails().get(actx, accessToken, iModelId, "Large", new ThumbnailQuery().byVersionId(firstVersion.wsgId)))[0];

    mockedVersions = Array(1).fill(0).map(() => utils.generateVersion(undefined, undefined, mockedSmallThumbnail.wsgId, mockedLargeThumbnail.wsgId));
    mockGetVersionsByIdWithThumbnails(iModelId, firstVersion.wsgId, ["Small", "Large"], ...mockedVersions);
    versions = await iModelClient.Versions().get(actx, accessToken, iModelId, new VersionQuery().byId(firstVersion.wsgId).selectThumbnailId("Small", "Large"));
    chai.expect(versions.length === 1);
    chai.expect(versions[0].smallThumbnailId).to.be.equal(smallThumbnail.wsgId);
    chai.expect(versions[0].largeThumbnailId).to.be.equal(largeThumbnail.wsgId);

    mockedVersions = Array(1).fill(0).map(() => utils.generateVersion(undefined, undefined, undefined, mockedLargeThumbnail.wsgId));
    mockGetVersionsByNameWithThumbnails(iModelId, firstVersion.name!, ["Large"], ...mockedVersions);
    versions = await iModelClient.Versions().get(actx, accessToken, iModelId, new VersionQuery().byName(firstVersion.name!).selectThumbnailId("Large"));
    chai.expect(versions.length === 1);
    chai.expect(versions[0].smallThumbnailId).to.be.undefined;
    chai.expect(versions[0].largeThumbnailId).to.be.equal(largeThumbnail.wsgId);

    chai.expect(smallThumbnail.wsgId).to.be.not.equal(largeThumbnail.wsgId);
  });

  it("should update named version", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, undefined, ...mockedVersions);

    let version: Version = (await iModelClient.Versions().get(actx, accessToken, iModelId))[0];
    chai.assert(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);

    version.name += " updated";
    utils.mockUpdateVersion(iModelId, version);
    version = await iModelClient.Versions().update(actx, accessToken, iModelId, version);

    chai.assert(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);
  });
});
