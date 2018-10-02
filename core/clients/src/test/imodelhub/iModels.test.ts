/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import { Guid, IModelHubStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";

import { AccessToken, WsgError, IModelQuery, IModelClient } from "../../";
import {
  IModelHubClient, HubIModel, SeedFile, IModelHubError,
  IModelHubClientError,
} from "../../";

import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

function mockGetIModelByName(projectId: string, name: string, description = "", imodelId?: Guid, initialized = true) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || new Guid(true);
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", `?$filter=Name+eq+%27${encodeURIComponent(name)}%27`);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
    new Map<string, any>([
      ["name", name],
      ["description", description],
      ["wsgId", imodelId.toString()],
      ["id", imodelId],
      ["initialized", initialized],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockPostiModel(projectId: string, imodelId: Guid, imodelName: string, description: string) {
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
  const postBody = ResponseBuilder.generatePostBody<HubIModel>(
    ResponseBuilder.generateObject<HubIModel>(HubIModel,
      new Map<string, any>([
        ["name", imodelName],
        ["description", description],
      ])));
  const requestResponse = ResponseBuilder.generatePostResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
    new Map<string, any>([
      ["wsgId", imodelId],
      ["name", imodelName],
      ["description", description],
      ["initialized", false],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostNewSeedFile(imodelId: Guid, fileId: string, filePath: string, description?: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile");
  const postBody = ResponseBuilder.generatePostBody<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileName", path.basename(filePath)],
      ["fileDescription", description],
      ["fileSize", fs.statSync(filePath).size.toString()],
    ])));
  const requestResponse = ResponseBuilder.generatePostResponse<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["wsgId", fileId],
      ["fileId", fileId],
      ["fileName", path.basename(filePath)],
      ["fileDescription", description],
      ["uploadUrl", `${utils.defaultUrl}/imodelhub-${imodelId}/123456`],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostUpdatedSeedFile(imodelId: Guid, fileId: string, filePath: string, description?: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile", fileId);
  const postBody = ResponseBuilder.generatePostBody<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["wsgId", fileId],
      ["fileName", path.basename(filePath)],
      ["fileId", fileId],
      ["isUploaded", true],
      ["fileDescription", description],
    ])));

  const requestResponse = ResponseBuilder.generatePostResponse<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileId", fileId],
      ["wsgId", fileId],
      ["isUploaded", true],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetSeedFile(imodelId: Guid, getFileUrl = false) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile",
    getFileUrl ? "?$select=*,FileAccessKey-forward-AccessKey.DownloadURL&$orderby=Index+desc" : "?$orderby=Index+desc");
  const values = new Map<string, any>();
  if (getFileUrl) {
    values.set("downloadUrl", "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile");
    values.set("fileSize", utils.getMockFileSize());
  } else {
    values.set("initializationState", 0);
  }
  const requestResponse = ResponseBuilder.generateGetResponse<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile, values));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockCreateiModel(projectId: string, imodelId: Guid, imodelName: string, description: string, filePath: string, chunks = 1) {
  if (!TestConfig.enableMocks)
    return;

  const fileId = Guid.createValue();
  mockPostiModel(projectId, imodelId, imodelName, description);
  mockPostNewSeedFile(imodelId, fileId, filePath, description);
  utils.mockUploadFile(imodelId, chunks);
  mockPostUpdatedSeedFile(imodelId, fileId, filePath, description);
  mockGetSeedFile(imodelId);
}

function mockDeleteiModel(projectId: string, imodelId: Guid) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", imodelId.toString());
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

function mockUpdateiModel(projectId: string, imodel: HubIModel) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", imodel.wsgId);
  const postBody = ResponseBuilder.generatePostBody<HubIModel>(imodel);
  const requestResponse = ResponseBuilder.generatePostResponse<HubIModel>(imodel);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

