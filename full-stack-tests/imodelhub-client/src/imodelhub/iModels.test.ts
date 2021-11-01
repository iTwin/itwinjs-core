/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import { AccessToken, Guid, GuidString, IModelHubStatus } from "@itwin/core-bentley";
import {
  HubIModel, IModelClient, IModelHubClient, IModelHubClientError, IModelHubError, IModelQuery, IModelType, InitializationState, SeedFile, WsgError,
} from "@bentley/imodelhub-client";
import { RequestGlobalOptions, RequestTimeoutOptions } from "@bentley/itwin-client";
import { TestUsers } from "@itwin/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";
import { assetsPath, workDir } from "./TestConstants";
import { createFileHandler } from "./FileHandler";

const defaultDataLocationId: GuidString = "99999999-9999-9999-9999-999999999999";

function mockGetIModelByName(iTwinId: string, name: string, description = "", imodelId?: GuidString, initialized = true, iModelType = IModelType.Undefined, extent: number[] = [], returnsInstances = true) {
  mockGetIModelWithFilter(`?$filter=Name+eq+%27${encodeURIComponent(name)}%27`, iTwinId, name, description, imodelId, initialized, "Empty", iModelType, extent, returnsInstances);
}

function mockGetIModelByType(iTwinId: string, name: string, imodelId: GuidString | undefined, iModelType: IModelType, returnsInstances = true) {
  mockGetIModelWithFilter(`?$filter=Type+eq+${iModelType}`, iTwinId, name, "", imodelId, true, "Empty", iModelType, [], returnsInstances);
}

function mockGetIModelByTemplate(iTwinId: string, name: string, imodelId: GuidString | undefined, template: string, returnsInstances = true) {
  mockGetIModelWithFilter(`?$filter=iModelTemplate+eq+%27${encodeURIComponent(template)}%27`, iTwinId, name, "", imodelId, true, template, IModelType.Undefined, [], returnsInstances);
}

function mockGetIModelWithFilter(
  query: string,
  iTwinId: string,
  name: string,
  description: string,
  imodelId: GuidString | undefined,
  initialized: boolean,
  template: string,
  iModelType: IModelType,
  extent: number[],
  returnsInstances: boolean) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();
  const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel", query);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
    new Map<string, any>([
      ["name", name],
      ["description", description],
      ["wsgId", imodelId.toString()],
      ["id", imodelId],
      ["initialized", initialized],
      ["iModelTemplate", template],
      ["iModelType", iModelType],
      ["extent", extent],
      ["dataLocationId", defaultDataLocationId],
    ])), returnsInstances ? 1 : 0);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetIModel(iTwinId: string, imodelName: string, imodelId: GuidString, imodelsCount?: number, description = "", extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();

  const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel", "?$orderby=CreatedDate+asc&$top=1");
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

function mockPostIModel(iTwinId: string, imodelId: GuidString, imodelName: string, description?: string, iModelTemplate?: string, iModelType?: IModelType, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel");
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

function mockCreateIModel(iTwinId: string, imodelId: GuidString, imodelName: string, description: string, filePath: string, chunks = 1, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  const fileId = Guid.createValue();
  mockPostIModel(iTwinId, imodelId, imodelName, description, undefined, undefined, extent);
  mockPostNewSeedFile(imodelId, fileId, filePath, description);
  utils.mockUploadFile(imodelId, chunks);
  mockPostUpdatedSeedFile(imodelId, fileId, filePath, description);
  mockGetSeedFile(imodelId);
}

function mockCreateEmptyIModel(iTwinId: string, imodelId: GuidString, imodelName: string, description: string, iModelType = IModelType.Undefined, extent?: number[]) {
  if (!TestConfig.enableMocks)
    return;

  mockPostIModel(iTwinId, imodelId, imodelName, description, "Empty", iModelType, extent);
}

function mockDeleteIModel(iTwinId: string, imodelId: GuidString) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId,
    "iModel", imodelId.toString());
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath);
}

function mockUpdateIModel(iTwinId: string, imodel: HubIModel) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel", imodel.wsgId);
  const postBody = ResponseBuilder.generatePostBody<HubIModel>(imodel);
  const requestResponse = ResponseBuilder.generatePostResponse<HubIModel>(imodel);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

