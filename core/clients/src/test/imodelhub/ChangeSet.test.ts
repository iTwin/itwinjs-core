/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import * as deepAssign from "deep-assign";

import { TestConfig } from "../TestConfig";

import { AccessToken } from "../../";
import {
  IModelHubClient, Briefcase, ChangeSet, ChangeSetQuery, IModelHubRequestError, IModelHubRequestErrorId,
} from "../../imodelhub";

import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

chai.should();

describe("iModelHub ChangeSetHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let briefcase: Briefcase;
  const imodelName = "imodeljs-clients ChangeSets test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();

  before(async () => {
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    if (!TestConfig.enableMocks) {
      const changeSetCount = (await imodelHubClient.ChangeSets().get(accessToken, iModelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can't create any new changesets
        await utils.createIModel(accessToken, imodelName, undefined, true);
        iModelId = await utils.getIModelId(accessToken, imodelName);
      }
    }
    briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];

    // Ensure that at least two exist
    await utils.createChangeSets(accessToken, iModelId, briefcase, 0, 2);

    if (!TestConfig.enableMocks) {
      const changesets = (await imodelHubClient.ChangeSets().get(accessToken, iModelId));
      // Ensure that at least one lock exists
      await utils.createLocks(accessToken, iModelId, briefcase, 1, 2, 2, changesets[0].id, changesets[0].string);
    }

    if (!fs.existsSync(utils.workDir)) {
      fs.mkdirSync(utils.workDir);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  function mockPostNewChangeSet(imodelId: string, changeSet: ChangeSet) {
    const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet");

    const postBody = ResponseBuilder.generatePostBody(changeSet);

    const cs = new ChangeSet();
    deepAssign(cs, changeSet);
    cs.wsgId = cs.id!;
    cs.uploadUrl = `${utils.defaultUrl}/imodelhub-${imodelId}/123456`;
    const requestResponse = ResponseBuilder.generatePostResponse(cs);

    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
  }

  function mockPostUpdatedChangeSet(imodelId: string, changeSet: ChangeSet) {
    const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet", changeSet.id!);

    const cs = new ChangeSet();
    deepAssign(cs, changeSet);
    cs.isUploaded = true;
    cs.wsgId = changeSet.id!;
    const postBody = ResponseBuilder.generatePostBody(cs);

    const requestResponse = ResponseBuilder.generatePostResponse(cs);

    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
  }

  function mockCreateChangeSet(imodelId: string, changeSet: ChangeSet) {
    if (!TestConfig.enableMocks)
      return;

    mockPostNewChangeSet(imodelId, changeSet);
    utils.mockUploadFile(imodelId, 1);
    mockPostUpdatedChangeSet(imodelId, changeSet);
  }

  it("should create a new ChangeSet", async function (this: Mocha.ITestCallbackContext) {
    const mockChangeSets = utils.getMockChangeSets(briefcase);

    utils.mockGetChangeSet(iModelId, false, undefined, mockChangeSets[0], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId);

    const index = changeSets.length;
    const filePath = utils.getMockChangeSetPath(index, mockChangeSets[index].id!);

    mockCreateChangeSet(iModelId, mockChangeSets[2]);
    const progressTracker = new utils.ProgressTracker();
    const newChangeSet = await imodelHubClient.ChangeSets().create(accessToken, iModelId, mockChangeSets[index], filePath, progressTracker.track());

    chai.assert(newChangeSet);
    progressTracker.check();
  });

  it("should get information on ChangeSets", async () => {
    const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
    utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(1);

    let i = 0;
    for (const changeSet of changeSets) {
      utils.mockGetChangeSet(iModelId, false, changeSet.wsgId, mockedChangeSets[i++]);

      const fileName: string = changeSet.fileName!;
      chai.expect(fileName.length).to.be.greaterThan(0);

      const downloadUrl: string = changeSet.downloadUrl!;
      chai.assert(downloadUrl.startsWith("https://"));

      const changeSet2: ChangeSet = (await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSet.wsgId)))[0];

      chai.expect(changeSet.wsgId).to.be.equal(changeSet2.wsgId);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
    }

    const lastButOneChangeSet = changeSets[changeSets.length - 2];
    const lastButOneId = lastButOneChangeSet.id || lastButOneChangeSet.wsgId;
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=FollowingChangeSet-backward-ChangeSet.Id+eq+%27${lastButOneId}%27`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, ResponseBuilder.generateGetResponse(mockedChangeSets[changeSets.length - 2]));
    }
    const followingChangeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().fromId(lastButOneId));
    chai.expect(followingChangeSets.length).to.be.equal(1);
  });

  it("should download ChangeSets", async () => {
    utils.mockGetChangeSet(iModelId, true, undefined, utils.generateChangeSet(), utils.generateChangeSet());
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());

    const downloadChangeSetsToPath: string = path.join(utils.workDir, iModelId);

    utils.mockFileResponse(2);
    const progressTracker = new utils.ProgressTracker();
    await imodelHubClient.ChangeSets().download(changeSets, downloadChangeSetsToPath, progressTracker.track());
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    progressTracker.check();
    for (const changeSet of changeSets) {
      const fileName: string = changeSet.fileName!;
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, fileName);

      fs.existsSync(downloadedPathname).should.be.equal(true);
    }
  });

  it("should get ChangeSets skipping the first one", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(iModelId, false, "?$skip=1", mockChangeSets[2]);
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().skip(1));
    chai.assert(changeSets);
    chai.expect(parseInt(changeSets[0].index!, 10)).to.be.greaterThan(1);
  });

  it("should get latest ChangeSets", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(iModelId, false, "?$orderby=Index+desc&$top=2", mockChangeSets[2], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().latest().top(2));
    chai.assert(changeSets);
    chai.expect(changeSets.length).to.be.equal(2);
    chai.expect(parseInt(changeSets[0].index!, 10)).to.be.greaterThan(parseInt(changeSets[1].index!, 10));
    utils.mockGetChangeSet(iModelId, false, "?$orderby=Index+desc&$top=2", mockChangeSets[2], mockChangeSets[1]);

    const changeSets2: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().orderBy("Index+desc").top(2));
    chai.assert(changeSets);
    chai.expect(changeSets).to.be.deep.equal(changeSets2);
  });

  it("should fail getting a ChangeSet by invalid id", async () => {
    let error: IModelHubRequestError | undefined;
    try {
      await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId("InvalidId"));
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id).to.be.equal(IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should fail downloading ChangeSets with no file handler", async () => {
    let error: IModelHubRequestError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.ChangeSets().download([], utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id).to.be.equal(IModelHubRequestErrorId.FileHandlerNotSet);
  });

  it("should fail downloading ChangeSets with no file url", async () => {
    let error: IModelHubRequestError | undefined;
    try {
      await imodelHubClient.ChangeSets().download([new ChangeSet()], utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id).to.be.equal(IModelHubRequestErrorId.MissingDownloadUrlError);
  });

  it("should fail creating a ChangeSet with no file handler", async () => {
    let error: IModelHubRequestError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.ChangeSets().create(accessToken, iModelId, new ChangeSet(), utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id).to.be.equal(IModelHubRequestErrorId.FileHandlerNotSet);
  });

  it("should fail creating a ChangeSet with no file", async () => {
    let error: IModelHubRequestError | undefined;
    try {
      await imodelHubClient.ChangeSets().create(accessToken, iModelId, new ChangeSet(), utils.workDir + "InvalidChangeSet.cs");
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id).to.be.equal(IModelHubRequestErrorId.FileNotFound);
  });

  it("should fail creating a ChangeSet with directory path", async () => {
    let error: IModelHubRequestError | undefined;
    try {
      await imodelHubClient.ChangeSets().create(accessToken, iModelId, new ChangeSet(), utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id).to.be.equal(IModelHubRequestErrorId.FileNotFound);
  });
});
