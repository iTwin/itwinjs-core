/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import { Guid, GuidString, IModelHubStatus } from "@bentley/bentleyjs-core";
import {
  AccessToken, WsgError, IModelQuery, IModelClient, InitializationState, RequestGlobalOptions, RequestTimeoutOptions,
  IModelHubClient, HubIModel, SeedFile, IModelHubError, IModelHubClientError, AuthorizedClientRequestContext,
} from "@bentley/imodeljs-clients";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

function mockGetIModelByName(contextId: string, name: string, description = "", imodelId?: GuidString, initialized = true) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();
  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId,
    "iModel", `?$filter=Name+eq+%27${encodeURIComponent(name)}%27`);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
    new Map<string, any>([
      ["name", name],
      ["description", description],
      ["wsgId", imodelId.toString()],
      ["id", imodelId],
      ["initialized", initialized],
    ])));
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetIModel(contextId: string, imodelName: string, imodelId: GuidString, imodelsCount?: number, description = "", extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();

  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId, "iModel", "?$orderby=CreatedDate+asc&$top=1");
  const responseProperties = new Map<string, any>([
    ["name", imodelName],
    ["description", description],
    ["wsgId", imodelId.toString()],
    ["id", imodelId],
  ]);
  if (!!extent)
    responseProperties.set("extent", extent);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(
    ResponseBuilder.generateObject<HubIModel>(HubIModel, responseProperties), imodelsCount);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockPostiModel(contextId: string, imodelId: GuidString, imodelName: string, description?: string, iModelTemplate?: string, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId, "iModel");
  const postBodyProperties = new Map<string, any>([
    ["name", imodelName],
  ]);

  if (!!description) {
    postBodyProperties.set("description", description);
  }

  if (!!iModelTemplate) {
    postBodyProperties.set("iModelTemplate", iModelTemplate);
  }

  if (!!extent) {
    postBodyProperties.set("extent", extent);
  }

  const postBody = ResponseBuilder.generatePostBody<HubIModel>(
    ResponseBuilder.generateObject<HubIModel>(HubIModel, postBodyProperties));
  const responseProperties = new Map<string, any>([
    ["wsgId", imodelId],
    ["name", imodelName],
    ["initialized", iModelTemplate === "Empty"],
  ]);

  if (!!description) {
    responseProperties.set("description", description);
  }

  if (!!iModelTemplate) {
    responseProperties.set("iModelTemplate", iModelTemplate);
  }

  if (!!extent) {
    responseProperties.set("extent", extent);
  }

  const requestResponse = ResponseBuilder.generatePostResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
    responseProperties));
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostNewSeedFile(imodelId: GuidString, fileId: string, filePath: string, description?: string) {
  if (!TestConfig.enableMocks)
    return;

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
      ["uploadUrl", `${utils.IModelHubUrlMock.getUrl()}/imodelhub-${imodelId}/123456`],
    ])));
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostUpdatedSeedFile(imodelId: GuidString, fileId: string, filePath: string, description?: string) {
  if (!TestConfig.enableMocks)
    return;

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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetSeedFile(imodelId: GuidString, getFileUrl = false) {
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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockCreateiModel(contextId: string, imodelId: GuidString, imodelName: string, description: string, filePath: string, chunks = 1, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  const fileId = Guid.createValue();
  mockPostiModel(contextId, imodelId, imodelName, description, undefined, extent);
  mockPostNewSeedFile(imodelId, fileId, filePath, description);
  utils.mockUploadFile(imodelId, chunks);
  mockPostUpdatedSeedFile(imodelId, fileId, filePath, description);
  mockGetSeedFile(imodelId);
}

function mockCreateEmptyiModel(contextId: string, imodelId: GuidString, imodelName: string, description: string, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  mockPostiModel(contextId, imodelId, imodelName, description, "Empty", extent);
}

function mockDeleteiModel(contextId: string, imodelId: GuidString) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId,
    "iModel", imodelId.toString());
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath);
}

function mockUpdateiModel(contextId: string, imodel: HubIModel) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId, "iModel", imodel.wsgId);
  const postBody = ResponseBuilder.generatePostBody<HubIModel>(imodel);
  const requestResponse = ResponseBuilder.generatePostResponse<HubIModel>(imodel);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

