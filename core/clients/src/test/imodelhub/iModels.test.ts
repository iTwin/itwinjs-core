/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import { TestConfig } from "../TestConfig";
import { Guid } from "@bentley/bentleyjs-core";

import { IModel, SeedFile, IModelHubResponseError, IModelHubResponseErrorId, IModelQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { WsgError } from "../../WsgClient";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

declare const __dirname: string;

function mockGetIModelByName(projectId: string, name: string, imodelId?: string, initialized = true) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", `?$filter=Name+eq+%27${encodeURIComponent(name)}%27`);
  const requestResponse = ResponseBuilder.generateGetResponse<IModel>(ResponseBuilder.generateObject<IModel>(IModel,
    new Map<string, any>([
      ["name", name],
      ["wsgId", imodelId],
      ["initialized", initialized],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockPostiModel(projectId: string, imodelId: string, imodelName: string) {
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
  const postBody = ResponseBuilder.generatePostBody<IModel>(
    ResponseBuilder.generateObject<IModel>(IModel, new Map<string, any>([["name", imodelName]])));
  const requestResponse = ResponseBuilder.generatePostResponse<IModel>(ResponseBuilder.generateObject<IModel>(IModel,
    new Map<string, any>([
      ["wsgId", imodelId],
      ["name", imodelName],
      ["initialized", false],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostNewSeedFile(imodelId: string, fileId: string, filePath: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile");
  const postBody = ResponseBuilder.generatePostBody<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileName", path.basename(filePath)],
      ["fileSize", fs.statSync(filePath).size.toString()],
    ])));
  const requestResponse = ResponseBuilder.generatePostResponse<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["wsgId", fileId],
      ["fileId", fileId],
      ["fileName", path.basename(filePath)],
      ["uploadUrl", `${utils.defaultUrl}/imodelhub-${imodelId}/123456`],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostUpdatedSeedFile(imodelId: string, fileId: string, filePath: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile", fileId);
  const postBody = ResponseBuilder.generatePostBody<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([["wsgId", fileId], ["fileName", path.basename(filePath)], ["fileId", fileId], ["isUploaded", true]])));

  const requestResponse = ResponseBuilder.generatePostResponse<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileId", fileId],
      ["wsgId", fileId],
      ["isUploaded", true],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetSeedFile(imodelId: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile");
  const requestResponse = ResponseBuilder.generateGetResponse<SeedFile>(ResponseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([["initializationState", 0]])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockCreateiModel(projectId: string, imodelId: string, imodelName: string, filePath: string, chunks = 1) {
  if (!TestConfig.enableMocks)
    return;

  const fileId = Guid.createValue();
  mockPostiModel(projectId, imodelId, imodelName);
  mockPostNewSeedFile(imodelId, fileId, filePath);
  utils.mockUploadFile(imodelId, chunks);
  mockPostUpdatedSeedFile(imodelId, fileId, filePath);
  mockGetSeedFile(imodelId);
}

function mockDeleteiModel(projectId: string, imodelId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", imodelId);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

describe("iModelHub iModelHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  const imodelName = "imodeljs-clients iModels test";
  const createIModelName = "imodeljs-client iModels Create test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();
  const downloadToPath: string = __dirname + "/../assets/";

  before(async () => {
    projectId = await utils.getProjectId();
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    utils.deleteIModelByName(accessToken, projectId, createIModelName);

    if (!fs.existsSync(downloadToPath)) {
      fs.mkdirSync(downloadToPath);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  after(() => {
    utils.deleteIModelByName(accessToken, projectId, createIModelName);
  });

  it("should get list of IModels", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateGetResponse<IModel>(ResponseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([["name", imodelName]])));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const imodels: IModel[] = await imodelHubClient.IModels().get(accessToken, projectId);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel", async () => {
    mockGetIModelByName(projectId, imodelName);
    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(iModel.name).equals(imodelName);
  });

  it("should be able to delete iModels", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    // Used only for maintenance
    const names = ["22_LargePlant.166.i"];
    for (const name of names) {
      mockGetIModelByName(projectId, name);
      const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(name)))[0];
      chai.expect(iModel.name).equals(name);
      mockDeleteiModel(projectId, iModel.wsgId);
      await imodelHubClient.IModels().delete(accessToken, projectId, iModel.wsgId);
    }
  });

  it("should retrieve an iModel by its id", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", iModelId);
      const requestResponse = ResponseBuilder.generateGetResponse<IModel>(ResponseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([["wsgId", iModelId]])));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byId(iModelId)))[0];

    chai.expect(iModel.wsgId).equals(iModelId);
  });

  it("should fail getting an invalid iModel", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", "00000000-0000-0000-0000-000000000000");
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, ResponseBuilder.generateError("InstanceNotFound"),
        1, undefined, undefined, 404);
    }

    let error: WsgError | undefined;
    try {
      await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byId("00000000-0000-0000-0000-000000000000"));
    } catch (err) {
      if (err instanceof WsgError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.name === "InstanceNotFound");
  });

  it("should fail getting an iModel without projectId", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, "", "iModel", iModelId);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateError("iModelHub.ProjectIdIsNotSpecified"),
        1, undefined, undefined, 400);
    }

    let error: IModelHubResponseError | undefined;
    try {
      await imodelHubClient.IModels().get(accessToken, "", new IModelQuery().byId(iModelId));
    } catch (err) {
      if (err instanceof IModelHubResponseError)
        error = err;
    }

    chai.expect(error);
    chai.expect(error!.id === IModelHubResponseErrorId.ProjectIdIsNotSpecified);
  });

  it("should fail creating existing and initialized iModel", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", true]]));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, undefined, undefined, 409);
    }

    let error: IModelHubResponseError | undefined;
    try {
      await imodelHubClient.IModels().create(accessToken, projectId, imodelName,
        utils.getMockSeedFilePath());
    } catch (err) {
      if (err instanceof IModelHubResponseError)
        error = err;
    }
    chai.expect(error);
    chai.expect(error!.id === IModelHubResponseErrorId.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile", async function (this: Mocha.ITestCallbackContext) {
    const filePath = utils.assetsPath + "LargerSeedFile.bim";
    mockCreateiModel(projectId, Guid.createValue(), createIModelName, filePath, 2);
    const progressTracker = new utils.ProgressTracker();
    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, createIModelName, filePath, undefined, progressTracker.track());

    chai.expect(iModel.name).equals(createIModelName);
    chai.expect(iModel.initialized).equals(true);
    progressTracker.check();
  });

  it("should continue creating not initialized iModel", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const filePath = utils.getMockSeedFilePath();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const postBody = ResponseBuilder.generatePostBody<IModel>(
        ResponseBuilder.generateObject<IModel>(IModel,
          new Map<string, any>([["name", imodelName]])));
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", false]]));
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

      const fileId = Guid.createValue();
      mockGetIModelByName(projectId, imodelName, iModelId, false);
      mockPostNewSeedFile(iModelId, fileId, filePath);
      utils.mockUploadFile(iModelId, 1);
      mockPostUpdatedSeedFile(iModelId, fileId, filePath);
      mockGetSeedFile(iModelId);
    }

    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, imodelName,
      filePath);

    chai.expect(iModel.wsgId).equals(iModelId);
    chai.expect(iModel.name).equals(imodelName);
    chai.expect(iModel.initialized).equals(true);
  });
});
