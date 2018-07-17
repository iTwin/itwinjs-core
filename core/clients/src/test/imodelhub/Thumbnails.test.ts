/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { ChangeSet, Version, Thumbnail, ThumbnailSize, ThumbnailQuery } from "../../";
import { AccessToken, IModelClient } from "../../";

import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

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

function mockDownloadLatestThumbnail(projectId: string, imodelId: string, size: ThumbnailSize) {
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, `${size}Thumbnail`, imodelId + "/$file");
  mockDownloadThumbnail(requestPath, size);
}

function mockDownloadThumbnailById(imodelId: string, thumbnailId: string, size: ThumbnailSize) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, `${size}Thumbnail`, thumbnailId + "/$file");
  mockDownloadThumbnail(requestPath, size);
}

interface TestParameters {
  thumbnails: Thumbnail[];
  size: ThumbnailSize;
}

describe("iModelHub ThumbnailHandler", () => {
  const test: TestParameters[] = [{ size: "Small", thumbnails: [] }, { size: "Large", thumbnails: [] }];
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  let versions: Version[];
  const imodelName = "imodeljs-clients Thumbnails test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();

  before(async () => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DoNotScheduleRenderThumbnailJob");
      imodelHubClient.CustomRequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }

    accessToken = await utils.login();
    projectId = await utils.getProjectId();
    await utils.createIModel(accessToken, imodelName, projectId);
    iModelId = await utils.getIModelId(accessToken, imodelName);

    if (TestConfig.enableMocks) {
      versions = Array(3).fill(0).map(() => utils.generateVersion());
      return;
    }

    // Delete and create a new iModel if we have not expected number of versions.
    versions = (await imodelHubClient.Versions().get(accessToken, iModelId));
    if (versions.length !== 0 && versions.length !== 3) {
      await utils.createIModel(accessToken, imodelName, projectId, true);
      iModelId = await utils.getIModelId(accessToken, imodelName);
      versions = new Array<Version>();
    }

    if (versions.length === 0) {
      // Create 3 named versions
      const briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];
      const changeSets: ChangeSet[] = await utils.createChangeSets(accessToken, iModelId, briefcase, 0, 3);
      for (let i = 0; i < 3; i++)
        await imodelHubClient.Versions().create(accessToken, iModelId, changeSets[i].id!, `Version ${i + 1}`);
      versions = (await imodelHubClient.Versions().get(accessToken, iModelId));

      // Wait for all 4 thumbnails (tip and 3 named versions).
      for (let i = 0; i < 5; i++) {
        const largeThumbnails: Thumbnail[] = await imodelHubClient.Thumbnails().get(accessToken, iModelId, "Large");
        if (largeThumbnails.length === 4)
          break;
        await utils.delay(6000);
      }
    }
  });

  after(() => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      imodelHubClient.CustomRequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  // This test should run first. It sets TestParameters for other tests.
  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail's ids`, async () => {
      const mockedThumbnails = Array(3).fill(0).map(() => utils.generateThumbnail(params.size));
      utils.mockGetThumbnails(iModelId, params.size, ...mockedThumbnails);
      params.thumbnails = await imodelHubClient.Thumbnails().get(accessToken, iModelId, params.size);

      if (params.thumbnails.length < 3) {
        utils.deleteIModelByName(accessToken, projectId, imodelName);
        chai.expect(params.thumbnails.length).to.be.gte(3);
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail by id`, async () => {
      for (let i = 0; i < 3; i++) {
        utils.mockGetThumbnailById(iModelId, params.size, params.thumbnails[i]);
        const actualThumbnail: Thumbnail = (await imodelHubClient.Thumbnails().get(accessToken, iModelId, params.size, new ThumbnailQuery().byId(params.thumbnails[i].wsgId)))[0];
        chai.assert(!!actualThumbnail);
        chai.expect(actualThumbnail.wsgId).to.be.equal(params.thumbnails[i].wsgId);
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail by version id`, async () => {
      for (let i = 0; i < 3; i++) {
        utils.mockGetThumbnailsByVersionId(iModelId, params.size, versions[i].wsgId, params.thumbnails[i]);
        const actualThumbnail: Thumbnail = (await imodelHubClient.Thumbnails().get(accessToken, iModelId, params.size, new ThumbnailQuery().byVersionId(versions[i].wsgId)))[0];
        chai.assert(!!actualThumbnail);
        chai.expect(actualThumbnail.wsgId).to.be.equal(params.thumbnails[i].wsgId);
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should download latest iModel's ${params.size}Thumbnail as a PNG file`, async () => {
      mockDownloadLatestThumbnail(projectId, iModelId, params.size);
      const image: string = await imodelHubClient.Thumbnails().download(accessToken, iModelId, { projectId: projectId!, size: params.size });
      chai.assert(image);
      chai.expect(image.length).greaterThan(getThumbnailLength(params.size));
      chai.assert(image.startsWith(pngPrefixStr));
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should download ${params.size}Thumbnail by id as a PNG file`, async () => {
      const expectedLength = getThumbnailLength(params.size);
      for (let i = 0; i < 3; i++) {
        mockDownloadThumbnailById(iModelId, params.thumbnails[i].wsgId, params.size);
        const image: string = await imodelHubClient.Thumbnails().download(accessToken, iModelId, params.thumbnails[i]);
        chai.assert(image);
        chai.expect(image.length).greaterThan(expectedLength);
        chai.assert(image.startsWith(pngPrefixStr));
      }
    });
  });
});
