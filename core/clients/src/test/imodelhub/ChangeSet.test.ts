/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";
import * as fs from "fs";
import * as path from "path";

import { TestConfig } from "../TestConfig";

import { IModel, ChangeSet, Lock, UserInfo, IModelQuery, ChangeSetQuery, UserInfoQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AuthorizationToken, AccessToken } from "../../Token";
import { ConnectClient, Project } from "../../ConnectClients";
import { RequestQueryOptions } from "../../Request";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";

declare const __dirname: string;

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

describe("iModelHub ChangeSetHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  // let seedFileId: string;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const downloadToPath: string = __dirname + "/../assets/";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);

    const project: Project | undefined = await connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    });
    chai.expect(project);

    projectId = project.wsgId;
    chai.expect(projectId);

    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel",
                                              "?$filter=Name+eq+%27" + TestConfig.iModelName + "%27");
    const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
                                            new Map<string, any>([
                                              ["wsgId", "b74b6451-cca3-40f1-9890-42c769a28f3e"],
                                              ["name", TestConfig.iModelName],
                                            ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const iModels = await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(TestConfig.iModelName));

    if (!iModels[0].wsgId) {
      chai.assert(false);
      return;
    }

    iModelId = iModels[0].wsgId;

    if (!fs.existsSync(downloadToPath)) {
      fs.mkdirSync(downloadToPath);
    }
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should get information on ChangeSets", async () => {
    const changesetCount = 3;
    const mockId = "bb1848116eb71d83747ad6bf49c1c459c7555ef9";
    let requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
                                                       "?$select=*,FileAccessKey-forward-AccessKey.DownloadURL");
    let requestResponse = responseBuilder.generateGetResponse<ChangeSet>(responseBuilder.generateObject<ChangeSet>(ChangeSet,
                                            new Map<string, any>([
                                              ["fileName", "TestModel"],
                                              ["downloadUrl", "https://imodelhubqasa01.blob.core.windows.net/imodelhub"],
                                              ["wsgId", mockId],
                                              ["index", "1"],
                                            ])), changesetCount);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());
    chai.expect(changeSets.length).to.be.greaterThan(2);

    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
                                                       mockId);
    requestResponse = responseBuilder.generateGetResponse<ChangeSet>(responseBuilder.generateObject<ChangeSet>(ChangeSet,
                                        new Map<string, any>([
                                          ["wsgId", mockId],
                                          ["index", "1"],
                                        ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse, changesetCount);
    for (const changeSet of changeSets) {
      const fileName: string = changeSet.fileName!;
      chai.expect(fileName.length).to.be.greaterThan(0);

      const downloadUrl: string = changeSet.downloadUrl!;
      chai.expect(downloadUrl).to.startWith("https://");

      const changeSet2: ChangeSet = (await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSet.wsgId)))[0];

      chai.expect(changeSet.wsgId).to.be.equal(changeSet2.wsgId);
      chai.expect(changeSet.index).to.be.equal(changeSet2.index);
    }

    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
                                                `?$filter=FollowingChangeSet-backward-ChangeSet.Id+eq+%27${mockId}%27`);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const lastButOneId = changeSets[changeSets.length - 2].wsgId;
    const lastChangeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().fromId(lastButOneId));
    chai.expect(lastChangeSets.length).to.be.equal(1);
  });

  it("should download ChangeSets", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
                                                       "?$select=*,FileAccessKey-forward-AccessKey.DownloadURL");
    const requestResponse = responseBuilder.generateGetResponse<ChangeSet>(responseBuilder.generateObject<ChangeSet>(ChangeSet,
                                            new Map<string, any>([
                                              ["fileName", "TestModel"],
                                              ["downloadUrl", "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile"],
                                            ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const changeSets: ChangeSet[] = await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().selectDownloadUrl());

    const downloadChangeSetsToPath: string = path.join(downloadToPath, TestConfig.iModelName);

    responseBuilder.mockFileResponse("https://imodelhubqasa01.blob.core.windows.net", "/imodelhubfile", downloadToPath + "empty-files/empty.bim");
    await imodelHubClient.ChangeSets().download(changeSets, downloadChangeSetsToPath);
    fs.existsSync(downloadChangeSetsToPath).should.be.equal(true);
    for (const changeSet of changeSets) {
      const fileName: string = changeSet.fileName!;
      const downloadedPathname: string = path.join(downloadChangeSetsToPath, fileName);

      fs.existsSync(downloadedPathname).should.be.equal(true);
    }
  });

  it("should find information on the ChangeSet a specific Element was last modified in", async () => {
    const mockId = "bb1848116eb71d83747ad6bf49c1c459c7555ef9";
    let requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Lock", "?$top=1");
    let requestResponse = responseBuilder.generateGetResponse<Lock>(responseBuilder.generateObject<Lock>(Lock,
                                            new Map<string, any>([
                                              ["objectId", "123"],
                                              ["releasedWithChangeSet", mockId],
                                              ["userCreated", "1"],
                                              ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    // For a test case, find an element that was recently modified by looking at the first lock
    let queryOptions: RequestQueryOptions = {
      $top: 1,
      // $filter: "LockType+eq+2+and+LockLevel+eq+2", // LockType=Element AND LockLevel=Exclusive
    };
    const elementLocks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId, queryOptions);
    chai.expect(elementLocks.length).equals(1);
    const testElementId: string = elementLocks[0].objectId!; // Hex or Decimal

    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Lock", "?$top=1&$filter=ObjectId+eq+%27123%27");
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    // Find the change set that the lock was modified in
    queryOptions = {
      $top: 1,
      $filter: "ObjectId+eq+'" + testElementId + "'",
    };
    const queryLocks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId, queryOptions);
    chai.expect(queryLocks.length).equals(1);

    const changeSetId: string = queryLocks[0].releasedWithChangeSet!; // Can get changeSetIndex also if necessary to compare against current
    chai.expect(changeSetId).length.greaterThan(0);

    requestResponse = responseBuilder.generateGetResponse<ChangeSet>(responseBuilder.generateObject<ChangeSet>(ChangeSet,
                                                                    new Map<string, any>([["userCreated", "1"]])));
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet", mockId);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const changeSet: ChangeSet = (await imodelHubClient.ChangeSets().get(accessToken, iModelId, new ChangeSetQuery().byId(changeSetId)))[0];
    chai.expect(!!changeSet);

    requestResponse = responseBuilder.generateGetResponse<UserInfo>(responseBuilder.generateObject<UserInfo>(UserInfo));
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "UserInfo", "1");
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const userInfo: UserInfo = (await imodelHubClient.Users().get(accessToken, iModelId, new UserInfoQuery().byId(changeSet.userCreated!)))[0];
    chai.expect(!!userInfo);
  });
});
