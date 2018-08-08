/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import { AccessToken } from "../../";

import { IModelClient } from "../../";
import {
  IModelHubClient, Briefcase, BriefcaseQuery, IModelHubClientError,
} from "../../";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { IModelHubStatus } from "@bentley/bentleyjs-core";

function mockGetBriefcaseById(imodelId: string, briefcase: Briefcase) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Briefcase", `${briefcase.briefcaseId!}`);
  const requestResponse = ResponseBuilder.generateGetResponse(briefcase);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockGetBriefcaseWithDownloadUrl(imodelId: string, briefcase: Briefcase) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Briefcase",
    `${briefcase.briefcaseId!}?$select=*,FileAccessKey-forward-AccessKey.DownloadURL`);
  briefcase.downloadUrl = "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile";
  briefcase.fileName = "TestModel.bim";
  briefcase.fileSize = utils.getMockFileSize();
  const requestResponse = ResponseBuilder.generateGetResponse<Briefcase>(briefcase);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockDeleteBriefcase(imodelId: string, briefcaseId: number) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Briefcase", briefcaseId.toString());
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath, {});
}

describe("iModelHub BriefcaseHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  const imodelName = "imodeljs-clients Briefcases test";
  let briefcaseId: number;
  let acquiredBriefcaseId: number;
  const imodelHubClient: IModelClient = utils.getDefaultClient();

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
        const briefcase = await imodelHubClient.Briefcases().create(accessToken, iModelId);
        briefcaseId = briefcase.briefcaseId!;
      } else {
        briefcaseId = briefcases[0].briefcaseId!;
      }
    } else {
      briefcaseId = 2;
    }

    if (!fs.existsSync(utils.workDir)) {
      fs.mkdirSync(utils.workDir);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should acquire a briefcase", async () => {
    utils.mockCreateBriefcase(iModelId, 3);
    const briefcase = await imodelHubClient.Briefcases().create(accessToken, iModelId);
    chai.expect(briefcase.briefcaseId).to.be.greaterThan(1);
    acquiredBriefcaseId = briefcase.briefcaseId!;
  });

  it("should get all briefcases", async () => {
    utils.mockGetBriefcase(iModelId, utils.generateBriefcase(2), utils.generateBriefcase(3));
    const briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
    chai.expect(briefcases.length).to.be.greaterThan(0);

    for (const briefcase of briefcases) {
      chai.expect(briefcase.iModelId).to.be.equal(iModelId);
    }
  });

  it("should delete a briefcase", async () => {
    utils.mockGetBriefcase(iModelId, utils.generateBriefcase(2), utils.generateBriefcase(acquiredBriefcaseId));
    const originalBriefcaseCount = (await imodelHubClient.Briefcases().get(accessToken, iModelId)).length;

    mockDeleteBriefcase(iModelId, acquiredBriefcaseId);
    await imodelHubClient.Briefcases().delete(accessToken, iModelId, acquiredBriefcaseId);

    utils.mockGetBriefcase(iModelId, utils.generateBriefcase(2));
    const briefcaseCount = (await imodelHubClient.Briefcases().get(accessToken, iModelId)).length;

    chai.expect(briefcaseCount).to.be.lessThan(originalBriefcaseCount);
  });

  it("should fail getting an invalid briefcase", async () => {
    let error: any;
    try {
      await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(-1));
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error).to.be.instanceof(IModelHubClientError);
    chai.expect(error.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should get information on a briefcase by id", async () => {
    mockGetBriefcaseById(iModelId, utils.generateBriefcase(briefcaseId));
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
    chai.expect(error).to.be.instanceof(IModelHubClientError);
    chai.expect(error.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should get the download URL for a Briefcase", async () => {
    mockGetBriefcaseWithDownloadUrl(iModelId, utils.generateBriefcase(briefcaseId));
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.expect(briefcase.briefcaseId).to.be.equal(briefcaseId);
    chai.assert(briefcase.fileName);
    chai.expect(briefcase.fileName!.length).to.be.greaterThan(0);
    chai.assert(briefcase.downloadUrl);
    chai.assert(briefcase.downloadUrl!.startsWith("https://"));
  });

  it("should download a Briefcase", async () => {
    mockGetBriefcaseWithDownloadUrl(iModelId, utils.generateBriefcase(briefcaseId));
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.assert(briefcase.downloadUrl);

    const fileName: string = briefcase.fileName!;
    const downloadToPathname: string = path.join(utils.workDir, fileName);

    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await imodelHubClient.Briefcases().download(briefcase, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should download a Briefcase without buffered write", async () => {
    mockGetBriefcaseWithDownloadUrl(iModelId, utils.generateBriefcase(briefcaseId));
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.assert(briefcase.downloadUrl);

    const fileName: string = briefcase.fileName!;
    const downloadToPathname: string = path.join(utils.workDir, fileName);

    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    const client = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler(false));
    await client.Briefcases().download(briefcase, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should get error 409 and fail to get briefcase", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, ResponseBuilder.generateError("NoServerLicense"), 1, undefined, undefined, 409);
    let error;
    try {
      (await imodelHubClient.Briefcases().get(accessToken, iModelId));
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status).to.be.equal(409);
    chai.expect(error.name).to.be.equal("NoServerLicense");
  });

  it("should get error 500 and retry to get briefcase", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, ResponseBuilder.generateError(undefined, "ServerError"), 5, undefined, undefined, 500);
    let error;
    try {
      (await imodelHubClient.Briefcases().get(accessToken, iModelId));
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status).to.be.equal(500);
  });

  it("should fail downloading briefcase with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.Briefcases().download(new Briefcase(), utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail downloading briefcase with no file url", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await imodelHubClient.Briefcases().download(new Briefcase(), utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.MissingDownloadUrlError);
  });
});
