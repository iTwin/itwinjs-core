/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as deepAssign from "deep-assign";
import * as fs from "fs";
import * as path from "path";
import { GuidString, IModelHubStatus } from "@bentley/bentleyjs-core";
import { Briefcase, ChangeSet, ChangeSetQuery, IModelClient, IModelHubClient, IModelHubClientError, Version } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";
import { workDir } from "./TestConstants";
import { createFileHandler } from "./FileHandler";

chai.should();

function mockPostNewChangeSet(imodelId: GuidString, changeSet: ChangeSet) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet");

  const postBody = ResponseBuilder.generatePostBody(changeSet);

  const cs = new ChangeSet();
  deepAssign(cs, changeSet);
  cs.id! = cs.id!;
  cs.uploadUrl = `${utils.IModelHubUrlMock.getUrl()}/imodelhub-${imodelId}/123456`;
  const requestResponse = ResponseBuilder.generatePostResponse(cs);

  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockPostUpdatedChangeSet(imodelId: GuidString, changeSet: ChangeSet) {
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet", changeSet.id);

  const cs = new ChangeSet();
  deepAssign(cs, changeSet);
  cs.isUploaded = true;
  cs.id! = changeSet.id!;
  const postBody = ResponseBuilder.generatePostBody(cs);

  const requestResponse = ResponseBuilder.generatePostResponse(cs);

  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockCreateChangeSet(imodelId: GuidString, changeSet: ChangeSet) {
  if (!TestConfig.enableMocks)
    return;

  mockPostNewChangeSet(imodelId, changeSet);
  utils.mockUploadFile(imodelId, 1);
  mockPostUpdatedChangeSet(imodelId, changeSet);
}

describe("iModelHub ChangeSetHandler", () => {
  let contextId: string;
  let imodelId: GuidString;
  let iModelClient: IModelClient;
  let briefcase: Briefcase;
  let requestContext: AuthorizedClientRequestContext;
  const maxChangeSetCount = 17;
  const newChangeSetsPerTestSuit = 2; // update this value when adding new tests which create changesets

  const cumulativeChangeSetBackwardVersionId = "CumulativeChangeSet-backward-Version.Id";
  const cumulativeChangeSetBackwardChangeSetId = "CumulativeChangeSet-backward-ChangeSet.Id";
  const followingChangeSetBackwardVersionId = "FollowingChangeSet-backward-Version.Id";
  const followingChangesetBackwardChangesetId = "FollowingChangeSet-backward-ChangeSet.Id";

  before(async function () {
    this.timeout(0);
    const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext(accessToken);
    (requestContext as any).activityId = "iModelHub ChangeSetHandler";

    contextId = await utils.getProjectId(requestContext);
    await utils.createIModel(requestContext, utils.sharedimodelName, contextId);
    imodelId = await utils.getIModelId(requestContext, utils.sharedimodelName, contextId);
    iModelClient = utils.getDefaultClient();
    if (!TestConfig.enableMocks) {
      const changeSetCount = (await iModelClient.changeSets.get(requestContext, imodelId)).length;
      if (changeSetCount + newChangeSetsPerTestSuit >= maxChangeSetCount) {
        // Recreate iModel if can not create any new changesets
        await utils.createIModel(requestContext, utils.sharedimodelName, contextId, true);
        imodelId = await utils.getIModelId(requestContext, utils.sharedimodelName, contextId);
      }
    }
    briefcase = (await utils.getBriefcases(requestContext, imodelId, 1))[0];

    // Ensure that at least 3 exist
    await utils.createChangeSets(requestContext, imodelId, briefcase, 0, 3, true);

    if (!TestConfig.enableMocks) {
      const changesets = (await iModelClient.changeSets.get(requestContext, imodelId));
      // Ensure that at least one lock exists
      await utils.createLocks(requestContext, imodelId, briefcase, 1, 2, 2, changesets[0].id, changesets[0].index);

      // Create named versions
      await utils.createVersions(requestContext, imodelId, [changesets[0].id!, changesets[1].id!, changesets[2].id!],
        ["Version 1", "Version 2", "Version 3"]);
    }

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir);
    }
  });

  after(async () => {
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(requestContext, contextId, utils.sharedimodelName);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should create a new ChangeSet (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);

    utils.mockGetChangeSet(imodelId, false, `?$top=${ChangeSetQuery.defaultPageSize}`, mockChangeSets[0], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId);

    const index = changeSets.length;
    const filePath = utils.getMockChangeSetPath(index, mockChangeSets[index].id!);

    mockCreateChangeSet(imodelId, mockChangeSets[2]);
    const progressTracker = new utils.ProgressTracker();
    const newChangeSet = await iModelClient.changeSets.create(requestContext, imodelId, mockChangeSets[index], filePath, progressTracker.track());

    chai.assert(newChangeSet);
    progressTracker.check();
  });

  it("should get information on ChangeSets (#iModelBank)", async () => {
    const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
    utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(1);

    let i = 0;
    for (const changeSet of changeSets) {
      utils.mockGetChangeSet(imodelId, false, changeSet.id, mockedChangeSets[i++]);

      const fileName: string = changeSet.fileName!;
      chai.expect(fileName.length).to.be.greaterThan(0);

      utils.expectMatchesExpectedUrlScheme(changeSet.downloadUrl);

      const changeSet2: ChangeSet = (await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().byId(changeSet.id!)))[0];

      chai.expect(changeSet.id!).to.be.equal(changeSet2.id!);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
    }

    const lastButOneChangeSet = changeSets[changeSets.length - 2];
    const lastButOneId = lastButOneChangeSet.id || lastButOneChangeSet.id!;
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${followingChangesetBackwardChangesetId}+eq+%27${lastButOneId}%27&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, ResponseBuilder.generateGetResponse(mockedChangeSets[changeSets.length - 2]));
    }
    const followingChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().fromId(lastButOneId));
    chai.expect(followingChangeSets.length).to.be.equal(1);
  });

  it("should download ChangeSets (#iModelBank)", async () => {
    utils.mockGetChangeSet(imodelId, false, `?$select=FileSize&$top=${ChangeSetQuery.defaultPageSize}`, utils.generateChangeSet(), utils.generateChangeSet());
    utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, utils.generateChangeSet(), utils.generateChangeSet());
    const downloadChangeSetsToPath: string = path.join(workDir, imodelId.toString());

    utils.mockFileResponse(2);
    const progressTracker = new utils.ProgressTracker();
    const changeSets = await iModelClient.changeSets.download(requestContext, imodelId, new ChangeSetQuery(), downloadChangeSetsToPath, progressTracker.track());
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    progressTracker.check();
    for (const changeSet of changeSets) {
      const fileName: string = changeSet.fileName!;
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, fileName);

      fs.existsSync(downloadedPathname).should.be.equal(true);
    }
  });

  it("should download ChangeSets with Buffering (#iModelBank)", async () => {
    iModelClient.setFileHandler(createFileHandler(true));
    utils.mockGetChangeSet(imodelId, false, `?$select=FileSize&$top=${ChangeSetQuery.defaultPageSize}`, utils.generateChangeSet(), utils.generateChangeSet());
    utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, utils.generateChangeSet(), utils.generateChangeSet());
    const downloadChangeSetsToPath: string = path.join(workDir, imodelId.toString());

    utils.mockFileResponse(2);
    const progressTracker = new utils.ProgressTracker();
    const changeSets = await iModelClient.changeSets.download(requestContext, imodelId, new ChangeSetQuery(), downloadChangeSetsToPath, progressTracker.track());
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    progressTracker.check();
    for (const changeSet of changeSets) {
      const fileName: string = changeSet.fileName!;
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, fileName);

      fs.existsSync(downloadedPathname).should.be.equal(true);
    }

    iModelClient.setFileHandler(createFileHandler());
  });

  it("should download correct number of ChangeSets when top is less than pageSize (#iModelBank)", async () => {
    iModelClient.setFileHandler(createFileHandler(true));
    utils.mockGetChangeSet(imodelId, false, `?$select=FileSize&$top=1`, utils.generateChangeSet());
    utils.mockGetChangeSet(imodelId, true, `&$top=1`, utils.generateChangeSet());

    const downloadChangeSetsToPath: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse(1);

    const progressTracker = new utils.ProgressTracker();
    const changeSets = await iModelClient.changeSets.download(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl().top(1).pageSize(2), downloadChangeSetsToPath, progressTracker.track());
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    progressTracker.check();

    chai.expect(changeSets.length).to.be.equal(1);
    const downloadedPathname: string = path.join(downloadChangeSetsToPath, changeSets[0].fileName!);
    fs.existsSync(downloadedPathname).should.be.equal(true);

    iModelClient.setFileHandler(createFileHandler());
  });

  it("should download correct number of ChangeSets when top is greater than pageSize (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    iModelClient.setFileHandler(createFileHandler(true));

    const token = "1";
    utils.mockGetChangeSetChunk(imodelId, false, `?$select=FileSize&$top=1`, { skiptoken: token }, mockChangeSets[0]);
    utils.mockGetChangeSetChunk(imodelId, false, `?$select=FileSize&$top=1`, undefined, mockChangeSets[1]);
    utils.mockGetChangeSetChunk(imodelId, true, `&$top=1`, { skiptoken: token }, mockChangeSets[0]);
    utils.mockGetChangeSetChunk(imodelId, true, `&$top=1`, undefined, mockChangeSets[1]);

    const downloadChangeSetsToPath: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse(2);

    const progressTracker = new utils.ProgressTracker();
    const changeSets = await iModelClient.changeSets.download(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl().top(2).pageSize(1), downloadChangeSetsToPath, progressTracker.track());
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    progressTracker.check();

    chai.expect(changeSets.length).to.be.equal(2);
    let i = 0;
    for (const changeSet of changeSets) {
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, changeSet.fileName!);
      fs.existsSync(downloadedPathname).should.be.equal(true);

      utils.mockGetChangeSet(imodelId, false, changeSet.id, mockChangeSets[i]);
      const changeSet2: ChangeSet = (await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().byId(changeSet.id!)))[0];

      chai.expect(changeSet.id!).to.be.equal(changeSet2.id!);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
      i++;
    }

    iModelClient.setFileHandler(createFileHandler());
  });

  it("should download correct number of ChangeSets when top is equal to pageSize (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    iModelClient.setFileHandler(createFileHandler(true));

    utils.mockGetChangeSet(imodelId, false, `?$select=FileSize&$top=2`, mockChangeSets[0], mockChangeSets[1]);
    utils.mockGetChangeSet(imodelId, true, `&$top=2`, mockChangeSets[0], mockChangeSets[1]);

    const downloadChangeSetsToPath: string = path.join(workDir, imodelId.toString());
    utils.mockFileResponse(2);

    const progressTracker = new utils.ProgressTracker();
    const changeSets = await iModelClient.changeSets.download(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl().top(2).pageSize(2), downloadChangeSetsToPath, progressTracker.track());
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    progressTracker.check();

    chai.expect(changeSets.length).to.be.equal(2);
    let i = 0;
    for (const changeSet of changeSets) {
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, changeSet.fileName!);
      fs.existsSync(downloadedPathname).should.be.equal(true);

      utils.mockGetChangeSet(imodelId, false, changeSet.id, mockChangeSets[i]);
      const changeSet2: ChangeSet = (await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().byId(changeSet.id!)))[0];

      chai.expect(changeSet.id!).to.be.equal(changeSet2.id!);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
      i++;
    }

    iModelClient.setFileHandler(createFileHandler());
  });

  it("should get ChangeSets skipping the first one (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(imodelId, false, `?$skip=1&$top=${ChangeSetQuery.defaultPageSize}`, mockChangeSets[2]);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().skip(1));
    chai.assert(changeSets);
    chai.expect(parseInt(changeSets[0].index!, 10)).to.be.greaterThan(1);
  });

  it("should get latest ChangeSets (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(imodelId, false, "?$orderby=Index+desc&$top=2", mockChangeSets[2], mockChangeSets[1]);
    const changeSets: ChangeSet[] = utils.removeFileUrlExpirationTimes(await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().latest().top(2)));
    chai.assert(changeSets);
    chai.expect(changeSets.length).to.be.equal(2);
    chai.expect(parseInt(changeSets[0].index!, 10)).to.be.greaterThan(parseInt(changeSets[1].index!, 10));
    utils.mockGetChangeSet(imodelId, false, "?$orderby=Index+desc&$top=2", mockChangeSets[2], mockChangeSets[1]);

    const changeSets2: ChangeSet[] = utils.removeFileUrlExpirationTimes(await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().orderBy("Index+desc").top(2)));
    chai.assert(changeSets);
    chai.expect(changeSets).to.be.deep.equal(changeSets2);
  });

  it("should get all ChangeSets in chunks (#iModelBank)", async () => {
    const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
    utils.mockGetChangeSet(imodelId, false, "?$top=1", ...mockedChangeSets);
    const changeSets: ChangeSet[] = utils.removeFileUrlExpirationTimes(await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().pageSize(1)));
    chai.expect(changeSets.length).to.be.greaterThan(2);

    utils.mockGetChangeSet(imodelId, false, "?$top=3", ...mockedChangeSets);
    const changeSets2: ChangeSet[] = utils.removeFileUrlExpirationTimes(await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().pageSize(3)));
    chai.expect(changeSets).to.be.deep.equal(changeSets2);

    utils.mockGetChangeSet(imodelId, false, "?$top=7", ...mockedChangeSets);
    const changeSets3: ChangeSet[] = utils.removeFileUrlExpirationTimes(await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().pageSize(7)));
    chai.expect(changeSets).to.be.deep.equal(changeSets3);

    utils.mockGetChangeSet(imodelId, true, "&$top=2", ...mockedChangeSets);
    const changeSets4: ChangeSet[] = utils.removeFileUrlExpirationTimes(await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl().pageSize(2)));
    chai.expect(changeSets.length).to.be.equal(changeSets4.length);

    let i = 0;
    for (const changeSet of changeSets4) {
      utils.mockGetChangeSet(imodelId, false, changeSet.id, mockedChangeSets[i++]);

      const fileName: string = changeSet.fileName!;
      chai.expect(fileName.length).to.be.greaterThan(0);

      utils.expectMatchesExpectedUrlScheme(changeSet.downloadUrl);

      const changeSet2: ChangeSet = (await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().byId(changeSet.id!)))[0];

      chai.expect(changeSet.id!).to.be.equal(changeSet2.id!);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
    }
  });

  it("should get correct number of ChangeSets when top is less than pageSize (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(imodelId, false, "?$top=1", mockChangeSets[0]);
    const changeSets2: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().top(1).pageSize(2));
    chai.assert(changeSets2);
    chai.expect(changeSets2.length).to.be.equal(1);
  });

  it("should get correct number of ChangeSets when top is greater than pageSize (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(imodelId, false, "?$top=1", mockChangeSets[0], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().top(2).pageSize(1));
    chai.assert(changeSets);
    chai.expect(changeSets.length).to.be.equal(2);
    chai.expect(parseInt(changeSets[1].index!, 10)).to.be.greaterThan(parseInt(changeSets[0].index!, 10));
  });

  it("should get correct number of ChangeSets when top is equal to pageSize (#iModelBank)", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(imodelId, false, "?$top=2", mockChangeSets[0], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().top(2).pageSize(2));
    chai.assert(changeSets);
    chai.expect(changeSets.length).to.be.equal(2);
    chai.expect(parseInt(changeSets[1].index!, 10)).to.be.greaterThan(parseInt(changeSets[0].index!, 10));
  });

  it("should fail getting a ChangeSet by invalid id", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().byId("InvalidId"));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should fail downloading ChangeSets with no file handler", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(imodelId, false, `?$select=FileSize&$orderby=Index+desc&$top=1`, mockChangeSets[2]);
    utils.mockGetChangeSet(imodelId, true, "&$orderby=Index+desc&$top=1", mockChangeSets[2]);

    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient();
    try {
      const query = new ChangeSetQuery().selectDownloadUrl().latest().top(1);
      await invalidClient.changeSets.download(requestContext, imodelId, query, workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail creating a ChangeSet with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient();
    try {
      await invalidClient.changeSets.create(requestContext, imodelId, new ChangeSet(), workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail creating a ChangeSet with no file", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.changeSets.create(requestContext, imodelId, new ChangeSet(), `${workDir}InvalidChangeSet.cs`);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should fail creating a ChangeSet with directory path", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.changeSets.create(requestContext, imodelId, new ChangeSet(), workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should query between changesets (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

      let filter = `(${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[0].id}%27`;
      filter += `+and+${followingChangesetBackwardChangesetId}+eq+%27${mockedChangeSets[2].id}%27)`;
      filter += `+or+(${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[2].id}%27`;
      filter += `+and+${followingChangesetBackwardChangesetId}+eq+%27${mockedChangeSets[0].id}%27)`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${filter}&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[1], mockedChangeSets[2]]));
    }
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId,
      new ChangeSetQuery().betweenChangeSets(changeSets[0].id!, changeSets[2].id));
    chai.expect(selectedChangeSets.length).to.be.equal(2);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[1].id).to.be.equal(changeSets[2].id);
  });

  it("should query between changeset (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

      const filter = `${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[2].id}%27`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${filter}&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[0], mockedChangeSets[1], mockedChangeSets[2]]));
    }
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId,
      new ChangeSetQuery().betweenChangeSets(changeSets[2].id!));
    chai.expect(selectedChangeSets.length).to.be.equal(3);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[0].id);
    chai.expect(selectedChangeSets[1].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[2].id).to.be.equal(changeSets[2].id);
  });

  it("should get version changesets (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const mockedVersion = utils.generateVersion();
      utils.mockGetVersions(imodelId, undefined, mockedVersion);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

      const filter = `${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersion.id!}%27`;
      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${filter}&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath,
        ResponseBuilder.generateGetResponse(mockedChangeSets[0]));
    }

    const versions: Version[] = await iModelClient.versions.get(requestContext, imodelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(0);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId,
      new ChangeSetQuery().getVersionChangeSets(versions[versions.length - 1].id!));
    chai.expect(selectedChangeSets.length).to.be.equal(1);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[0].id);
  });

  it("should get changesets after version (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const mockedVersion = Array(3).fill(0).map(() => utils.generateVersion());
      utils.mockGetVersions(imodelId, undefined, ...mockedVersion);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

      const filter = `${followingChangeSetBackwardVersionId}+eq+%27${mockedVersion[1].id!}%27`;
      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${filter}&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[2], mockedChangeSets[1]]));
    }

    const versions: Version[] = await iModelClient.versions.get(requestContext, imodelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(1);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId,
      new ChangeSetQuery().afterVersion(versions[versions.length - 2].id!));
    chai.expect(selectedChangeSets.length).to.be.greaterThan(1);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[2].id);
  });

  it("should query changesets between versions (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
      utils.mockGetVersions(imodelId, undefined, ...mockedVersions);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

      let filter = `(${followingChangeSetBackwardVersionId}+eq+%27${mockedVersions[0].id!}%27`;
      filter += `+and+${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersions[2].id!}%27)`;
      filter += `+or+(${followingChangeSetBackwardVersionId}+eq+%27${mockedVersions[2].id!}%27`;
      filter += `+and+${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersions[0].id!}%27)`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${filter}&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[1], mockedChangeSets[2]]));
    }

    const versions: Version[] = await iModelClient.versions.get(requestContext, imodelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(1);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId,
      new ChangeSetQuery().betweenVersions(versions[0].id!, versions[2].id!));
    chai.expect(selectedChangeSets.length).to.be.equal(2);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[1].id).to.be.equal(changeSets[2].id);
  });

  it("should query changesets between version and changeset (#iModelBank)", async () => {
    if (TestConfig.enableMocks) {
      const mockedVersion = utils.generateVersion();
      utils.mockGetVersions(imodelId, undefined, mockedVersion);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(imodelId, true, `&$top=${ChangeSetQuery.defaultPageSize}`, ...mockedChangeSets);

      let filter = `(${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersion.id!}%27+and+`;
      filter += `${followingChangesetBackwardChangesetId}+eq+%27${mockedChangeSets[1].id}%27)`;
      filter += `+or+`;
      filter += `(${followingChangeSetBackwardVersionId}+eq+%27${mockedVersion.id!}%27+and+`;
      filter += `${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[1].id}%27)`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet",
        `?$filter=${filter}&$top=${ChangeSetQuery.defaultPageSize}`);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath,
        ResponseBuilder.generateGetResponse(mockedChangeSets[1]));
    }

    const versions: Version[] = await iModelClient.versions.get(requestContext, imodelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(0);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId,
      new ChangeSetQuery().betweenVersionAndChangeSet(versions[versions.length - 1].id!, changeSets[1].id!));
    chai.expect(selectedChangeSets.length).to.be.equal(1);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[1].id);
  });

  it("should query changesets application data", async () => {
    if (TestConfig.enableMocks) {
      const mockedChangeSet = utils.getMockChangeSets(briefcase)[0];
      mockedChangeSet.applicationId = "testApplicationId";
      mockedChangeSet.applicationName = "testApplicationName";
      const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "ChangeSet",
        `?$select=*,CreatedByApplication-forward-Application.*&$top=1000`);
      const requestResponse = ResponseBuilder.generateGetArrayResponse<ChangeSet>([mockedChangeSet]);
      ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
    }
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectApplicationData());
    chai.expect(changeSets.length).to.be.greaterThan(0);

    if (TestConfig.enableMocks) {
      chai.assert(changeSets[0].applicationId);
      chai.expect(changeSets[0].applicationId).equals("testApplicationId");
      chai.assert(changeSets[0].applicationName);
      chai.expect(changeSets[0].applicationName).equals("testApplicationName");
    }
  });

  it("should query ChangeSet bridge properties", async () => {
    if (TestConfig.enableMocks) {
      const mockedChangeSets = utils.getMockChangeSets(briefcase);
      mockedChangeSets.forEach((changeSet: ChangeSet, i: number) => {
        const generatedBridgeProperties = utils.generateBridgeProperties(i + 1, i * 2 + 1);
        changeSet.bridgeJobId = generatedBridgeProperties.jobId;
        changeSet.bridgeUsers = Array.from(generatedBridgeProperties.users!.values());
        changeSet.bridgeChangedFiles = Array.from(generatedBridgeProperties.changedFiles!.values());
      });
      utils.mockGetChangeSet(imodelId, false, `?$select=*,HasBridgeProperties-forward-BridgeProperties.*&$top=1000`, mockedChangeSets[0], mockedChangeSets[1]);
    }

    // ChangeSets with bridge properties have been prepared in before function.
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectBridgeProperties());
    chai.expect(changeSets.length).to.be.greaterThan(0);
    let actualChangeSetIndexWithBridgeProperties: number = -1;
    changeSets.forEach((value: ChangeSet, index: number) => {
      if (undefined !== value.bridgeJobId)
        actualChangeSetIndexWithBridgeProperties = index;
    });

    chai.expect(actualChangeSetIndexWithBridgeProperties, "Changeset with bridge properties not found.").to.be.greaterThan(-1);
    const actualChangeSet = changeSets[actualChangeSetIndexWithBridgeProperties];

    chai.expect(actualChangeSet.bridgeJobId).to.not.be.undefined;
    chai.expect(actualChangeSet.bridgeUsers).to.not.be.undefined;
    chai.expect(actualChangeSet.bridgeChangedFiles).to.not.be.undefined;
  });

  it("should create a new ChangeSet with bridge properties", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    mockChangeSets.map((changeSet: ChangeSet, i: number) => {
      const generatedBridgeProperties = utils.generateBridgeProperties(i + 1, i * 3 + 1);
      changeSet.bridgeJobId = generatedBridgeProperties.jobId;
      changeSet.bridgeUsers = Array.from(generatedBridgeProperties.users!.values());
      changeSet.bridgeChangedFiles = Array.from(generatedBridgeProperties.changedFiles!.values());
    });

    utils.mockGetChangeSet(imodelId, false, `?$select=*,HasBridgeProperties-forward-BridgeProperties.*&$top=1000`, mockChangeSets[0], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await iModelClient.changeSets.get(requestContext, imodelId, new ChangeSetQuery().selectBridgeProperties());

    const index = changeSets.length;
    chai.expect(index, `Reached maximum number of predefined ChangeSets on test iModel: '${maxChangeSetCount}'. Add additional ChangeSets to assets to fix it.`)
      .to.be.lessThan(maxChangeSetCount);
    const filePath = utils.getMockChangeSetPath(index, mockChangeSets[index].id!);

    mockCreateChangeSet(imodelId, mockChangeSets[index]);
    const progressTracker = new utils.ProgressTracker();
    const newChangeSet = await iModelClient.changeSets.create(requestContext, imodelId, mockChangeSets[index], filePath, progressTracker.track());

    chai.assert(newChangeSet);
    chai.expect(newChangeSet.bridgeJobId).to.be.equal(mockChangeSets[index].bridgeJobId);
    chai.expect(newChangeSet.bridgeUsers).to.deep.equal(mockChangeSets[index].bridgeUsers);
    chai.expect(newChangeSet.bridgeChangedFiles).to.deep.equal(mockChangeSets[index].bridgeChangedFiles);
    progressTracker.check();
  });
});
