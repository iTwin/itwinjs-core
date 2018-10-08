/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { ChangeSet, Version, Thumbnail, ThumbnailSize, ThumbnailQuery } from "../../";
import { AccessToken, IModelClient } from "../../";

import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

function getThumbnailLength(size: ThumbnailSize) {
  return size === "Small" ? 1000 : 3500;
}

const pngPrefixStr = "data:image/png;base64,";
function mockDownloadThumbnail(requestPath: string, size: ThumbnailSize) {
  if (!TestConfig.enableMocks)
    return;

  let response = "";
  for (let i = 0; i < getThumbnailLength(size); i++) { response += "a"; }
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, { response });
}

function mockDownloadLatestThumbnail(_projectId: string, imodelId: Guid, size: ThumbnailSize) {
  const requestPath = utils.createRequestUrl(ScopeType.Project, _projectId, `${size}Thumbnail`, imodelId + "/$file");
  mockDownloadThumbnail(requestPath, size);
}

function mockDownloadThumbnailById(imodelId: Guid, thumbnailId: string, size: ThumbnailSize) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, `${size}Thumbnail`, thumbnailId + "/$file");
  mockDownloadThumbnail(requestPath, size);
}

interface TestParameters {
  thumbnails: Thumbnail[];
  size: ThumbnailSize;
}

async function getIModelId(accessToken: AccessToken, name: string) {
  return new Guid(await utils.getIModelId(accessToken, name));
}

describe("iModelHub ThumbnailHandler  (#integration)", () => {
  const test: TestParameters[] = [{ size: "Small", thumbnails: [] }, { size: "Large", thumbnails: [] }];
  let accessToken: AccessToken;
  let _projectId: string;
  let imodelId: Guid;
  let versions: Version[];
  const imodelName = "imodeljs-clients Thumbnails test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DoNotScheduleRenderThumbnailJob");
      imodelHubClient.RequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }

    accessToken = await utils.login();
    _projectId = await utils.getProjectId(accessToken);
    await utils.createIModel(accessToken, imodelName, _projectId);
    imodelId = await getIModelId(accessToken, imodelName);

    if (TestConfig.enableMocks) {
      versions = Array(3).fill(0).map(() => utils.generateVersion());
      return;
    }

    // Delete and create a new iModel if we have not expected number of versions.
    versions = (await imodelHubClient.Versions().get(actx, accessToken, imodelId));
    if (versions.length !== 0 && versions.length !== 3) {
      await utils.createIModel(accessToken, imodelName, _projectId, true);
      imodelId = await getIModelId(accessToken, imodelName);
      versions = new Array<Version>();
    }

    if (versions.length === 0) {
      // Create 3 named versions
      const briefcase = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
      const changeSets: ChangeSet[] = await utils.createChangeSets(accessToken, imodelId, briefcase, 0, 3);
      for (let i = 0; i < 3; i++)
        await imodelHubClient.Versions().create(actx, accessToken, imodelId, changeSets[i].id!, `Version ${i + 1}`);
      versions = (await imodelHubClient.Versions().get(actx, accessToken, imodelId));

      // Wait for all 4 thumbnails (tip and 3 named versions).
      for (let i = 0; i < 5; i++) {
        const largeThumbnails: Thumbnail[] = await imodelHubClient.Thumbnails().get(actx, accessToken, imodelId, "Large");
        if (largeThumbnails.length === 4)
          break;
        await utils.delay(6000);
      }
    }
  });

  after(() => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      imodelHubClient.RequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  // This test should run first. It sets TestParameters for other tests.
  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail's ids`, async () => {
      const mockedThumbnails = Array(3).fill(0).map(() => utils.generateThumbnail(params.size));
      utils.mockGetThumbnails(imodelId, params.size, ...mockedThumbnails);
      params.thumbnails = await imodelHubClient.Thumbnails().get(actx, accessToken, imodelId, params.size);

      if (params.thumbnails.length < 3) {
        utils.deleteIModelByName(accessToken, _projectId, imodelName);
        chai.expect(params.thumbnails.length).to.be.gte(3);
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail by id`, async () => {
      for (let i = 0; i < 3; i++) {
        utils.mockGetThumbnailById(imodelId, params.size, params.thumbnails[i]);
        const actualThumbnail: Thumbnail = (await imodelHubClient.Thumbnails().get(actx, accessToken, imodelId, params.size, new ThumbnailQuery().byId(params.thumbnails[i].id!)))[0];
        chai.assert(!!actualThumbnail);
        chai.expect(actualThumbnail.id!.toString()).to.be.equal(params.thumbnails[i].id!.toString());
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail by version id`, async () => {
      for (let i = 0; i < 3; i++) {
        utils.mockGetThumbnailsByVersionId(imodelId, params.size, versions[i].id!, params.thumbnails[i]);
        const actualThumbnail: Thumbnail = (await imodelHubClient.Thumbnails().get(actx, accessToken, imodelId, params.size, new ThumbnailQuery().byVersionId(new Guid(versions[i].id))))[0];
        chai.assert(!!actualThumbnail);
        chai.expect(actualThumbnail.id!.toString()).to.be.equal(params.thumbnails[i].id!.toString());
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should download latest iModel's ${params.size}Thumbnail as a PNG file`, async () => {
      mockDownloadLatestThumbnail(_projectId, imodelId, params.size);
      const image: string = await imodelHubClient.Thumbnails().download(actx, accessToken, imodelId, { projectId: _projectId, size: params.size });
      chai.assert(image);
      chai.expect(image.length).greaterThan(getThumbnailLength(params.size));
      chai.assert(image.startsWith(pngPrefixStr));
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should download ${params.size}Thumbnail by id as a PNG file`, async () => {
      const expectedLength = getThumbnailLength(params.size);
      for (let i = 0; i < 3; i++) {
        mockDownloadThumbnailById(imodelId, params.thumbnails[i].wsgId, params.size);
        const image: string = await imodelHubClient.Thumbnails().download(actx, accessToken, imodelId, params.thumbnails[i]);
        chai.assert(image);
        chai.expect(image.length).greaterThan(expectedLength);
        chai.assert(image.startsWith(pngPrefixStr));
      }
    });
  });
});
