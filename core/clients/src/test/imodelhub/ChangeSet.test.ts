/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";

import { TestConfig } from "../TestConfig";

import { Briefcase, ChangeSet, Lock, UserInfo, ChangeSetQuery, UserInfoQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { RequestQueryOptions } from "../../Request";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import * as utils from "./TestUtils";

declare const __dirname: string;

chai.should();

function mockGetChangeSetById(responseBuilder: ResponseBuilder, imodelId: string, changeSet: ChangeSet) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "ChangeSet", changeSet.wsgId);
  const requestResponse = responseBuilder.generateGetResponse<ChangeSet>(changeSet);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

describe("iModelHub ChangeSetHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let briefcase: Briefcase;
  const imodelName = "imodeljs-clients ChangeSets test";
  // let seedFileId: string;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const downloadToPath: string = __dirname + "/../assets/";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    if (TestConfig.enableMocks) {
      responseBuilder.mockResponse("https://buddi.bentley.com", RequestType.Get, "/WebService/GetUrl/?url=iModelHubApi&region=103", JSON.stringify({ result: { url: "https://dev-imodelhubapi.bentley.com" } }));
    }
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    if (!TestConfig.enableMocks) {
      const changeSetCount = (await imodelHubClient.ChangeSets().get(accessToken, iModelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can't create any new changesets
        await utils.createIModel(accessToken, imodelName, undefined, true);
      }
    }
    briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];

    // Ensure that at least two exist
    await utils.createChangeSets(accessToken, iModelId, briefcase, 2, 0);

    if (!fs.existsSync(downloadToPath)) {
      fs.mkdirSync(downloadToPath);
    }
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should create a new ChangeSet", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const mockChangeSets = utils.getMockChangeSets(briefcase);
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId);
    const index = changeSets.length;
    const filePath = utils.getMockChangeSetPath(index, mockChangeSets[index].id!);
    const newChangeSet = await imodelHubClient.ChangeSets().create(accessToken, iModelId, mockChangeSets[index], filePath);
    chai.expect(newChangeSet);
  });

  it("should get information on ChangeSets", async () => {
    const mockedChangeSets = Array(3).fill(0).map(() => utils.generateChangeSet());
    utils.mockGetChangeSet(responseBuilder, iModelId, ...mockedChangeSets);

    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length >= 2);

    let i = 0;
    for (const changeSet of changeSets) {
      mockGetChangeSetById(responseBuilder, iModelId, mockedChangeSets[i++]);

      const fileName: string = changeSet.fileName!;
      chai.expect(fileName.length).to.be.greaterThan(0);

      const downloadUrl: string = changeSet.downloadUrl!;
      chai.expect(downloadUrl.startsWith("https://"));

      const changeSet2: ChangeSet = (await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSet.wsgId)))[0];

      chai.expect(changeSet.wsgId).to.be.equal(changeSet2.wsgId);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
    }

    const lastButOneId = changeSets[changeSets.length - 2].wsgId;
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
        `?$filter=FollowingChangeSet-backward-ChangeSet.Id+eq+%27${lastButOneId}%27`);
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, responseBuilder.generateGetResponse(mockedChangeSets[changeSets.length - 2]));
    }
    const lastChangeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().fromId(lastButOneId));
    chai.expect(lastChangeSets.length).to.be.equal(1);
  });

  it("should download ChangeSets", async () => {
    utils.mockGetChangeSet(responseBuilder, iModelId, utils.generateChangeSet(), utils.generateChangeSet());
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());

    const downloadChangeSetsToPath: string = path.join(downloadToPath, TestConfig.iModelName);

    utils.mockFileResponse(responseBuilder, downloadToPath, 2);
    await imodelHubClient.ChangeSets().download(changeSets, downloadChangeSetsToPath);
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    for (const changeSet of changeSets) {
      const fileName: string = changeSet.fileName!;
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, fileName);

      fs.existsSync(downloadedPathname).should.be.equal(true);
    }
  });

  // TODO: Requires locks management to have this working as integration test
  it("should find information on the ChangeSet a specific Element was last modified in", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const mockId = utils.generateChangeSetId();
    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Lock", "?$top=1");
      const requestResponse = responseBuilder.generateGetResponse<Lock>(responseBuilder.generateObject<Lock>(Lock,
        new Map<string, any>([
          ["objectId", "123"],
          ["releasedWithChangeSet", mockId],
          ["userCreated", "1"],
        ])));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }

    // For a test case, find an element that was recently modified by looking at the first lock
    let queryOptions: RequestQueryOptions = {
      $top: 1,
      // $filter: "LockType+eq+2+and+LockLevel+eq+2", // LockType=Element AND LockLevel=Exclusive
    };
    const elementLocks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId, queryOptions);
    chai.expect(elementLocks.length).equals(1);
    const testElementId: string = elementLocks[0].objectId!; // Hex or Decimal

    if (TestConfig.enableMocks) {
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "Lock", "?$top=1&$filter=ObjectId+eq+%27123%27");
      const requestResponse = responseBuilder.generateGetResponse<Lock>(responseBuilder.generateObject<Lock>(Lock,
        new Map<string, any>([
          ["objectId", "123"],
          ["releasedWithChangeSet", mockId],
          ["userCreated", "1"],
        ])));
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }
    // Find the change set that the lock was modified in
    queryOptions = {
      $top: 1,
      $filter: "ObjectId+eq+'" + testElementId + "'",
    };
    const queryLocks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId, queryOptions);
    chai.expect(queryLocks.length).equals(1);

    const changeSetId: string = queryLocks[0].releasedWithChangeSet!; // Can get changeSetIndex also if necessary to compare against current
    chai.expect(changeSetId).length.greaterThan(0);

    if (TestConfig.enableMocks) {
      const requestResponse = responseBuilder.generateGetResponse<ChangeSet>(responseBuilder.generateObject<ChangeSet>(ChangeSet,
        new Map<string, any>([["userCreated", "1"]])));
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet", mockId);
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }
    const changeSet: ChangeSet = (await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
    chai.expect(!!changeSet);

    if (TestConfig.enableMocks) {
      const requestResponse = responseBuilder.generateGetResponse<UserInfo>(responseBuilder.generateObject<UserInfo>(UserInfo));
      const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "UserInfo", "1");
      responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
    }
    const userInfo: UserInfo = (await imodelHubClient.Users().get(accessToken, iModelId, new UserInfoQuery().byId(changeSet.userCreated!)))[0];
    chai.expect(!!userInfo);
  });
});
