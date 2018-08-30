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
  IModelHubClient, Briefcase, ChangeSet, ChangeSetQuery, IModelHubClientError, Version,
} from "../../";

import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { IModelHubStatus } from "@bentley/bentleyjs-core";

chai.should();

describe("iModelHub ChangeSetHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let briefcase: Briefcase;
  const imodelName = "imodeljs-clients ChangeSets test";

  const cumulativeChangeSetBackwardVersionId = "CumulativeChangeSet-backward-Version.Id";
  const cumulativeChangeSetBackwardChangeSetId = "CumulativeChangeSet-backward-ChangeSet.Id";
  const followingChangeSetBackwardVersionId = "FollowingChangeSet-backward-Version.Id";
  const followingChangesetBackwardChangesetId = "FollowingChangeSet-backward-ChangeSet.Id";

  before(async () => {
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    if (!TestConfig.enableMocks) {
      const changeSetCount = (await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can not create any new changesets
        await utils.createIModel(accessToken, imodelName, undefined, true);
        iModelId = await utils.getIModelId(accessToken, imodelName);
      }
    }
    briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];

    // Ensure that at least 3 exist
    await utils.createChangeSets(accessToken, iModelId, briefcase, 0, 3);

    if (!TestConfig.enableMocks) {
      const changesets = (await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId));
      // Ensure that at least one lock exists
      await utils.createLocks(accessToken, iModelId, briefcase, 1, 2, 2, changesets[0].id, changesets[0].index);

      // Create named versions
      utils.createVersions(accessToken, iModelId, [changesets[0].id!, changesets[1].id!, changesets[2].id!],
        ["Version 1", "Version 2", "Version 3"]);
    }

    if (!fs.existsSync(utils.workDir)) {
      fs.mkdirSync(utils.workDir);
    }
  });

  after(() => {
    utils.getIModelProjectAbstraction().terminate();
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
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId);

    const index = changeSets.length;
    const filePath = utils.getMockChangeSetPath(index, mockChangeSets[index].id!);

    mockCreateChangeSet(iModelId, mockChangeSets[2]);
    const progressTracker = new utils.ProgressTracker();
    const newChangeSet = await utils.getClient(iModelId).ChangeSets().create(accessToken, iModelId, mockChangeSets[index], filePath, progressTracker.track());

    chai.assert(newChangeSet);
    progressTracker.check();
  });

  it("should get information on ChangeSets", async () => {
    const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
    utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(1);

    let i = 0;
    for (const changeSet of changeSets) {
      utils.mockGetChangeSet(iModelId, false, changeSet.wsgId, mockedChangeSets[i++]);

      const fileName: string = changeSet.fileName!;
      chai.expect(fileName.length).to.be.greaterThan(0);

      const downloadUrl: string = changeSet.downloadUrl!;
      chai.assert(downloadUrl.startsWith("https://"));

      const changeSet2: ChangeSet = (await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSet.wsgId)))[0];

      chai.expect(changeSet.wsgId).to.be.equal(changeSet2.wsgId);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
    }

    const lastButOneChangeSet = changeSets[changeSets.length - 2];
    const lastButOneId = lastButOneChangeSet.id || lastButOneChangeSet.wsgId;
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${followingChangesetBackwardChangesetId}+eq+%27${lastButOneId}%27`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, ResponseBuilder.generateGetResponse(mockedChangeSets[changeSets.length - 2]));
    }
    const followingChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().fromId(lastButOneId));
    chai.expect(followingChangeSets.length).to.be.equal(1);
  });

  it("should download ChangeSets", async () => {
    utils.mockGetChangeSet(iModelId, true, undefined, utils.generateChangeSet(), utils.generateChangeSet());
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());

    const downloadChangeSetsToPath: string = path.join(utils.workDir, iModelId);

    utils.mockFileResponse(2);
    const progressTracker = new utils.ProgressTracker();
    await utils.getClient(iModelId).ChangeSets().download(changeSets, downloadChangeSetsToPath, progressTracker.track());
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
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().skip(1));
    chai.assert(changeSets);
    chai.expect(parseInt(changeSets[0].index!, 10)).to.be.greaterThan(1);
  });

  it("should get latest ChangeSets", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(iModelId, false, "?$orderby=Index+desc&$top=2", mockChangeSets[2], mockChangeSets[1]);
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().latest().top(2));
    chai.assert(changeSets);
    chai.expect(changeSets.length).to.be.equal(2);
    chai.expect(parseInt(changeSets[0].index!, 10)).to.be.greaterThan(parseInt(changeSets[1].index!, 10));
    utils.mockGetChangeSet(iModelId, false, "?$orderby=Index+desc&$top=2", mockChangeSets[2], mockChangeSets[1]);

    const changeSets2: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().orderBy("Index+desc").top(2));
    chai.assert(changeSets);
    chai.expect(changeSets).to.be.deep.equal(changeSets2);
  });

  it("should fail getting a ChangeSet by invalid id", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId("InvalidId"));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should fail downloading ChangeSets with no file handler", async () => {
    const mockChangeSets = utils.getMockChangeSets(briefcase);
    utils.mockGetChangeSet(iModelId, false, "?$orderby=Index+desc&$top=1", mockChangeSets[2]);
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().latest().top(1));

    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.ChangeSets().download(changeSets, utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileHandlerNotSet);
  });

  it("should fail downloading ChangeSets with no file url", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await utils.getClient(iModelId).ChangeSets().download([new ChangeSet()], utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.MissingDownloadUrlError);
  });

  it("should fail creating a ChangeSet with no file handler", async () => {
    let error: IModelHubClientError | undefined;
    const invalidClient = new IModelHubClient(TestConfig.deploymentEnv);
    try {
      await invalidClient.ChangeSets().create(accessToken, iModelId, new ChangeSet(), utils.workDir);
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
      await utils.getClient(iModelId).ChangeSets().create(accessToken, iModelId, new ChangeSet(), utils.workDir + "InvalidChangeSet.cs");
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
      await utils.getClient(iModelId).ChangeSets().create(accessToken, iModelId, new ChangeSet(), utils.workDir);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.FileNotFound);
  });

  it("should query between changesets", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      let filter = `(${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[0].id}%27`;
      filter += `+and+${followingChangesetBackwardChangesetId}+eq+%27${mockedChangeSets[2].id}%27)`;
      filter += `+or+(${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[2].id}%27`;
      filter += `+and+${followingChangesetBackwardChangesetId}+eq+%27${mockedChangeSets[0].id}%27)`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[1], mockedChangeSets[2]]));
    }
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().betweenChangeSets(changeSets[0].id!, changeSets[2].id));
    chai.expect(selectedChangeSets.length).to.be.equal(2);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[0].seedFileId).to.be.equal(changeSets[1].seedFileId);
    chai.expect(selectedChangeSets[1].id).to.be.equal(changeSets[2].id);
    chai.expect(selectedChangeSets[1].seedFileId).to.be.equal(changeSets[2].seedFileId);
  });

  it("should query between changeset", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      const filter = `${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[2].id}%27`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[0], mockedChangeSets[1], mockedChangeSets[2]]));
    }
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().betweenChangeSets(changeSets[2].id!));
    chai.expect(selectedChangeSets.length).to.be.equal(3);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[0].id);
    chai.expect(selectedChangeSets[0].seedFileId).to.be.equal(changeSets[0].seedFileId);
    chai.expect(selectedChangeSets[1].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[1].seedFileId).to.be.equal(changeSets[1].seedFileId);
    chai.expect(selectedChangeSets[2].id).to.be.equal(changeSets[2].id);
    chai.expect(selectedChangeSets[2].seedFileId).to.be.equal(changeSets[2].seedFileId);
  });

  it("should get version changesets", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedVersion = utils.generateVersion();
      utils.mockGetVersions(iModelId, undefined, mockedVersion);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      const filter = `${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersion.wsgId}%27`;
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetResponse(mockedChangeSets[0]));
    }

    const versions: Version[] = await utils.getClient(iModelId).Versions().get(accessToken, iModelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(0);
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().getVersionChangeSets(versions[versions.length - 1].wsgId));
    chai.expect(selectedChangeSets.length).to.be.equal(1);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[0].id);
    chai.expect(selectedChangeSets[0].seedFileId).to.be.equal(changeSets[0].seedFileId);
  });

  it("should get changesets after version", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedVersion = Array(3).fill(0).map(() => utils.generateVersion());
      utils.mockGetVersions(iModelId, undefined, ...mockedVersion);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      const filter = `${followingChangeSetBackwardVersionId}+eq+%27${mockedVersion[1].wsgId}%27`;
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[2], mockedChangeSets[1]]));
    }

    const versions: Version[] = await utils.getClient(iModelId).Versions().get(accessToken, iModelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(1);
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().afterVersion(versions[versions.length - 2].wsgId));
    chai.expect(selectedChangeSets.length).to.be.greaterThan(1);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[2].id);
    chai.expect(selectedChangeSets[0].seedFileId).to.be.equal(changeSets[2].seedFileId);
  });

  it("should query changesets between versions", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
      utils.mockGetVersions(iModelId, undefined, ...mockedVersions);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      let filter = `(${followingChangeSetBackwardVersionId}+eq+%27${mockedVersions[0].wsgId}%27`;
      filter += `+and+${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersions[2].wsgId}%27)`;
      filter += `+or+(${followingChangeSetBackwardVersionId}+eq+%27${mockedVersions[2].wsgId}%27`;
      filter += `+and+${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersions[0].wsgId}%27)`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetArrayResponse([mockedChangeSets[1], mockedChangeSets[2]]));
    }

    const versions: Version[] = await utils.getClient(iModelId).Versions().get(accessToken, iModelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(1);
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().betweenVersions(versions[0].wsgId, versions[2].wsgId));
    chai.expect(selectedChangeSets.length).to.be.equal(2);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[0].seedFileId).to.be.equal(changeSets[1].seedFileId);
    chai.expect(selectedChangeSets[1].id).to.be.equal(changeSets[2].id);
    chai.expect(selectedChangeSets[1].seedFileId).to.be.equal(changeSets[2].seedFileId);
  });

  it("should query changesets between version and changeset", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedVersion = utils.generateVersion();
      utils.mockGetVersions(iModelId, undefined, mockedVersion);

      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      let filter = `(${cumulativeChangeSetBackwardVersionId}+eq+%27${mockedVersion.wsgId}%27+and+`;
      filter += `${followingChangesetBackwardChangesetId}+eq+%27${mockedChangeSets[1].id}%27)`;
      filter += `+or+`;
      filter += `(${followingChangeSetBackwardVersionId}+eq+%27${mockedVersion.wsgId}%27+and+`;
      filter += `${cumulativeChangeSetBackwardChangeSetId}+eq+%27${mockedChangeSets[1].id}%27)`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetResponse(mockedChangeSets[1]));
    }

    const versions: Version[] = await utils.getClient(iModelId).Versions().get(accessToken, iModelId);
    chai.assert(versions);
    chai.expect(versions.length).to.be.greaterThan(0);
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().betweenVersionAndChangeSet(versions[versions.length - 1].wsgId, changeSets[1].id!));
    chai.expect(selectedChangeSets.length).to.be.equal(1);
    chai.expect(selectedChangeSets[0].id).to.be.equal(changeSets[1].id);
    chai.expect(selectedChangeSets[0].seedFileId).to.be.equal(changeSets[1].seedFileId);
  });

  it("should query changesets by seed file id", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedChangeSets = utils.getMockChangeSets(briefcase).slice(0, 3);
      utils.mockGetChangeSet(iModelId, true, undefined, ...mockedChangeSets);

      const filter = `SeedFileId+eq+%27${mockedChangeSets[0].seedFileId!}%27`;

      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=${filter}`);
      ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath,
        ResponseBuilder.generateGetResponse(mockedChangeSets[0]));
    }
    const changeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(0);

    const selectedChangeSets: ChangeSet[] = await utils.getClient(iModelId).ChangeSets().get(accessToken, iModelId,
      new ChangeSetQuery().bySeedFileId(changeSets[0].seedFileId!));
    chai.expect(selectedChangeSets.length).to.be.greaterThan(0);
    selectedChangeSets.forEach((cs: ChangeSet) => {
      chai.expect(cs.seedFileId!).to.be.equal(changeSets[0].seedFileId!);
    });
  });
});
