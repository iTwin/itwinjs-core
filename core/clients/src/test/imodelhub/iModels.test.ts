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

function mockGetIModelByName(responseBuilder: ResponseBuilder, projectId: string, name: string, imodelId?: string, initialized = true) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", `?$filter=Name+eq+%27${encodeURIComponent(name)}%27`);
  const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
    new Map<string, any>([
      ["name", name],
      ["wsgId", imodelId],
      ["initialized", initialized],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockPostiModel(responseBuilder: ResponseBuilder, projectId: string, imodelId: string, imodelName: string) {
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
  const postBody = responseBuilder.generatePostBody<IModel>(
    responseBuilder.generateObject<IModel>(IModel, new Map<string, any>([["name", imodelName]])));
  const requestResponse = responseBuilder.generatePostResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
    new Map<string, any>([
      ["wsgId", imodelId],
      ["name", imodelName],
      ["initialized", false],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostNewSeedFile(responseBuilder: ResponseBuilder, imodelId: string, fileId: string, filePath: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile");
  const postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileName", path.basename(filePath)],
      ["fileSize", fs.statSync(filePath).size.toString()],
    ])));
  const requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["wsgId", fileId],
      ["fileId", fileId],
      ["fileName", path.basename(filePath)],
      ["uploadUrl", `https://qa-imodelhubapi.bentley.com/imodelhub-${imodelId}/123456`],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUploadSeedFile(responseBuilder: ResponseBuilder, imodelId: string) {
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Put, `/imodelhub-${imodelId}/123456`);
}

function mockPostUpdatedSeedFile(responseBuilder: ResponseBuilder, imodelId: string, fileId: string, filePath: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile", fileId);
  const postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([["wsgId", fileId], ["fileName", path.basename(filePath)], ["fileId", fileId], ["isUploaded", true]])));

  const requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileId", fileId],
      ["wsgId", fileId],
      ["isUploaded", true],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetSeedFile(responseBuilder: ResponseBuilder, imodelId: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile");
  const requestResponse = responseBuilder.generateGetResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([["initializationState", 0]])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockCreateiModel(responseBuilder: ResponseBuilder, projectId: string, imodelId: string, imodelName: string, filePath: string) {
  if (!TestConfig.enableMocks)
    return;

  const fileId = Guid.createValue();
  mockPostiModel(responseBuilder, projectId, imodelId, imodelName);
  mockPostNewSeedFile(responseBuilder, imodelId, fileId, filePath);
  mockUploadSeedFile(responseBuilder, imodelId);
  mockPostUpdatedSeedFile(responseBuilder, imodelId, fileId, filePath);
  mockGetSeedFile(responseBuilder, imodelId);
}

function mockDeleteiModel(responseBuilder: ResponseBuilder, projectId: string, imodelId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", imodelId);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

describe("iModelHub iModelHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  const imodelName = "imodeljs-clients iModels test";
  const createIModelName = "imodeljs-client iModels Create test";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();
  const imodelHubClient: IModelHubClient = utils.getDefaultClient(responseBuilder);
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
    responseBuilder.clearMocks();
  });

  after(() => {
    utils.deleteIModelByName(accessToken, projectId, createIModelName);
  });

  it("should get list of IModels", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([["name", imodelName]])));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const imodels: IModel[] = await imodelHubClient.IModels().get(accessToken, projectId);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel", async () => {
    mockGetIModelByName(responseBuilder, projectId, imodelName);
    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(iModel.name).equals(imodelName);
  });

  it("should be able to delete iModels", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    // Used only for maintenance
    const names = ["22_LargePlant.166.i"];
    for (const name of names) {
      mockGetIModelByName(responseBuilder, projectId, name);
      const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(name)))[0];
      chai.expect(iModel.name).equals(name);
      mockDeleteiModel(responseBuilder, projectId, iModel.wsgId);
      await imodelHubClient.IModels().delete(accessToken, projectId, iModel.wsgId);
    }
  });

  it("should retrieve an iModel by it's id", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", iModelId);
      const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([["wsgId", iModelId]])));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byId(iModelId)))[0];

    chai.expect(iModel.wsgId).equals(iModelId);
  });

  it("should fail getting an invalid iModel", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", "00000000-0000-0000-0000-000000000000");
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, responseBuilder.generateError("InstanceNotFound"),
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
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        responseBuilder.generateError("iModelHub.ProjectIdIsNotSpecified"),
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
      const requestResponse = responseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", true]]));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, undefined, undefined, 409);
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
    const filePath = utils.getMockSeedFilePath();
    mockCreateiModel(responseBuilder, projectId, Guid.createValue(), createIModelName, filePath);
    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, createIModelName, filePath);

    chai.expect(iModel.name).equals(createIModelName);
    chai.expect(iModel.initialized).equals(true);
  });

  it("should continue creating not initialized iModel", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const filePath = utils.getMockSeedFilePath();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const postBody = responseBuilder.generatePostBody<IModel>(
        responseBuilder.generateObject<IModel>(IModel,
          new Map<string, any>([["name", imodelName]])));
      const requestResponse = responseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", false]]));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

      const fileId = Guid.createValue();
      mockGetIModelByName(responseBuilder, projectId, imodelName, iModelId, false);
      mockPostNewSeedFile(responseBuilder, iModelId, fileId, filePath);
      mockUploadSeedFile(responseBuilder, iModelId);
      mockPostUpdatedSeedFile(responseBuilder, iModelId, fileId, filePath);
      mockGetSeedFile(responseBuilder, iModelId);
    }

    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, imodelName,
      filePath);

    chai.expect(iModel.wsgId).equals(iModelId);
    chai.expect(iModel.name).equals(imodelName);
    chai.expect(iModel.initialized).equals(true);
  });
});