describe("iModelHub iModelsHandler", () => {
  let projectId: string;
  let imodelId: GuidString;
  let iModelClient: IModelClient;
  const imodelName = "imodeljs-clients iModels test";
  const createIModelName = "imodeljs-client iModels Create test";
  const imodelClient: IModelClient = utils.getDefaultClient();
  let requestContext: AuthorizedClientRequestContext;
  let backupTimeout: RequestTimeoutOptions;

  before(async function () {
    backupTimeout = RequestGlobalOptions.timeout;
    RequestGlobalOptions.timeout = {
      deadline: 100000,
      response: 100000,
    };

    this.enableTimeouts(false);
    const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext(accessToken);

    projectId = await utils.getProjectId(requestContext, undefined);
    await utils.createIModel(requestContext, imodelName);
    imodelId = await utils.getIModelId(requestContext, imodelName);
    iModelClient = utils.getDefaultClient();
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);

    if (!fs.existsSync(utils.workDir)) {
      fs.mkdirSync(utils.workDir);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  after(async () => {
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);
    RequestGlobalOptions.timeout = backupTimeout;
  });

  it("should get list of IModels (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["name", imodelName]])));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
    }

    let imodels: HubIModel[];
    imodels = await imodelClient.iModels.get(requestContext, projectId, undefined);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel (#iModelBank)", async () => {
    mockGetIModelByName(projectId, imodelName);
    const iModel: HubIModel = (await imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(iModel.name).to.be.equal(imodelName);
  });

  it("should be able to delete iModels (#unit)", async () => {
    // Used only for maintenance
    const names = ["22_LargePlant.166.i"];
    for (const name of names) {
      mockGetIModelByName(projectId, name);
      const iModel: HubIModel = (await imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(name)))[0];
      chai.expect(iModel.name).to.be.equal(name);
      mockDeleteiModel(projectId, iModel.id!);
      await imodelClient.iModels.delete(requestContext, projectId, iModel.id!);
    }
  });

  it("should retrieve an iModel by its id (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, projectId, "iModel", imodelId.toString());
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["wsgId", imodelId]])));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
    }

    const iModel: HubIModel = (await imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byId(imodelId)))[0];

    chai.expect(iModel.id!).to.be.equal(imodelId);
  });

  it("should fail getting an invalid iModel (#iModelBank)", async () => {
    const mockGuid = Guid.createValue();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, projectId, "iModel", mockGuid);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, ResponseBuilder.generateError("InstanceNotFound"),
        1, undefined, undefined, 404);
    }

    let error: WsgError | undefined;
    try {
      await imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byId(mockGuid));
    } catch (err) {
      if (err instanceof WsgError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.name).to.be.equal("InstanceNotFound");
  });

  it("should fail getting an iModel without projectId (#iModelBank)", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await imodelClient.iModels.get(requestContext, "", new IModelQuery().byId(imodelId));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }

    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.UndefinedArgumentError);
  });

  it("should fail creating existing and initialized iModel (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", true]]));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, undefined, undefined, 409);
    }

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModels.create(requestContext, projectId, imodelName, { path: utils.getMockSeedFilePath(), description: "" });
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile (#iModelBank)", async function () {
    const filePath = utils.assetsPath + "LargerSeedFile.bim";
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateiModel(projectId, Guid.createValue(), createIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();
    let iModel: HubIModel | undefined;
    try {
      iModel = await imodelClient.iModels.create(requestContext, projectId, createIModelName, { path: filePath, description, progressCallback: progressTracker.track(), timeOutInMilliseconds: 240000 });
    } catch (error) {
      chai.expect(error).to.be.instanceof(IModelHubClientError);
      const clientError = error as IModelHubClientError;
      if (clientError.status! === IModelHubStatus.InitializationTimeout) {
        this.skip();
        return;
      }
    }
    chai.assert(iModel);
    chai.expect(iModel!.name).to.be.equal(createIModelName);
    chai.expect(iModel!.initialized).to.be.equal(true);
    progressTracker.check();
  });

  it("should continue creating not initialized iModel (#unit)", async () => {
    const filePath = utils.getMockSeedFilePath();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, projectId, "iModel");
      const postBody = ResponseBuilder.generatePostBody<HubIModel>(
        ResponseBuilder.generateObject<HubIModel>(HubIModel,
          new Map<string, any>([["name", imodelName]])));
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", false]]));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

      const fileId = Guid.createValue();
      mockGetIModelByName(projectId, imodelName, "", imodelId, false);
      mockPostNewSeedFile(imodelId, fileId, filePath, undefined);
      utils.mockUploadFile(imodelId, 1);
      mockPostUpdatedSeedFile(imodelId, fileId, filePath, undefined);
      mockGetSeedFile(imodelId);
    }

    const iModel = await imodelClient.iModels.create(requestContext, projectId, imodelName, { path: filePath, description: "" });

    chai.expect(iModel.id!.toString()).to.be.equal(imodelId!.toString());
    chai.expect(iModel.name).to.be.equal(imodelName);
    chai.expect(iModel.initialized).to.be.equal(true);
  });

  it("should download a Seed File (#iModelBank)", async () => {
    mockGetSeedFile(imodelId, true);
    const downloadToPathname: string = path.join(utils.workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModels.download(requestContext, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should download a Seed File with Buffering (#iModelBank)", async () => {
    imodelClient.setFileHandler(utils.createFileHanlder(true));
    mockGetSeedFile(imodelId, true);
    const downloadToPathname: string = path.join(utils.workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModels.download(requestContext, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);

    imodelClient.setFileHandler(utils.createFileHanlder());
  });

  it("should fail downloading the Seed File with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient();
    try {
      await invalidClient.iModels.download(requestContext, imodelId, utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail creating an iModel with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient();
    try {
      await invalidClient.iModels.create(requestContext, projectId, createIModelName, { path: utils.workDir });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail creating an iModel with no file (#iModelBank)", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.iModels.create(requestContext, projectId, createIModelName, { path: utils.workDir + "InvalidiModel.bim" });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should fail creating an iModel with directory path (#iModelBank)", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.iModels.create(requestContext, projectId, createIModelName, { path: utils.workDir });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should fail creating an iModel with invalid size of extent", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.iModels.create(requestContext, projectId, createIModelName, { extent: [1] });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should fail creating an iModel with invalid coordinate of extent", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.iModels.create(requestContext, projectId, createIModelName, { extent: [1, -200, 3, 4] });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should clone iModel", async () => {
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);

    mockPostiModel(projectId, imodelId, createIModelName, "", `${imodelId}:`);
    mockGetSeedFile(imodelId);

    const imodel = await iModelClient.iModels.create(requestContext, projectId, createIModelName, { template: { imodelId } });
    chai.assert(imodel);
    chai.assert(imodel!.initialized);
    chai.expect(imodel!.iModelTemplate).to.be.equal(`${imodelId}:`);
  });

  it("should clone iModel with ChangeSets (#unit)", async () => {
    const briefcase = (await utils.getBriefcases(requestContext, imodelId, 1))[0];
    const changeSet = utils.getMockChangeSets(briefcase)[0];
    mockPostiModel(projectId, imodelId, createIModelName, "", `${imodelId}:${changeSet.id}`);
    mockGetSeedFile(imodelId);

    const imodel = await iModelClient.iModels.create(requestContext, projectId, createIModelName, { template: { imodelId, changeSetId: changeSet.id } });
    chai.assert(imodel);
    chai.assert(imodel!.initialized);
    chai.expect(imodel!.iModelTemplate).to.be.equal(`${imodelId}:${changeSet.id}`);
  });

  it("should update iModel name and description (#iModelBank)", async () => {
    mockGetIModelByName(projectId, imodelName);
    const imodel: HubIModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(imodel.name).to.be.equal(imodelName);

    const newName = imodel.name + "_updated";
    const newDescription = "Description_updated";
    await utils.deleteIModelByName(requestContext, projectId, newName);
    imodel.name = newName;
    imodel.description = newDescription;
    mockUpdateiModel(projectId, imodel);
    let updatediModel = await iModelClient.iModels.update(requestContext, projectId, imodel);

    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);

    mockGetIModelByName(projectId, newName, newDescription, imodel.id);
    updatediModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(newName)))[0];

    await utils.deleteIModelByName(requestContext, projectId, newName);

    chai.assert(!!updatediModel);
    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
  });

  it("should get oldest IModel (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      mockGetIModel(projectId, imodelName, Guid.createValue(), 1);
    }

    const imodel = await imodelClient.iModel.get(requestContext, projectId);
    chai.assert(imodel);
  });

  it("should throw if no IModels returned (#iModelBank)", async () => {
    if (!TestConfig.enableMocks)
      return;

    mockGetIModel(projectId, imodelName, Guid.createValue(), 0);

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.get(requestContext, projectId);
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelDoesNotExist);
  });

  it("should be able to delete iModel (#unit)", async () => {
    // Used only for maintenance
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, "22_LargePlant.166.i", imodelId, 1);
    mockDeleteiModel(projectId, imodelId);
    await imodelClient.iModel.delete(requestContext, projectId);
  });

  it("delete iModel should throw if iModel does not exist (#unit)", async () => {
    // Used only for maintenance
    mockGetIModel(projectId, "22_LargePlant.166.i", Guid.createValue(), 0);
    mockDeleteiModel(projectId, imodelId);

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.delete(requestContext, projectId);
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelDoesNotExist);
  });

  it("should return initialization status (#unit)", async () => {
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, "22_LargePlant.166.i", imodelId, 1);
    mockGetSeedFile(imodelId);

    const initializationState = await imodelClient.iModel.getInitializationState(requestContext, projectId);

    chai.expect(initializationState).to.be.equal(InitializationState.Successful);
  });

  it("should create iModel if iModel does not exist (#unit)", async () => {
    const filePath = utils.assetsPath + "LargerSeedFile.bim";
    const description = "Test iModel created by imodeljs-clients tests";
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, createIModelName, imodelId, 0);
    mockCreateiModel(projectId, imodelId, createIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();
    const iModel = await imodelClient.iModel.create(requestContext, projectId, createIModelName, { path: filePath, description, progressCallback: progressTracker.track() });

    chai.expect(iModel.name).to.be.equal(createIModelName);
    chai.expect(iModel.initialized).to.be.equal(true);
    progressTracker.check();
  });

  it("should throw iModelAlreadyExists if iModel already exist (#iModelBank)", async () => {
    const filePath = utils.assetsPath + "LargerSeedFile.bim";
    const description = "Test iModel created by imodeljs-clients tests";
    mockGetIModel(projectId, createIModelName, Guid.createValue(), 1);
    mockCreateiModel(projectId, Guid.createValue(), createIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.create(requestContext, projectId, createIModelName, { path: filePath, description, progressCallback: progressTracker.track() });
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel from empty seed file (#iModelBank)", async () => {
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);

    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(projectId, Guid.createValue(), createIModelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(requestContext, projectId, createIModelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(createIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);

    mockGetIModelByName(projectId, createIModelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(createIModelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should create single iModel from empty seed file (#unit)", async () => {
    const description = "Test iModel created by imodeljs-clients tests";
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, createIModelName, imodelId, 0);
    mockCreateEmptyiModel(projectId, Guid.createValue(), createIModelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModel.create(requestContext, projectId, createIModelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(createIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);
  });

  it("should update iModel extents", async () => {
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, imodelName, imodelId, 1);
    const newName = imodelName + "_updated";
    const newDescription = "Description_updated";
    const newExtent = [1, 2, 3, 4];

    const imodel = await iModelClient.iModel.get(requestContext, projectId);
    imodel.name = newName;
    imodel.description = newDescription;
    imodel.extent = newExtent;
    mockUpdateiModel(projectId, imodel);
    let updatediModel = await iModelClient.iModel.update(requestContext, projectId, imodel);

    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
    chai.expect(updatediModel.extent).to.be.eql(newExtent);

    mockGetIModel(projectId, newName, imodel.id!, 1, newDescription, newExtent);
    updatediModel = await iModelClient.iModel.get(requestContext, projectId);

    mockGetIModel(projectId, newName, imodel.id!, 1, newDescription, newExtent);
    mockDeleteiModel(projectId, imodel.id!);
    await iModelClient.iModel.delete(requestContext, projectId);

    chai.assert(!!updatediModel);
    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
    chai.expect(updatediModel.extent).to.be.eql(newExtent);
  });

  it("should download a Seed File if iModel exist (#iModelBank)", async () => {
    mockGetSeedFile(imodelId, true);
    mockGetIModel(projectId, imodelName, imodelId, 1);
    const downloadToPathname: string = path.join(utils.workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModel.download(requestContext, projectId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should create an iModel in the Asset (#iModelBank)", async () => {
    const assetId = await utils.getAssetId(requestContext, undefined);
    await utils.deleteIModelByName(requestContext, assetId, createIModelName);

    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(assetId, Guid.createValue(), createIModelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(requestContext, assetId, createIModelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(createIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);

    mockGetIModelByName(assetId, createIModelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(requestContext, assetId, new IModelQuery().byName(createIModelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should create iModel with an extent from empty seed file", async () => {
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);

    const description = "Test iModel created by imodeljs-clients tests";
    const extent = [1.1, 2.2, -3.3, -4.4];
    mockCreateEmptyiModel(projectId, Guid.createValue(), createIModelName, description, extent);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(requestContext, projectId, createIModelName, { description, progressCallback: progressTracker.track(), extent });

    chai.expect(imodel.name).to.be.equal(createIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    chai.expect(imodel.extent).to.be.eql(extent);
    progressTracker.check(false);

    mockGetIModelByName(projectId, createIModelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(createIModelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });
});
