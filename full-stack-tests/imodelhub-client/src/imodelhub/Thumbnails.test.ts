/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { IModelClient, Thumbnail, ThumbnailQuery, ThumbnailSize, Version } from "@bentley/imodelhub-client";
import { TestUsers } from "@itwin/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, { response });
}

function mockDownloadLatestThumbnail(iTwinId: string, imodelId: GuidString, size: ThumbnailSize) {
  const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, `${size}Thumbnail`, `${imodelId}/$file`);
  mockDownloadThumbnail(requestPath, size);
}

function mockDownloadThumbnailById(imodelId: GuidString, thumbnailId: string, size: ThumbnailSize) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, `${size}Thumbnail`, `${thumbnailId}/$file`);
  mockDownloadThumbnail(requestPath, size);
}

interface TestParameters {
  thumbnails: Thumbnail[];
  size: ThumbnailSize;
}

async function getIModelId(accessToken: AccessToken, name: string, iTwinId: string): Promise<string> {
  return utils.getIModelId(accessToken, name, iTwinId);
}

describe("iModelHub ThumbnailHandler (#unit)", () => {
  const test: TestParameters[] = [{ size: "Small", thumbnails: [] }, { size: "Large", thumbnails: [] }];
  let iTwinId: string;
  let imodelId: GuidString;
  let versions: Version[];
  let imodelHubClient: IModelClient;
  let accessToken: AccessToken;

  before(async function () {
    this.timeout(0);

    accessToken = TestConfig.enableMocks ? "" : await utils.login(TestUsers.super);

    iTwinId = await utils.getITwinId(accessToken);
    await utils.createIModel(accessToken, utils.sharedimodelName, iTwinId);
    imodelId = await getIModelId(accessToken, utils.sharedimodelName, iTwinId);
    imodelHubClient = utils.getDefaultClient();

    if (TestConfig.enableMocks) {
      versions = Array(3).fill(0).map(() => utils.generateVersion());
      return;
    }

    // // Delete and create a new iModel if we have not expected number of versions.
    // versions = (await imodelHubClient.versions.get(accessToken, imodelId));
    // if (versions.length !== 0 && versions.length !== 3) {
    //   await utils.createIModel(accessToken, imodelName, _projectId, true);
    //   imodelId = await getIModelId(accessToken, imodelName);
    //   versions = new Array<Version>();
    // }

    // if (versions.length === 0) {
    //   // Create 3 named versions
    //   const briefcase = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
    //   const changeSets: ChangeSet[] = await utils.createChangeSets(accessToken, imodelId, briefcase, 0, 3);
    //   for (let i = 0; i < 3; i++)
    //     await imodelHubClient.versions.create(accessToken, imodelId, changeSets[i].id!, `Version ${i + 1}`);
    //   versions = (await imodelHubClient.versions.get(accessToken, imodelId));

    //   // Wait for all 4 thumbnails (tip and 3 named versions).
    //   for (let i = 0; i < 50; i++) {
    //     const largeThumbnails: Thumbnail[] = await imodelHubClient.thumbnails.get(accessToken, imodelId, "Large");
    //     if (largeThumbnails.length === 4)
    //       break;
    //     await utils.delay(6000);
    //   }
    // }
  });

  after(async () => {
    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      imodelHubClient.requestOptions.setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }

    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(accessToken, iTwinId, utils.sharedimodelName);
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
      params.thumbnails = await imodelHubClient.thumbnails.get(accessToken, imodelId, params.size);

      if (params.thumbnails.length < 3) {
        await utils.deleteIModelByName(accessToken, iTwinId, utils.sharedimodelName);
        chai.expect(params.thumbnails.length).to.be.gte(3);
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail by id`, async () => {
      for (let i = 0; i < 3; i++) {
        utils.mockGetThumbnailById(imodelId, params.size, params.thumbnails[i]);
        const actualThumbnail: Thumbnail = (await imodelHubClient.thumbnails.get(accessToken, imodelId, params.size, new ThumbnailQuery().byId(params.thumbnails[i].id!)))[0];
        chai.assert(!!actualThumbnail);
        chai.expect(actualThumbnail.id!.toString()).to.be.equal(params.thumbnails[i].id!.toString());
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should get ${params.size}Thumbnail by version id`, async () => {
      for (let i = 0; i < 3; i++) {
        utils.mockGetThumbnailsByVersionId(imodelId, params.size, versions[i].id!, params.thumbnails[i]);
        // eslint-disable-next-line deprecation/deprecation
        const actualThumbnail: Thumbnail = (await imodelHubClient.thumbnails.get(accessToken, imodelId, params.size, new ThumbnailQuery().byVersionId(versions[i].id!)))[0];
        chai.assert(!!actualThumbnail);
        chai.expect(actualThumbnail.id!.toString()).to.be.equal(params.thumbnails[i].id!.toString());
      }
    });
  });

  test.forEach((params: TestParameters) => {
    it(`should download latest iModel's ${params.size}Thumbnail as a PNG file`, async () => {
      mockDownloadLatestThumbnail(iTwinId, imodelId, params.size);
      const image: string = await imodelHubClient.thumbnails.download(accessToken, imodelId, { iTwinId, size: params.size });
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
        const image: string = await imodelHubClient.thumbnails.download(accessToken, imodelId, params.thumbnails[i]);
        chai.assert(image);
        chai.expect(image.length).greaterThan(expectedLength);
        chai.assert(image.startsWith(pngPrefixStr));
      }
    });
  });
});