describe("iModelHub iModelsHandler", () => {
  let iTwinId: string;
  let imodelId: GuidString;
  let iModelClient: IModelClient;
  const imodelName = utils.getUniqueIModelName(utils.sharedimodelName);
  const createimodelName = utils.getUniqueIModelName("imodeljs-client iModels Create test");
  const updatedimodelName = utils.getUniqueIModelName(`${imodelName}_updated`);
  const imodelNameWithSpecialChars = utils.getUniqueIModelName("Д");
  let imodelClient: IModelClient;
  let accessToken: AccessToken;
  let backupTimeout: RequestTimeoutOptions;

  before(async function () {
    backupTimeout = RequestGlobalOptions.timeout;
    RequestGlobalOptions.timeout = {
      deadline: 100000,
      response: 100000,
    };

    this.timeout(0);
    accessToken = TestConfig.enableMocks ? "" : await utils.login(TestUsers.super);

    iTwinId = await utils.getITwinId(accessToken);

    imodelClient = utils.getDefaultClient();

    await utils.createIModel(accessToken, utils.sharedimodelName, iTwinId);
    imodelId = await utils.getIModelId(accessToken, utils.sharedimodelName, iTwinId);
    iModelClient = utils.getDefaultClient();

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir);
    }
  });

  beforeEach(async () => {
    await utils.deleteIModelByName(accessToken, iTwinId, createimodelName, false);
  });

  afterEach(async () => {
    ResponseBuilder.clearMocks();
  });

  after(async () => {
    RequestGlobalOptions.timeout = backupTimeout;
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(accessToken, iTwinId, utils.sharedimodelName);
    }

    await utils.deleteIModelByName(accessToken, iTwinId, createimodelName, false);
    await utils.deleteIModelByName(accessToken, iTwinId, updatedimodelName, false);
    await utils.deleteIModelByName(accessToken, iTwinId, imodelNameWithSpecialChars, false);
  });

  it("should get list of IModels (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel");
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["name", imodelName]])));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
    }

    const imodels: HubIModel[] = await imodelClient.iModels.get(accessToken, iTwinId, undefined);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel (#iModelBank)", async () => {
    mockGetIModelByName(iTwinId, imodelName);
    const iModel: HubIModel = (await imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(iModel.name).to.be.equal(imodelName);
  });

  it("should be able to delete iModels (#unit)", async () => {
    // Used only for maintenance
    const names = ["22_LargePlant.166.i"];
    for (const name of names) {
      mockGetIModelByName(iTwinId, name);
      const iModel: HubIModel = (await imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(name)))[0];
      chai.expect(iModel.name).to.be.equal(name);
      mockDeleteIModel(iTwinId, iModel.id!);
      await imodelClient.iModels.delete(accessToken, iTwinId, iModel.id!);
    }
  });

  it("should retrieve an iModel by its id (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel", imodelId.toString());
      const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(ResponseBuilder.generateObject<HubIModel>(HubIModel,
        new Map<string, any>([["wsgId", imodelId]])));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
    }

    const iModel: HubIModel = (await imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byId(imodelId)))[0];

    chai.expect(iModel.id!).to.be.equal(imodelId);
  });

  it("should fail getting an invalid iModel (#iModelBank)", async () => {
    const mockGuid = Guid.createValue();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel", mockGuid);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, ResponseBuilder.generateError("InstanceNotFound"),
        1, undefined, undefined, 404);
    }

    let error: WsgError | undefined;
    try {
      await imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byId(mockGuid));
    } catch (err) {
      if (err instanceof WsgError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.name).to.be.equal("InstanceNotFound");
  });

  it("should fail getting an iModel without iTwinId (#iModelBank)", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await imodelClient.iModels.get(accessToken, "", new IModelQuery().byId(imodelId));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }

    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.UndefinedArgumentError);
  });

  it("should fail creating existing and initialized iModel (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel");
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", true]]));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, undefined, undefined, 409);
    }

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModels.create(accessToken, iTwinId, imodelName, { path: utils.getMockSeedFilePath(), description: "" });
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile", async () => {
    const filePath = `${assetsPath}LargerSeedFile.bim`;
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateIModel(iTwinId, Guid.createValue(), createimodelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();

    const iModel: HubIModel = await imodelClient.iModels.create(accessToken, iTwinId, createimodelName,
      { path: filePath, description, progressCallback: progressTracker.track(), timeOutInMilliseconds: TestConfig.initializeiModelTimeout });
    chai.assert(iModel);
    chai.expect(iModel.name).to.be.equal(createimodelName);
    chai.expect(iModel.initialized).to.be.equal(true);
    progressTracker.check();
  });

  it("should continue creating not initialized iModel (#unit)", async () => {
    const filePath = utils.getMockSeedFilePath();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.Context, iTwinId, "iModel");
      const postBody = ResponseBuilder.generatePostBody<HubIModel>(
        ResponseBuilder.generateObject<HubIModel>(HubIModel,
          new Map<string, any>([["name", imodelName]])));
      const requestResponse = ResponseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
        new Map<string, any>([["iModelInitialized", false]]));
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

      const fileId = Guid.createValue();
      mockGetIModelByName(iTwinId, imodelName, "", imodelId, false);
      mockPostNewSeedFile(imodelId, fileId, filePath, undefined);
      utils.mockUploadFile(imodelId, 1);
      mockPostUpdatedSeedFile(imodelId, fileId, filePath, undefined);
      mockGetSeedFile(imodelId);
    }

    const iModel = await imodelClient.iModels.create(accessToken, iTwinId, imodelName, { path: filePath, description: "" });

    chai.expect(iModel.id!.toString()).to.be.equal(imodelId!.toString());
    chai.expect(iModel.name).to.be.equal(imodelName);
    chai.expect(iModel.initialized).to.be.equal(true);
  });

  it("should download a Seed File (#iModelBank)", async () => {
    mockGetSeedFile(imodelId, true);
    const downloadToPathname: string = path.join(workDir, `${imodelId}.bim`);
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModels.download(accessToken, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should download a Seed File with Buffering (#iModelBank)", async () => {
    imodelClient.setFileHandler(createFileHandler(true));
    mockGetSeedFile(imodelId, true);
    const downloadToPathname: string = path.join(workDir, `${imodelId}.bim`);
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModels.download(accessToken, imodelId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.equal(true);

    imodelClient.setFileHandler(createFileHandler());
  });

  it("should fail downloading the Seed File with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient();
    try {
      await invalidClient.iModels.download(accessToken, imodelId, workDir);
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
      await invalidClient.iModels.create(accessToken, iTwinId, createimodelName, { path: workDir });
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
      await iModelClient.iModels.create(accessToken, iTwinId, createimodelName, { path: `${workDir}InvalidiModel.bim` });
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
      await iModelClient.iModels.create(accessToken, iTwinId, createimodelName, { path: workDir });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should fail creating an iModel with invalid size of extent (#iModelBank)", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.iModels.create(accessToken, iTwinId, createimodelName, { extent: [1] });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should fail creating an iModel with invalid coordinate of extent (#iModelBank)", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.iModels.create(accessToken, iTwinId, createimodelName, { extent: [1, -200, 3, 4] });
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should create iModel from another iModel", async () => {
    mockPostIModel(iTwinId, imodelId, createimodelName, "", `${imodelId}:`);
    mockGetSeedFile(imodelId);

    const imodel: HubIModel = await iModelClient.iModels.create(accessToken, iTwinId, createimodelName,
      { template: { imodelId }, timeOutInMilliseconds: TestConfig.initializeiModelTimeout });

    chai.assert(imodel);
    chai.assert(imodel.initialized);
    chai.expect(imodel.iModelTemplate).to.be.equal(`${imodelId}:`);
  });

  it("should create iModel from another iModel and ChangeSet (#unit)", async () => {
    const briefcase = (await utils.getBriefcases(accessToken, imodelId, 1))[0];
    const changeSet = utils.getMockChangeSets(briefcase)[0];
    mockPostIModel(iTwinId, imodelId, createimodelName, "", `${imodelId}:${changeSet.id}`);
    mockGetSeedFile(imodelId);

    const imodel = await iModelClient.iModels.create(accessToken, iTwinId, createimodelName, { template: { imodelId, changeSetId: changeSet.id } });
    chai.assert(imodel);
    chai.assert(imodel.initialized);
    chai.expect(imodel.iModelTemplate).to.be.equal(`${imodelId}:${changeSet.id}`);
  });

  it("should update iModel name and description (#iModelBank)", async () => {
    mockGetIModelByName(iTwinId, imodelName);
    const imodel: HubIModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(imodel.name).to.be.equal(imodelName);
    const oldName = imodel.name;
    const oldDescription = imodel.description;

    const newDescription = "Description_updated";
    await utils.deleteIModelByName(accessToken, iTwinId, updatedimodelName);
    imodel.name = updatedimodelName;
    imodel.description = newDescription;
    mockUpdateIModel(iTwinId, imodel);
    let updatediModel = await iModelClient.iModels.update(accessToken, iTwinId, imodel);

    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(updatedimodelName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);

    mockGetIModelByName(iTwinId, updatedimodelName, newDescription, imodel.id);
    updatediModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(updatedimodelName)))[0];

    chai.assert(!!updatediModel);
    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(updatedimodelName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);

    imodel.name = oldName;
    imodel.description = oldDescription;
    mockUpdateIModel(iTwinId, imodel);
    await iModelClient.iModels.update(accessToken, iTwinId, imodel);
  });

  it("should set and update iModel type correctly", async () => {
    mockGetIModelByName(iTwinId, imodelName);
    const imodel: HubIModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(imodel.iModelType).to.be.equal(IModelType.Undefined);

    imodel.iModelType = IModelType.Library;
    mockUpdateIModel(iTwinId, imodel);
    const updatediModel = await iModelClient.iModels.update(accessToken, iTwinId, imodel);
    chai.expect(updatediModel.iModelType).to.be.equal(IModelType.Library);

    updatediModel.description = "New description for test iModel created by imodeljs-clients tests";
    updatediModel.iModelType = undefined;
    mockUpdateIModel(iTwinId, updatediModel);
    await iModelClient.iModels.update(accessToken, iTwinId, updatediModel);

    mockGetIModelByName(iTwinId, imodelName, updatediModel.description, updatediModel.id, true, IModelType.Library);
    const queriediModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(queriediModel.iModelType).to.be.equal(IModelType.Library);
  });

  it("should get oldest IModel (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      mockGetIModel(iTwinId, imodelName, Guid.createValue(), 1);
    }

    const imodel = await imodelClient.iModel.get(accessToken, iTwinId);
    chai.assert(imodel);
  });

  it("should throw if no IModels returned (#iModelBank)", async () => {
    if (!TestConfig.enableMocks)
      return;

    mockGetIModel(iTwinId, imodelName, Guid.createValue(), 0);

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.get(accessToken, iTwinId);
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
    mockGetIModel(iTwinId, "22_LargePlant.166.i", imodelId, 1);
    mockDeleteIModel(iTwinId, imodelId);
    await imodelClient.iModel.delete(accessToken, iTwinId);
  });

  it("delete iModel should throw if iModel does not exist (#unit)", async () => {
    // Used only for maintenance
    mockGetIModel(iTwinId, "22_LargePlant.166.i", Guid.createValue(), 0);
    mockDeleteIModel(iTwinId, imodelId);

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.delete(accessToken, iTwinId);
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelDoesNotExist);
  });

  it("should return initialization status (#unit)", async () => {
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(iTwinId, "22_LargePlant.166.i", imodelId, 1);
    mockGetSeedFile(imodelId);

    const initializationState = await imodelClient.iModel.getInitializationState(accessToken, iTwinId);

    chai.expect(initializationState).to.be.equal(InitializationState.Successful);
  });

  it("should create iModel if iModel does not exist (#unit)", async () => {
    const filePath = `${assetsPath}LargerSeedFile.bim`;
    const description = "Test iModel created by imodeljs-clients tests";
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(iTwinId, createimodelName, imodelId, 0);
    mockCreateIModel(iTwinId, imodelId, createimodelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();
    const iModel = await imodelClient.iModel.create(accessToken, iTwinId, createimodelName, { path: filePath, description, progressCallback: progressTracker.track() });

    chai.expect(iModel.name).to.be.equal(createimodelName);
    chai.expect(iModel.initialized).to.be.equal(true);
    progressTracker.check();
  });

  it("should throw iModelAlreadyExists if iModel already exist (#iModelBank)", async () => {
    const filePath = `${assetsPath}LargerSeedFile.bim`;
    const description = "Test iModel created by imodeljs-clients tests";
    mockGetIModel(iTwinId, createimodelName, Guid.createValue(), 1);
    mockCreateIModel(iTwinId, Guid.createValue(), createimodelName, description, filePath, 2);
    const progressTracker = new utils.ProgressTracker();

    let error: IModelHubError | undefined;
    try {
      await imodelClient.iModel.create(accessToken, iTwinId, createimodelName, { path: filePath, description, progressCallback: progressTracker.track() });
    } catch (err) {
      if (err instanceof IModelHubError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.iModelAlreadyExists);
  });

  it("should create iModel from empty seed file (#iModelBank)", async () => {
    const description = "Test iModel created by imodeljs-clients tests";
    mockCreateEmptyIModel(iTwinId, Guid.createValue(), createimodelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(accessToken, iTwinId, createimodelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(createimodelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);

    mockGetIModelByName(iTwinId, createimodelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(createimodelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should create single iModel from empty seed file (#unit)", async () => {
    const description = "Test iModel created by imodeljs-clients tests";
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(iTwinId, createimodelName, imodelId, 0);
    mockCreateEmptyIModel(iTwinId, Guid.createValue(), createimodelName, description);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModel.create(accessToken, iTwinId, createimodelName, { description, progressCallback: progressTracker.track() });

    chai.expect(imodel.name).to.be.equal(createimodelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    progressTracker.check(false);
  });

  it("should update iModel extents (#iModelBank)", async () => {
    imodelId = imodelId || Guid.createValue();
    mockGetIModel(iTwinId, imodelName, imodelId, 1);
    const newName = `${imodelName}_updated`;
    const newDescription = "Description_updated";
    const newExtent = [1, 2, 3, 4];

    mockGetIModelByName(iTwinId, imodelName);
    const imodel: HubIModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    const oldimodelName = imodel.name;

    imodel.name = newName;
    imodel.description = newDescription;
    imodel.extent = newExtent;
    mockUpdateIModel(iTwinId, imodel);
    let updatediModel = await iModelClient.iModels.update(accessToken, iTwinId, imodel);

    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
    chai.expect(updatediModel.extent).to.be.eql(newExtent);

    mockGetIModelByName(iTwinId, newName, newDescription, imodel.id, true, undefined, newExtent);
    updatediModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(newName)))[0];

    chai.assert(!!updatediModel);
    chai.expect(updatediModel.wsgId).to.be.equal(imodel.wsgId);
    chai.expect(updatediModel.name).to.be.equal(newName);
    chai.expect(updatediModel.description).to.be.equal(newDescription);
    chai.expect(updatediModel.extent).to.be.eql(newExtent);

    imodel.name = oldimodelName;
    mockUpdateIModel(iTwinId, imodel);
    await iModelClient.iModels.update(accessToken, iTwinId, imodel);
  });

  // Inconsistently passes as integration test due to concurrency issues, temporarily make unit test
  it("should download a Seed File if iModel exist (#iModelBank #unit)", async () => {
    mockGetSeedFile(imodelId, true);
    mockGetIModel(iTwinId, imodelName, imodelId, 1);
    const downloadToPathname: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse();

    const progressTracker = new utils.ProgressTracker();
    await iModelClient.iModel.download(accessToken, iTwinId, downloadToPathname, progressTracker.track());
    progressTracker.check();
    fs.existsSync(downloadToPathname).should.be.true;
  });

  it("should create iModel with an extent from empty seed file (#iModelBank)", async () => {
    const description = "Test iModel created by imodeljs-clients tests";
    const extent = [1.1, 2.2, -3.3, -4.4];
    mockCreateEmptyIModel(iTwinId, Guid.createValue(), createimodelName, description, undefined, extent);
    const progressTracker = new utils.ProgressTracker();
    const imodel = await imodelClient.iModels.create(accessToken, iTwinId, createimodelName, { description, progressCallback: progressTracker.track(), extent });

    chai.expect(imodel.name).to.be.equal(createimodelName);
    chai.expect(imodel.initialized).to.be.equal(true);
    chai.expect(imodel.extent).to.be.eql(extent);
    progressTracker.check(false);

    mockGetIModelByName(iTwinId, createimodelName, description, imodel.id);
    const getiModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(createimodelName)))[0];
    chai.assert(!!getiModel);
    chai.expect(getiModel.wsgId).to.be.equal(imodel.id!);
  });

  it("should filter iModels by type", async () => {
    mockGetIModelByName(iTwinId, imodelName);
    let imodel: HubIModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];

    imodel.iModelType = IModelType.Undefined;
    mockUpdateIModel(iTwinId, imodel);
    imodel = await iModelClient.iModels.update(accessToken, iTwinId, imodel);
    chai.expect(imodel.iModelType).to.be.equal(IModelType.Undefined);

    mockGetIModelByType(iTwinId, imodelName, imodelId, IModelType.Undefined);
    const iModelsWithUndefinedType = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byiModelType(IModelType.Undefined)));
    chai.expect(iModelsWithUndefinedType.some((x) => x.id === imodelId)).to.be.true;

    mockGetIModelByType(iTwinId, imodelName, imodelId, IModelType.Library, false);
    let iModelsWithLibraryType = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byiModelType(IModelType.Library)));
    chai.expect(iModelsWithLibraryType.some((x) => x.id === imodelId)).to.be.false;

    imodel.iModelType = IModelType.Library;
    mockUpdateIModel(iTwinId, imodel);
    imodel = await iModelClient.iModels.update(accessToken, iTwinId, imodel);
    chai.expect(imodel.iModelType).to.be.equal(IModelType.Library);

    mockGetIModelByType(iTwinId, imodelName, imodelId, IModelType.Library);
    iModelsWithLibraryType = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byiModelType(IModelType.Library)));
    chai.expect(iModelsWithLibraryType.some((x) => x.id === imodelId)).to.be.true;
  });

  it("should filter iModels by template", async () => {
    const emptyTemplate = "Empty";
    mockGetIModelByTemplate(iTwinId, createimodelName, imodelId, emptyTemplate);
    const iModelsWithEmptyTemplate = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byiModelTemplate(emptyTemplate)));
    chai.expect(iModelsWithEmptyTemplate.some((x) => x.id === imodelId)).to.be.true;

    const customTemplate = `${imodelId}:`;
    mockPostIModel(iTwinId, imodelId, createimodelName, "", customTemplate);
    mockGetSeedFile(imodelId);
    const clonediModel: HubIModel = await iModelClient.iModels.create(accessToken, iTwinId, createimodelName,
      { template: { imodelId }, timeOutInMilliseconds: TestConfig.initializeiModelTimeout });

    mockGetIModelByTemplate(iTwinId, createimodelName, imodelId, customTemplate);
    const iModelsWithCustomTemplate = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byiModelTemplate(customTemplate)));
    chai.expect(iModelsWithCustomTemplate.some((x) => x.id === clonediModel.id)).to.be.true;
  });

  it("should handle special characters in get by name query", async () => {
    mockGetIModelByName(iTwinId, imodelName);
    let imodel: HubIModel = (await iModelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    const oldimodelName = imodel.name;

    imodel.name = imodelNameWithSpecialChars;
    mockUpdateIModel(iTwinId, imodel);
    imodel = await iModelClient.iModels.update(accessToken, iTwinId, imodel);

    mockGetIModelByName(iTwinId, imodelNameWithSpecialChars);
    const iModels = await imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelNameWithSpecialChars));
    chai.expect(iModels.length).to.be.equal(1);

    imodel.name = oldimodelName;
    mockUpdateIModel(iTwinId, imodel);
    await iModelClient.iModels.update(accessToken, iTwinId, imodel);
  });

  it("should return DataLocationId", async () => {
    mockGetIModelByName(iTwinId, imodelName);
    const iModel: HubIModel = (await imodelClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(imodelName)))[0];
    chai.expect(iModel.dataLocationId).to.be.equal(defaultDataLocationId);
  });
});
