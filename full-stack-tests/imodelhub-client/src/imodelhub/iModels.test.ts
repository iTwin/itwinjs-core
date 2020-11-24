/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import { Guid, GuidString, IModelHubStatus } from "@bentley/bentleyjs-core";
import {
  HubIModel, IModelClient, IModelHubClient, IModelHubClientError, IModelHubError, IModelQuery, IModelType, InitializationState, SeedFile,
} from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext, RequestGlobalOptions, RequestTimeoutOptions, WsgError } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";
import { assetsPath, workDir } from "./TestConstants";
import { createFileHandler } from "./FileHandler";

function mockGetIModelByName(contextId: string, name: string, description = "", imodelId?: GuidString, initialized = true, iModelType = IModelType.Undefined, returnsInstances = true) {
  mockGetIModelWithFilter(`?$filter=Name+eq+%27${encodeURIComponent(name)}%27`, contextId, name, description, imodelId, initialized, "Empty", iModelType, returnsInstances);
}

function mockGetIModelByType(contextId: string, name: string, imodelId: GuidString | undefined, iModelType: IModelType, returnsInstances = true) {
  mockGetIModelWithFilter(`?$filter=Type+eq+${iModelType}`, contextId, name, "", imodelId, true, "Empty", iModelType, returnsInstances);
}

function mockGetIModelByTemplate(contextId: string, name: string, imodelId: GuidString | undefined, template: string, returnsInstances = true) {
  mockGetIModelWithFilter(`?$filter=iModelTemplate+eq+%27${encodeURIComponent(template)}%27`, contextId, name, "", imodelId, true, template, IModelType.Undefined, returnsInstances);
}

function mockGetIModelWithFilter(
  query: string,
  contextId: string,
  name: string,
  description: string,
  imodelId: GuidString | undefined,
  initialized: boolean,
  template: string,
  iModelType: IModelType,
  returnsInstances: boolean) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();
  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId, "iModel", query);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
    new Map<string, any>([
      ["name", name],
      ["description", description],
      ["wsgId", imodelId.toString()],
      ["id", imodelId],
      ["initialized", initialized],
      ["iModelTemplate", template],
      ["iModelType", iModelType],
    ])), returnsInstances ? 1 : 0);
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
  if (extent)
    responseProperties.set("extent", extent);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(
    ResponseBuilder.generateObject<HubIModel>(HubIModel, responseProperties), imodelsCount);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockPostiModel(contextId: string, imodelId: GuidString, imodelName: string, description?: string, iModelTemplate?: string, iModelType?: IModelType, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId, "iModel");
  const postBodyProperties = new Map<string, any>([
    ["name", imodelName],
  ]);

  if (description) {
    postBodyProperties.set("description", description);
  }

  if (iModelTemplate) {
    postBodyProperties.set("iModelTemplate", iModelTemplate);
  }

  if (iModelType) {
    postBodyProperties.set("iModelType", iModelType);
  }

  if (extent) {
    postBodyProperties.set("extent", extent);
  }

  const postBody = ResponseBuilder.generatePostBody<HubIModel>(
    ResponseBuilder.generateObject<HubIModel>(HubIModel, postBodyProperties));
  const responseProperties = new Map<string, any>([
    ["wsgId", imodelId],
    ["name", imodelName],
    ["initialized", iModelTemplate === "Empty"],
  ]);

  if (description) {
    responseProperties.set("description", description);
  }

  if (iModelTemplate) {
    responseProperties.set("iModelTemplate", iModelTemplate);
  }

  if (iModelType) {
    responseProperties.set("iModelType", iModelType);
  } else {
    responseProperties.set("iModelType", IModelType.Undefined);
  }

  if (extent) {
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
  mockPostiModel(contextId, imodelId, imodelName, description, undefined, undefined, extent);
  mockPostNewSeedFile(imodelId, fileId, filePath, description);
  utils.mockUploadFile(imodelId, chunks);
  mockPostUpdatedSeedFile(imodelId, fileId, filePath, description);
  mockGetSeedFile(imodelId);
}

