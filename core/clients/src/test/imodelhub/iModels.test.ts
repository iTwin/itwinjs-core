/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";

import { TestConfig } from "../TestConfig";
import { Guid } from "@bentley/bentleyjs-core";

import { IModel, SeedFile, IModelHubResponseError, IModelHubResponseErrorId, IModelQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { WsgError } from "../../WsgClient";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import * as utils from "./TestUtils";

declare const __dirname: string;

async function deleteiModelByName(imodelHubClient: IModelHubClient, accessToken: AccessToken, projectId: string, imodelName: string): Promise<void> {
  const imodels = await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(imodelName));
  if (imodels.length > 0) {
    await imodelHubClient.IModels().delete(accessToken, projectId, imodels[0].wsgId);
  }
}

function mockGetIModelByName(responseBuilder: ResponseBuilder, projectId: string, name: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", `?$filter=Name+eq+%27${name}%27`);
  const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
    new Map<string, any>([
      ["name", name],
      ["wsgId", Guid.createValue()],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function mockDeleteiModel(responseBuilder: ResponseBuilder, projectId: string, imodelId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId,
    "iModel", imodelId);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath, "");
}

describe("iModelHub iModelHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let testiModelName: string | undefined;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    projectId = await utils.getProjectId();
    accessToken = await utils.login();
  });

  afterEach(async () => {
    responseBuilder.clearMocks();
    if (!TestConfig.enableMocks) {
      if (testiModelName) {
        await deleteiModelByName(imodelHubClient, accessToken, projectId, testiModelName);
        testiModelName = undefined;
      }
    }
  });

  it("should get list of IModels", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([["name", TestConfig.iModelName]])));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    const imodels: IModel[] = await imodelHubClient.IModels().get(accessToken, projectId);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel", async () => {
    mockGetIModelByName(responseBuilder, projectId, TestConfig.iModelName);
    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(TestConfig.iModelName)))[0];
    chai.expect(iModel.name).equals(TestConfig.iModelName);
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
});

function mockPostiModel(responseBuilder: ResponseBuilder, projectId: string, imodelId: string) {
  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
  const postBody = responseBuilder.generatePostBody<IModel>(
    responseBuilder.generateObject<IModel>(IModel, new Map<string, any>([["name", TestConfig.iModelName]])));
  const requestResponse = responseBuilder.generatePostResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
    new Map<string, any>([
      ["wsgId", imodelId],
      ["name", TestConfig.iModelName],
      ["initialized", true],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostNewSeedFile(responseBuilder: ResponseBuilder, imodelId: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile");
  const postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([["fileName", "empty.bim"], ["fileSize", "0"]])));
  const requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["wsgId", "00000000-0000-0000-0000-000000000000"],
      ["fileId", "123456"],
      ["fileName", "empty.bim"],
      ["uploadUrl", `https://qa-imodelhubapi.bentley.com/imodelhub-${imodelId}/123456`],
    ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUploadSeedFile(responseBuilder: ResponseBuilder, imodelId: string) {
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Put, `/imodelhub-${imodelId}/123456`, "");
}

function mockPostUpdatedSeedFile(responseBuilder: ResponseBuilder, imodelId: string) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "SeedFile", "00000000-0000-0000-0000-000000000000");
  const postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([["wsgId", "00000000-0000-0000-0000-000000000000"], ["fileName", "empty.bim"], ["fileId", "123456"], ["isUploaded", true]])));

  const requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
    new Map<string, any>([
      ["fileId", "123456"],
      ["wsgId", "00000000-0000-0000-0000-000000000000"],
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

function mockCreateiModel(responseBuilder: ResponseBuilder, projectId: string, imodelId: string) {
  if (!TestConfig.enableMocks)
    return;

  mockPostiModel(responseBuilder, projectId, imodelId);
  mockPostNewSeedFile(responseBuilder, imodelId);
  mockUploadSeedFile(responseBuilder, imodelId);
  mockPostUpdatedSeedFile(responseBuilder, imodelId);
  mockGetSeedFile(responseBuilder, imodelId);
}

describe.skip("iModelHub iModelHandler for a specific iModel", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const downloadToPath: string = __dirname + "/../assets/";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    projectId = await utils.getProjectId();
    accessToken = await utils.login();
    iModelId = await utils.getIModelId(accessToken, TestConfig.iModelName);

    if (!fs.existsSync(downloadToPath)) {
      fs.mkdirSync(downloadToPath);
    }
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should get the Id", async () => {
    chai.expect(iModelId.length).equals(36); // length of a guid string
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
      await imodelHubClient.IModels().create(accessToken, projectId, TestConfig.iModelName,
        downloadToPath + "empty-files/empty.bim");
    } catch (err) {
      if (err instanceof IModelHubResponseError)
        error = err;
    }
    chai.expect(error);
    chai.expect(error!.id === IModelHubResponseErrorId.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    mockCreateiModel(responseBuilder, projectId, iModelId);
    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, TestConfig.iModelName,
      downloadToPath + "empty-files/empty.bim");

    chai.expect(iModel.wsgId).equals(iModelId);
    chai.expect(iModel.name).equals(TestConfig.iModelName);
    chai.expect(iModel.initialized).equals(true);
  });

  it("should continue creating not initialized iModel", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    if (TestConfig.enableMocks) {
      let requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel");
      const postBody = responseBuilder.generatePostBody<IModel>(
        responseBuilder.generateObject<IModel>(IModel,
          new Map<string, any>([["name", TestConfig.iModelName]])));
      let requestResponse = responseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", false]]));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

      requestPath = utils.createRequestUrl(ScopeType.Project, projectId, "iModel", `?$filter=Name+eq+%27${TestConfig.iModelName}%27`);
      requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([
          ["wsgId", iModelId],
          ["name", TestConfig.iModelName],
          ["initialized", true],
        ])));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);

      mockPostNewSeedFile(responseBuilder, iModelId);
      mockUploadSeedFile(responseBuilder, iModelId);
      mockPostUpdatedSeedFile(responseBuilder, iModelId);
      mockGetSeedFile(responseBuilder, iModelId);
    }

    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, TestConfig.iModelName,
      downloadToPath + "empty-files/empty.bim");

    chai.expect(iModel.wsgId).equals(iModelId);
    chai.expect(iModel.name).equals(TestConfig.iModelName);
    chai.expect(iModel.initialized).equals(true);
  });
});