describe("iModelHub iModelHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let imodelId: Guid;
  let iModelClient: IModelClient;
  const imodelName = "imodeljs-clients iModels test";
  const createIModelName = "imodeljs-client iModels Create test";
  const imodelClient: IModelClient = utils.getDefaultClient();
  const alctx = new ActivityLoggingContext("");

  before(async () => {
    accessToken = await utils.login();
    projectId = await utils.getProjectId(accessToken, undefined);
    await utils.createIModel(accessToken, imodelName);
    imodelId = await utils.getIModelId(accessToken, imodelName);
    iModelClient = utils.getDefaultClient();
    await utils.deleteIModelByName(accessToken, projectId, createIModelName);

    if (!fs.existsSync(utils.workDir)) {
      fs.mkdirSync(utils.workDir);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  after(async () => {
    await utils.deleteIModelByName(accessToken, projectId, createIModelName);
    utils.getCloudEnv().terminate();
  });

  it("should get list of IModels", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["name", imodelName]])));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    let imodels: HubIModel[];
    imodels = await imodelClient.IModels().get(alctx, accessToken, projectId, undefined);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel", async () => {
    mockGetIModelByName(projectId, imodelName);
    const iModel: HubIModel = (await imodelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(iModel.name).to.be.equal(imodelName);
  });

  it("should be able to delete iModels", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    // Used only for maintenance
    const names = ["22_LargePlant.166.i"];
    for (const name of names) {
      mockGetIModelByName(projectId, name);
      const iModel: HubIModel = (await imodelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().byName(name)))[0];
      chai.expect(iModel.name).to.be.equal(name);
      mockDeleteiModel(projectId, iModel.id!);
      await imodelClient.IModels().delete(alctx, accessToken, projectId, iModel.id!);
    }
  });

  it("should retrieve an iModel by its id", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", imodelId.toString());
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["wsgId", imodelId]])));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const iModel: HubIModel = (await imodelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().byId(imodelId)))[0];

    chai.expect(iModel.id!.toString()).to.be.equal(imodelId.toString());
  });

  it("should fail getting an invalid iModel", async () => {
    const mockGuid = new Guid(true);
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", mockGuid.toString());
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, ResponseBuilder.generateError("InstanceNotFound"),
        1, undefined, undefined, 404);
    }

    let error: WsgError | undefined;
    try {
      await imodelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().byId(mockGuid));
    } catch (err) {
      if (err instanceof WsgError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.name).to.be.equal("InstanceNotFound");
  });

  it("should fail getting an iModel without projectId", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await imodelClient.IModels().get(alctx, accessToken, "", new IModelQuery().byId(imodelId));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }

    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.UndefinedArgumentError);
  });

  it("should get primary IModel", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", "?$orderby=CreatedDate+asc&$top=1");
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["name", imodelName]])));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const imodels = await imodelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().primary());
    chai.expect(imodels.length).to.be.equal(1);
  });

  it("should return empty list if no IModels returned", async () => {
    if (!TestConfig.enableMocks)
      return;

    const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", "?$orderby=CreatedDate+asc&$top=1");
    const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel), 0);
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);

    const imodels = await imodelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().primary());
    chai.expect(imodels.length).to.be.equal(0);
  });

  it("should fail creating existing and initialized iModel", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", true]]));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, undefined, undefined, 409);
    }

    let error: IModelHubError | undefined;
    try {
      await imodelClient.IModels().create(alctx, accessToken, projectId, imodelName, utils.getMockSeedFilePath(), "");
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile", async function (this: Mocha.ITestCallbackContext) {
    const filePath = utils.assetsPath + "LargerSeedFile.bim";
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateiModel(projectId, new Guid(true), createIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();
    const iModel = await imodelClient.IModels().create(alctx, accessToken, projectId, createIModelName, filePath, description, progressTracker.track());

    chai.expect(iModel.name).to.be.equal(createIModelName);
    chai.expect(iModel.initialized).to.be.equal(true);
    progressTracker.check();
  });

  it("should continue creating not initialized iModel", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const filePath = utils.getMockSeedFilePath();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const postBody = ResponseBuilder.generatePostBody<HubIModel>(
        ResponseBuilder.generateObject<HubIModel>(HubIModel,
          new Map<string, any>([["name", imodelName]])));
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", false]]));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

      const fileId = Guid.createValue();
      mockGetIModelByName(projectId, imodelName, "", imodelId, false);
      mockPostNewSeedFile(imodelId, fileId, filePath, undefined);
      utils.mockUploadFile(imodelId, 1);
      mockPostUpdatedSeedFile(imodelId, fileId, filePath, undefined);
      mockGetSeedFile(imodelId);
    }

    const iModel = await imodelClient.IModels().create(alctx, accessToken, projectId, imodelName, filePath, "");

    chai.expect(iModel.id!.toString()).to.be.equal(imodelId!.toString());
    chai.expect(iModel.name).to.be.equal(imodelName);
    chai.expect(iModel.initialized).to.be.equal(true);
  });

  it("should download a Seed File", async () => {
    mockGetSeedFile(imodelId, true);
    const downloadToPathname: string = path.join(utils.workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.IModels().download(alctx, accessToken, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should fail downloading the Seed File with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.IModels().download(alctx, accessToken, imodelId, utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail creating an iModel with no file handler", async function (this: Mocha.ITestCallbackContext) {
    if (!utils.getCloudEnv().isIModelHub)
      this.skip();

    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.IModels().create(alctx, accessToken, projectId, createIModelName, utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail creating an iModel with no file", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.IModels().create(alctx, accessToken, projectId, createIModelName, utils.workDir + "InvalidiModel.bim");
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should fail creating an iModel with directory path", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.IModels().create(alctx, accessToken, projectId, createIModelName, utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should update iModel name and description", async () => {
    mockGetIModelByName(projectId, imodelName);
    const imodel: HubIModel = (await iModelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(imodel.name).to.be.equal(imodelName);

    const newName = imodel.name + "_updated";
    const newDescription = "Description_updated";
    await utils.deleteIModelByName(accessToken, projectId, newName);
    imodel.name = newName;
    imodel.description = newDescription;
    mockUpdateiModel(projectId, imodel);
    let updatediModel = await iModelClient.IModels().update(alctx, accessToken, projectId, imodel);

    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);

    mockGetIModelByName(projectId, newName, newDescription, imodel.id);
    updatediModel = (await iModelClient.IModels().get(alctx, accessToken, projectId, new IModelQuery().byName(newName)))[0];

    await utils.deleteIModelByName(accessToken, projectId, newName);

    chai.assert(!!updatediModel);
    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
  });
});