function mockCreateEmptyiModel(contextId: string, imodelId: GuidString, imodelName: string, description: string, iModelType = IModelType.Undefined, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  mockPostiModel(contextId, imodelId, imodelName, description, "Empty", iModelType, extent);
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
  let assetId: string;
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

    (requestContext as any).activityId = "iModelHub iModelsHandler";
    projectId = await utils.getProjectId(requestContext, "iModelJsTest");
    assetId = await utils.getAssetId(requestContext, undefined);

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir);
    }
  });

  beforeEach(async () => {
    await utils.createIModel(requestContext, imodelName, projectId);
    imodelId = await utils.getIModelId(requestContext, imodelName, projectId);
    iModelClient = utils.getDefaultClient();
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);
  });

  afterEach(async () => {
    await utils.deleteIModelByName(requestContext, projectId, imodelName);
    await utils.deleteIModelByName(requestContext, projectId, createIModelName);
    ResponseBuilder.clearMocks();
  });

  after(async () => {
    RequestGlobalOptions.timeout = backupTimeout;
    if (!TestConfig.enableMocks)
      await utils.deleteIModelByName(requestContext, assetId, createIModelName);
  });

  it("should get list of IModels (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, projectId, "iModel");
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["name", imodelName]])));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
    }

    const imodels: HubIModel[] = await imodelClient.iModels.get(requestContext, projectId, undefined);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel (#iModelBank)", async () => {
    const testIModelName = utils.getUniqueIModelName(imodelName);
    mockGetIModelByName(projectId, testIModelName);
    const iModel: HubIModel = (await imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(testIModelName)))[0];
    chai.expect(iModel.name).to.be.equal(testIModelName);
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
      await imodelClient.iModels.create(requestContext, projectId, utils.getUniqueIModelName(imodelName), { path: utils.getMockSeedFilePath(), description: "" });
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile", async function () {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const filePath = `${assetsPath}LargerSeedFile.bim`;
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateiModel(projectId, Guid.createValue(), testIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();

    const iModel: HubIModel = await imodelClient.iModels.create(requestContext, projectId, testIModelName,
      { path: filePath, description, progressCallback: progressTracker.track(), timeOutInMilliseconds: TestConfig.initializeiModelTimeout });
    chai.assert(iModel);
    chai.expect(iModel.name).to.be.equal(testIModelName);
    chai.expect(iModel.initialized).to.be.equal(true);
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
    const downloadToPathname: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModels.download(requestContext, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should download a Seed File with Buffering (#iModelBank)", async () => {
    imodelClient.setFileHandler(createFileHandler(true));
    mockGetSeedFile(imodelId, true);
    const downloadToPathname: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModels.download(requestContext, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);

    imodelClient.setFileHandler(createFileHandler());
  });

  it("should fail downloading the Seed File with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient();
    try {
      await invalidClient.iModels.download(requestContext, imodelId, workDir);
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
      await invalidClient.iModels.create(requestContext, projectId, utils.getUniqueIModelName(createIModelName), { path: workDir });
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
      await iModelClient.iModels.create(requestContext, projectId, utils.getUniqueIModelName(createIModelName), { path: `${workDir}InvalidiModel.bim` });
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
      await iModelClient.iModels.create(requestContext, projectId, utils.getUniqueIModelName(createIModelName), { path: workDir });
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
      await iModelClient.iModels.create(requestContext, projectId, utils.getUniqueIModelName(createIModelName), { extent: [1] });
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
      await iModelClient.iModels.create(requestContext, projectId, utils.getUniqueIModelName(createIModelName), { extent: [1, -200, 3, 4] });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should create iModel from another iModel", async function () {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    await utils.deleteIModelByName(requestContext, projectId, testIModelName);

    mockPostiModel(projectId, imodelId, testIModelName, "", `${imodelId}:`);
    mockGetSeedFile(imodelId);

    const imodel: HubIModel = await iModelClient.iModels.create(requestContext, projectId, testIModelName,
      { template: { imodelId }, timeOutInMilliseconds: TestConfig.initializeiModelTimeout });

    chai.assert(imodel);
    chai.assert(imodel.initialized);
    chai.expect(imodel.iModelTemplate).to.be.equal(`${imodelId}:`);
  });

  it("should create iModel from another iModel and ChangeSet (#unit)", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const briefcase = (await utils.getBriefcases(requestContext, imodelId, 1))[0];
    const changeSet = utils.getMockChangeSets(briefcase)[0];
    mockPostiModel(projectId, imodelId, testIModelName, "", `${imodelId}:${changeSet.id}`);
    mockGetSeedFile(imodelId);

    const imodel = await iModelClient.iModels.create(requestContext, projectId, testIModelName, { template: { imodelId, changeSetId: changeSet.id } });
    chai.assert(imodel);
    chai.assert(imodel.initialized);
    chai.expect(imodel.iModelTemplate).to.be.equal(`${imodelId}:${changeSet.id}`);
  });

  it("should update iModel name and description (#iModelBank)", async () => {
    const testIModelName = utils.getUniqueIModelName(imodelName);
    mockGetIModelByName(projectId, testIModelName);
    const imodel: HubIModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(testIModelName)))[0];
    chai.expect(imodel.name).to.be.equal(testIModelName);

    const newName = utils.getUniqueIModelName(`${imodelName}_updated`);
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

    await utils.deleteIModelByName(requestContext, projectId, newName, false);

    chai.assert(!!updatediModel);
    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
  });

  it("should set and update iModel type correctly", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(projectId, Guid.createValue(), testIModelName, description);
    const initialiModel = await imodelClient.iModels.create(requestContext, projectId, testIModelName, { description });
    chai.expect(initialiModel.iModelType).to.be.equal(IModelType.Undefined);

    initialiModel.iModelType = IModelType.Library;
    mockUpdateiModel(projectId, initialiModel);
    const updatediModel = await iModelClient.iModels.update(requestContext, projectId, initialiModel);
    chai.expect(updatediModel.iModelType).to.be.equal(IModelType.Library);

    updatediModel.description = "New description for test iModel created by imodeljs-clients tests";
    updatediModel.iModelType = undefined;
    mockUpdateiModel(projectId, updatediModel);
    await iModelClient.iModels.update(requestContext, projectId, updatediModel);

    mockGetIModelByName(projectId, testIModelName, description, updatediModel.id, true, IModelType.Library);
    const queriediModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(testIModelName)))[0];
    chai.expect(queriediModel.iModelType).to.be.equal(IModelType.Library);
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
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const filePath = `${assetsPath}LargerSeedFile.bim`;
    const description = "Test iModel created by imodeljs-clients tests";
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, testIModelName, imodelId, 0);
    mockCreateiModel(projectId, imodelId, testIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();
    const iModel = await imodelClient.iModel.create(requestContext, projectId, testIModelName, { path: filePath, description, progressCallback: progressTracker.track() });

    chai.expect(iModel.name).to.be.equal(testIModelName);
    chai.expect(iModel.initialized).to.be.equal(true);
    progressTracker.check();
  });

  it("should throw iModelAlreadyExists if iModel already exist (#iModelBank)", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const filePath = `${assetsPath}LargerSeedFile.bim`;
    const description = "Test iModel created by imodeljs-clients tests";
    mockGetIModel(projectId, testIModelName, Guid.createValue(), 1);
    mockCreateiModel(projectId, Guid.createValue(), testIModelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.create(requestContext, projectId, testIModelName, { path: filePath, description, progressCallback: progressTracker.track() });
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel from empty seed file (#iModelBank)", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    await utils.deleteIModelByName(requestContext, projectId, testIModelName);

    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(projectId, Guid.createValue(), testIModelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(requestContext, projectId, testIModelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(testIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);

    mockGetIModelByName(projectId, testIModelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(testIModelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should create single iModel from empty seed file (#unit)", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const description = "Test iModel created by imodeljs-clients tests";
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, testIModelName, imodelId, 0);
    mockCreateEmptyiModel(projectId, Guid.createValue(), testIModelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModel.create(requestContext, projectId, testIModelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(testIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);
  });

  // Inconsistently passes as integration test due to concurrency issues, temporarily make unit test
  it("should update iModel extents (#unit)", async () => {
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(projectId, imodelName, imodelId, 1);
    const newName = `${imodelName}_updated`;
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

  // Inconsistently passes as integration test due to concurrency issues, temporarily make unit test
  it("should download a Seed File if iModel exist (#iModelBank #unit)", async () => {
    mockGetSeedFile(imodelId, true);
    mockGetIModel(projectId, imodelName, imodelId, 1);
    const downloadToPathname: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModel.download(requestContext, projectId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.true;
  });

  it("should create an iModel in the Asset (#iModelBank)", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    await utils.deleteIModelByName(requestContext, assetId, testIModelName);

    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(assetId, Guid.createValue(), testIModelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(requestContext, assetId, testIModelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(testIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);

    mockGetIModelByName(assetId, testIModelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(requestContext, assetId, new IModelQuery().byName(testIModelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should create iModel with an extent from empty seed file", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    await utils.deleteIModelByName(requestContext, projectId, testIModelName);

    const description = "Test iModel created by imodeljs-clients tests";
    const extent = [1.1, 2.2, -3.3, -4.4];
    mockCreateEmptyiModel(projectId, Guid.createValue(), testIModelName, description, undefined, extent);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(requestContext, projectId, testIModelName, { description, progressCallback: progressTracker.track(), extent });

    chai.expect(imodel.name).to.be.equal(testIModelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    chai.expect(imodel.extent).to.be.eql(extent);
    progressTracker.check(false);

    mockGetIModelByName(projectId, testIModelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(testIModelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should filter iModels by type", async () => {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    mockGetIModelByType(projectId, testIModelName, imodelId, IModelType.Undefined);
    const iModelsWithUndefinedType = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byiModelType(IModelType.Undefined)));
    chai.expect(iModelsWithUndefinedType.some((x) => x.id === imodelId)).to.be.true;

    mockGetIModelByType(projectId, testIModelName, imodelId, IModelType.Library, false);
    let iModelsWithLibraryType = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byiModelType(IModelType.Library)));
    chai.expect(iModelsWithLibraryType.some((x) => x.id === imodelId)).to.be.false;

    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(projectId, imodelId, testIModelName, description, IModelType.Library);
    const iModel = await imodelClient.iModels.create(requestContext, projectId, testIModelName, { description, iModelType: IModelType.Library });

    mockGetIModelByType(projectId, testIModelName, imodelId, IModelType.Library, undefined);
    iModelsWithLibraryType = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byiModelType(IModelType.Library)));
    chai.expect(iModelsWithLibraryType.some((x) => x.id === iModel.id)).to.be.true;
  });

  it("should filter iModels by template", async function () {
    const testIModelName = utils.getUniqueIModelName(createIModelName);
    const emptyTemplate = "Empty";
    mockGetIModelByTemplate(projectId, testIModelName, imodelId, emptyTemplate);
    const iModelsWithEmptyTemplate = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byiModelTemplate(emptyTemplate)));
    chai.expect(iModelsWithEmptyTemplate.some((x) => x.id === imodelId)).to.be.true;

    const customTemplate = `${imodelId}:`;
    mockPostiModel(projectId, imodelId, testIModelName, "", customTemplate);
    mockGetSeedFile(imodelId);
    const clonediModel: HubIModel = await iModelClient.iModels.create(requestContext, projectId, testIModelName,
      { template: { imodelId }, timeOutInMilliseconds: TestConfig.initializeiModelTimeout });

    mockGetIModelByTemplate(projectId, testIModelName, imodelId, customTemplate);
    const iModelsWithCustomTemplate = (await iModelClient.iModels.get(requestContext, projectId, new IModelQuery().byiModelTemplate(customTemplate)));
    chai.expect(iModelsWithCustomTemplate.some((x) => x.id === clonediModel.id)).to.be.true;
  });

  it("should handle special characters in get by name query", async () => {
    const name = `Д - ${Guid.createValue()}`;
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyiModel(projectId, Guid.createValue(), name, description);
    await imodelClient.iModels.create(requestContext, projectId, name, { description });

    mockGetIModelByName(projectId, name);
    const iModels = await imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(name));
    chai.expect(iModels.length).to.be.equal(1);

    await utils.deleteIModelByName(requestContext, projectId, name);
  });
});
