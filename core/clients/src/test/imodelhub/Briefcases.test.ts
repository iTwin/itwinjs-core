/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import { TestConfig } from "../TestConfig";

import {
  Briefcase, IModelHubRequestError,
  IModelHubRequestErrorId, BriefcaseQuery,
} from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

declare const __dirname: string;

chai.should();

function mockGetBriefcaseById(responseBuilder: ResponseBuilder, imodelId: string, briefcase: Briefcase) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Briefcase", `${briefcase.briefcaseId!}`);
  const requestResponse = responseBuilder.generateGetResponse(briefcase);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockGetBriefcaseWithDownloadUrl(responseBuilder: ResponseBuilder, imodelId: string, briefcase: Briefcase) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Briefcase",
    `${briefcase.briefcaseId!}?$select=*,FileAccessKey-forward-AccessKey.DownloadURL`);
  briefcase.downloadUrl = "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile";
  briefcase.fileName = "TestModel.bim";
  const requestResponse = responseBuilder.generateGetResponse<Briefcase>(briefcase);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

describe("iModelHub BriefcaseHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  const imodelName = "imodeljs-clients Briefcases test";
  let briefcaseId: number;
  const responseBuilder: ResponseBuilder = new ResponseBuilder();
  const imodelHubClient: IModelHubClient = utils.getDefaultClient(responseBuilder);
  const downloadToPath: string = __dirname + "/../assets/";

  before(async () => {
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    if (!TestConfig.enableMocks) {
      const briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
      let briefcasesCount = briefcases.length;
      if (briefcasesCount > 19) {
        // Ensure that tests can still acquire briefcases
        for (const briefcase of briefcases) {
          await imodelHubClient.Briefcases().delete(accessToken, iModelId, briefcase.briefcaseId!);
        }
        briefcasesCount = 0;
      }

      // Ensure that at least one briefcase is available for querying
      if (briefcasesCount === 0) {
        await imodelHubClient.Briefcases().create(accessToken, iModelId);
      }
    }

    if (!fs.existsSync(downloadToPath)) {
      fs.mkdirSync(downloadToPath);
    }
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should acquire a briefcase", async () => {
    utils.mockCreateBriefcase(responseBuilder, iModelId, 2);
    const briefcase = await imodelHubClient.Briefcases().create(accessToken, iModelId);
    chai.expect(briefcase.briefcaseId).greaterThan(1);

  });

  it("should get all briefcases", async () => {
    utils.mockGetBriefcase(responseBuilder, iModelId, utils.generateBriefcase(2), utils.generateBriefcase(3));
    const briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
    chai.expect(briefcases.length).greaterThan(0);

    for (const briefcase of briefcases) {
      chai.expect(briefcase.iModelId).to.be.equal(iModelId);
    }
    briefcaseId = briefcases[0].briefcaseId!;
  });

  it("should fail getting an invalid briefcase", async () => {
    let error: any;
    try {
      await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(-1));
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error instanceof IModelHubRequestError);
    chai.expect(error.id === IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should get information on a briefcase by id", async () => {
    mockGetBriefcaseById(responseBuilder, iModelId, utils.generateBriefcase(briefcaseId));
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId)))[0];
    chai.expect(briefcase.briefcaseId).to.be.equal(briefcaseId);
    chai.expect(briefcase.downloadUrl).to.be.equal(undefined);
    chai.expect(briefcase.iModelId).to.be.equal(iModelId);
  });

  it("should fail deleting an invalid briefcase", async () => {
    let error: any;
    try {
      await imodelHubClient.Briefcases().delete(accessToken, iModelId, -1);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error instanceof IModelHubRequestError);
    chai.expect(error.id === IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should get the download URL for a Briefcase", async () => {
    mockGetBriefcaseWithDownloadUrl(responseBuilder, iModelId, utils.generateBriefcase(briefcaseId));
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.expect(briefcase.briefcaseId).to.be.equal(briefcaseId);
    chai.expect(briefcase.fileName);
    chai.expect(briefcase.fileName!.length > 0);
    chai.expect(briefcase.downloadUrl);
    chai.expect(briefcase.downloadUrl!.startsWith("https://"));
  });

  it("should download a Briefcase", async () => {
    mockGetBriefcaseWithDownloadUrl(responseBuilder, iModelId, utils.generateBriefcase(briefcaseId));
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.expect(briefcase.downloadUrl);

    const fileName: string = briefcase.fileName!;
    const downloadToPathname: string = path.join(downloadToPath, fileName);

    utils.mockFileResponse(responseBuilder, downloadToPath);

    await imodelHubClient.Briefcases().download(briefcase, downloadToPathname);
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should get error 400 and retry to get briefcase", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    const requestResponse = responseBuilder.generateGetResponse<Briefcase>(responseBuilder.generateObject<Briefcase>(Briefcase));

    responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, responseBuilder.generateError(undefined, "BadRequest"), 1, undefined, undefined, 400);
    responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    const briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId));
    chai.expect(briefcase);
  });

  it("should get error 409 and retry to get briefcase", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, responseBuilder.generateError("NoServerLicense"), 1, undefined, undefined, 409);
    try {
      (await imodelHubClient.Briefcases().get(accessToken, iModelId));
    } catch (err) {
      chai.expect(err.status).to.be.equal(409);
      chai.expect(err.name).to.be.equal("NoServerLicense");
    }
  });

  it("should get error 500 and retry to get briefcase", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, responseBuilder.generateError(undefined, "ServerError"), 5, undefined, undefined, 500);
    try {
      (await imodelHubClient.Briefcases().get(accessToken, iModelId));
    } catch (err) {
      chai.expect(err.status).to.be.equal(500);
    }
  });
});
