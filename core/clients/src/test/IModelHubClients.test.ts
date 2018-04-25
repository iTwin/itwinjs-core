/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";
import * as fs from "fs";
import * as path from "path";

import { TestConfig } from "./TestConfig";

import { IModel, Briefcase, SeedFile, ChangeSet, Version, Lock, CodeState, Code, MultiCode, EventSubscription,
  CodeEvent, EventSAS, UserInfo, IModelHubResponseError, IModelHubResponseErrorId, IModelHubRequestError, IModelHubRequestErrorId, IModelQuery, BriefcaseQuery,
  ChangeSetQuery, VersionQuery, UserInfoQuery, AggregateResponseError, ConflictingCodesError } from "../imodelhub";
import { IModelHubBaseHandler } from "../imodelhub/BaseHandler";
import { IModelHubClient } from "../imodelhub/Client";
import { AuthorizationToken, AccessToken } from "../Token";
import { ConnectClient, Project } from "../ConnectClients";
import { RequestQueryOptions } from "../Request";
import { WsgError } from "../WsgClient";
import { ResponseBuilder, RequestType, ScopeType } from "./ResponseBuilder";
import { AzureFileHandler } from "../imodelhub/AzureFileHandler";
import { ECJsonTypeMap } from "../index";

declare const __dirname: string;

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

async function deleteiModelByName(imodelHubClient: IModelHubClient, accessToken: AccessToken, projectId: string, imodelName: string): Promise<void> {
  const imodels = await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(imodelName));
  if (imodels.length > 0) {
    await imodelHubClient.IModels().delete(accessToken, projectId, imodels[0].wsgId);
  }
}

describe("IModelHubClient", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let testiModelName: string | undefined;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);

    const project: Project | undefined = await connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    });
    chai.expect(project);

    chai.expect(project.wsgId);
    projectId = project.wsgId;
  });

  afterEach(async () => {
    responseBuilder.clearMocks();
    if (!TestConfig.enableNock) {
      if (testiModelName) {
        await deleteiModelByName(imodelHubClient, accessToken, projectId, testiModelName);
        testiModelName = undefined;
      }
    }
  });

  it("should setup its URLs correctly", async () => {
    let url = await new IModelHubBaseHandler("DEV").getUrl();
    chai.expect(url).equals("https://dev-imodelhubapi.bentley.com/v2.5");

    url = await new IModelHubBaseHandler("QA").getUrl();
    chai.expect(url).equals("https://qa-imodelhubapi.bentley.com/v2.5");

    url = await new IModelHubBaseHandler("PROD").getUrl();
    chai.expect(url).equals("https://imodelhubapi.bentley.com/v2.5");

    url = await new IModelHubBaseHandler("PERF").getUrl();
    chai.expect(url).equals("https://perf-imodelhubapi.bentley.com/v2.5");
  });

  it("should get list of IModels", async () => {
    const imodels: IModel[] = await imodelHubClient.IModels().get(accessToken, projectId);
    chai.expect(imodels.length).to.be.greaterThan(0);
  });

  it("should get a specific IModel", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId,
                      "iModel", "?$filter=Name+eq+%27" + TestConfig.iModelName + "%27");
    const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
                                            new Map<string, any>([["name", TestConfig.iModelName]])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(TestConfig.iModelName)))[0];
    chai.expect(iModel.name).equals(TestConfig.iModelName);
  });

  it.skip("should be able to delete iModels", async () => {
    // Used only for maintenance
    const names = ["22_LargePlant.166.i"];
    for (const name of names) {
      const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
        new Map<string, any>([["name", name],
        ["wsgId", Math.random()]])));
      let requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId,
                                         "iModel", `?$filter=Name+eq+%27${name}%27`);
      responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

      const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(name)))[0];
      chai.expect(iModel.name).equals(name);

      requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId,
                                                           "iModel", iModel.wsgId);
      responseBuilder.MockResponse(RequestType.Delete, requestPath, "");
      await imodelHubClient.IModels().delete(accessToken, projectId, iModel.wsgId);
    }
  });
});

describe("For a specific IModel, IModelHubClient", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  // let seedFileId: string;
  let briefcaseId: number;
  let briefcaseId2: number;
  let subscription: EventSubscription;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const downloadToPath: string = __dirname + "/assets/";
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

  it("should get the Id", async () => {
    chai.expect(iModelId.length).equals(36); // length of a guid string
  });

  it("should retrieve an iModel by it's id", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel", iModelId);
    const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
                                            new Map<string, any>([["wsgId", iModelId]])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const iModel: IModel = (await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byId(iModelId)))[0];

    chai.expect(iModel.wsgId).equals(iModelId);
  });

  it("should fail getting an invalid iModel", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel", "00000000-0000-0000-0000-000000000000");
    responseBuilder.MockResponse(RequestType.Get, requestPath, responseBuilder.generateError("InstanceNotFound"),
                                                                                        1, undefined, undefined, 404);

    await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byId("00000000-0000-0000-0000-000000000000"))
      .should.eventually.be.rejectedWith(WsgError)
      .and.have.property("name", "InstanceNotFound");
  });

  function generateBriefcase(id: number): Briefcase {
    return responseBuilder.generateObject<Briefcase>(Briefcase, new Map<string, any>([["briefcaseId", id]]));
  }

  it("should fail getting an iModel without projectId", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, "", "iModel", iModelId);
    responseBuilder.MockResponse(RequestType.Get, requestPath, responseBuilder.generateError("iModelHub.ProjectIdIsNotSpecified"),
                                                                                        1, undefined, undefined, 400);
    await imodelHubClient.IModels().get(accessToken, "", new IModelQuery().byId(iModelId))
      .should.eventually.be.rejectedWith(IModelHubResponseError)
      .and.have.property("id", IModelHubResponseErrorId.ProjectIdIsNotSpecified);
  });

  it("should get all briefcases, and acquire one if necessary", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    let requestResponse = responseBuilder.generateGetResponse<Briefcase>(generateBriefcase(2));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    let briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
    // Note: Avoiding acquiring a briefcase unless really necessary - there's only a limited amount of briefcases available
    if (briefcases.length < 2) {
      // Acquire 1 briefcase when using nock, to cover Briefcase.create()
      requestResponse = responseBuilder.generatePostResponse<Briefcase>(generateBriefcase(3));
      const postBody = responseBuilder.generatePostBody<EventSubscription>(responseBuilder.generateObject<Briefcase>(Briefcase));
      responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);
      for (let i = briefcases.length; i < 2; ++i) {
        const briefcase = await imodelHubClient.Briefcases().create(accessToken, iModelId);
        chai.expect(briefcase.briefcaseId).greaterThan(0);
      }

      requestResponse = responseBuilder.generateGetArrayResponse<Briefcase>([generateBriefcase(2), generateBriefcase(3)]);
      responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

      briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
      chai.expect(briefcases.length).greaterThan(0);
    }

    for (const briefcase of briefcases) {
      chai.expect(briefcase.iModelId).to.be.equal(iModelId);
    }
    briefcaseId = briefcases[0].briefcaseId!;
    briefcaseId2 = briefcases[1].briefcaseId!;
  });

  it("should fail getting an invalid briefcase", async () => {
    await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(-1))
    .should.eventually.be.rejectedWith(IModelHubRequestError)
    .and.have.property("id", IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should get information on a briefcase", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase", `${briefcaseId}`);
    const requestResponse = responseBuilder.generateGetResponse<Briefcase>(responseBuilder.generateObject<Briefcase>(Briefcase,
                                            new Map<string, any>([["iModelId", iModelId],
                                              ["briefcaseId", briefcaseId],
                                              ["fileName", "TestModel.bim"],
                                              ["eTag", "v2QXvv8KWO"],
                                            ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId)))[0];
    chai.expect(briefcase.briefcaseId).to.be.equal(briefcaseId);
    chai.expect(briefcase.fileName).to.be.equal(TestConfig.iModelName + ".bim");
    chai.expect(briefcase.eTag).to.have.length.above(5);
    chai.expect(briefcase.downloadUrl).to.be.equal(undefined);
    chai.expect(briefcase.iModelId).to.be.equal(iModelId);
  });

  it("should fail deleting an invalid briefcase", async () => {
    await imodelHubClient.Briefcases().delete(accessToken, iModelId, -1)
      .should.eventually.be.rejectedWith(IModelHubRequestError)
      .and.have.property("id", IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should get the download URL for a Briefcase", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase",
                                    `${briefcaseId}?$select=*,FileAccessKey-forward-AccessKey.DownloadURL`);
    const requestResponse = responseBuilder.generateGetResponse<Briefcase>(responseBuilder.generateObject<Briefcase>(Briefcase,
                                            new Map<string, any>([
                                              ["briefcaseId", briefcaseId],
                                              ["fileName", "TestModel.bim"],
                                              ["eTag", "v2QXvv8KWO"],
                                              ["downloadUrl", "https://imodelhubqasa01.blob.core.windows.net/imodelhub"],
                                            ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.expect(briefcase.briefcaseId).to.be.equal(briefcaseId);
    chai.expect(briefcase.fileName).to.be.equal(TestConfig.iModelName + ".bim");
    chai.expect(briefcase.eTag).to.have.length.above(5);
    chai.expect(briefcase.downloadUrl).to.startWith("https://");
  });

  it("should download a Briefcase", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase",
                        `${briefcaseId}?$select=*,FileAccessKey-forward-AccessKey.DownloadURL`);
    const requestResponse = responseBuilder.generateGetResponse<Briefcase>(responseBuilder.generateObject<Briefcase>(Briefcase,
                                            new Map<string, any>([
                                              ["fileName", "TestModel.bim"],
                                              ["eTag", "v2QXvv8KWO"],
                                              ["downloadUrl", "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile"],
                                            ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const briefcase: Briefcase = (await imodelHubClient.Briefcases().get(accessToken, iModelId, new BriefcaseQuery().byId(briefcaseId).selectDownloadUrl()))[0];
    chai.expect(briefcase.downloadUrl);

    const fileName: string = briefcase.fileName!;
    const downloadToPathname: string = path.join(downloadToPath, fileName);

    responseBuilder.mockFileResponse("https://imodelhubqasa01.blob.core.windows.net", "/imodelhubfile", downloadToPath + "empty-files/empty.bim");

    await imodelHubClient.Briefcases().download(briefcase, downloadToPathname);
    fs.existsSync(downloadToPathname).should.be.equal(true);
  });

  it("should get named versions", async () => {
    const versionsCount = 3;
    const responseObject = responseBuilder.generateObject<Version>(Version, new Map<string, any>([
                                                              ["wsgId", "00000000-0000-0000-0000-000000000000"],
                                                              ["name", "TestModel"],
                                                              ["changesetId", "0123456789"],
                                                            ]));
    let requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Version");
    let requestResponse = responseBuilder.generateGetResponse<SeedFile>(responseObject, versionsCount);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const versions: Version[] = await imodelHubClient.Versions().get(accessToken, iModelId);
    chai.expect(versions.length).equals(3);

    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Version", "00000000-0000-0000-0000-000000000000");
    requestResponse = responseBuilder.generateGetResponse<Version>(responseObject);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse, versionsCount);
    for (const expectedVersion of versions) {
      const actualVersion: Version = (await imodelHubClient.Versions().get(accessToken, iModelId, new VersionQuery().byId(expectedVersion.wsgId)))[0];
      chai.expect(!!actualVersion);
      chai.expect(actualVersion.changeSetId).to.be.equal(expectedVersion.changeSetId);
    }
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

  it("should get information on Locks", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Lock");
    const requestResponse = responseBuilder.generateGetResponse<Lock>(responseBuilder.generateObject<Lock>(Lock));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const locks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId);
    chai.expect(locks.length).to.be.greaterThan(0);
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

  it("should subscribe to event subscription", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "EventSubscription");
    const requestResponse = responseBuilder.generatePostResponse<EventSubscription>(responseBuilder.generateObject<EventSubscription>(EventSubscription,
                                            new Map<string, any>([["wsgId", "12345"], ["eventTypes", ["CodeEvent"]]])));
    const postBody = responseBuilder.generatePostBody<EventSubscription>(responseBuilder.generateObject<EventSubscription>(EventSubscription,
                                                        new Map<string, any>([["wsgId", undefined], ["eventTypes", ["CodeEvent"]]])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    subscription = await imodelHubClient.Events().Subscriptions().create(accessToken, iModelId, ["CodeEvent"]);
    chai.expect(subscription);
  });

  function randomCodeValue(prefix: string): string {
    return (prefix +  Math.floor(Math.random() * Math.pow(2, 30)).toString());
  }

  function randomCode(briefcase: number): Code {
    const code = new Code();
    code.briefcaseId = briefcase;
    code.codeScope = "TestScope";
    code.codeSpecId = "0XA";
    code.state = CodeState.Reserved;
    code.value = randomCodeValue("TestCode");
    return code;
  }

  /** assumes all have same scope / specId */
  function mockUpdateCodes(...codes: Code[]) {
    const multiCode = new MultiCode();
    multiCode.briefcaseId = codes[0].briefcaseId;
    multiCode.codeScope = codes[0].codeScope;
    multiCode.codeSpecId = codes[0].codeSpecId;
    multiCode.state = codes[0].state;
    multiCode.values = codes.map((value) => value.value!);
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    const requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);
  }

  /** assumes all have same scope / specId */
  function mockDeniedCodes(...codes: Code[]) {
    const multiCode = new MultiCode();
    multiCode.briefcaseId = codes[0].briefcaseId;
    multiCode.codeScope = codes[0].codeScope;
    multiCode.codeSpecId = codes[0].codeSpecId;
    multiCode.state = codes[0].state;
    multiCode.values = codes.map((value) => value.value!);
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    const requestResponse = responseBuilder.generateError("iModelHub.CodeReservedByAnotherBriefcase", "", "", new Map<string, any>([["ConflictingCodes", JSON.stringify(codes.map((value) => {
      const obj = ECJsonTypeMap.toJson<Code>("wsg", value);
      return obj.properties;
    })),
    ]]));
    const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);
  }

  it("should reserve multiple codes", async () => {
    const code1 = randomCode(briefcaseId);
    const code2 = randomCode(briefcaseId);

    mockUpdateCodes(code1, code2);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(2);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));
  });

  it("should fail on conflicting codes", async () => {
    const code1 = randomCode(briefcaseId);
    const code2 = randomCode(briefcaseId);
    const code3 = randomCode(briefcaseId);
    const code4 = randomCode(briefcaseId);

    mockUpdateCodes(code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    mockDeniedCodes(code2);
    mockDeniedCodes(code3);
    mockUpdateCodes(code4);

    let receivedError: Error | undefined;
    try {
      await imodelHubClient.Codes().update(accessToken, iModelId, [code2, code3, code4], { codesPerRequest: 1 });
    } catch (error) {
      receivedError = error;
    }
    chai.expect(receivedError);
    chai.expect(receivedError).to.be.instanceof(AggregateResponseError);
  });

  it("should return conflicting codes", async () => {
    const code1 = randomCode(briefcaseId);
    const code2 = randomCode(briefcaseId);
    const code3 = randomCode(briefcaseId);
    const code4 = randomCode(briefcaseId);

    mockUpdateCodes(code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    mockDeniedCodes(code2);
    mockDeniedCodes(code3);
    mockUpdateCodes(code4);

    let receivedError: ConflictingCodesError | undefined;
    try {
      await imodelHubClient.Codes().update(accessToken, iModelId, [code2, code3, code4],
        { deniedCodes: true, codesPerRequest: 1, continueOnConflict: true });
    } catch (error) {
      chai.expect(error).is.instanceof(ConflictingCodesError);
      receivedError = error;
    }
    chai.expect(receivedError);
    chai.expect(receivedError!.conflictingCodes);
    chai.expect(receivedError!.conflictingCodes!.length).to.be.equal(2);
    chai.expect(receivedError!.conflictingCodes![0].value).to.be.equal(code2.value);
    chai.expect(receivedError!.conflictingCodes![1].value).to.be.equal(code3.value);
  });

  it("should update code multiple times", async () => {
    let code = new Code();
    code.briefcaseId = briefcaseId;
    code.codeScope = "TestScope";
    code.codeSpecId = "0XA";
    code.state = CodeState.Reserved;
    code.changeState = "new";
    code.value = randomCodeValue("TestCode");

    const multiCode = new MultiCode();
    multiCode.briefcaseId = code.briefcaseId;
    multiCode.codeScope = code.codeScope;
    multiCode.codeSpecId = code.codeSpecId;
    multiCode.state = code.state;
    multiCode.values = [code.value];
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    let requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    let postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    let result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Reserved);

    code.state = CodeState.Used;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";

    multiCode.state = code.state;
    requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Used);

    code.state = CodeState.Retired;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";

    multiCode.state = code.state;
    requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Retired);
  });

  it("should receive code event", async () => {
    // This test attempts to receive at least one code event generated by the test above
    let requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "EventSAS");
    const responseObject = responseBuilder.generateObject<EventSAS>(EventSAS, new Map<string, any>([
                     ["sasToken", "12345"],
                     ["baseAddres", "https://qa-imodelhubapi.bentley.com/v2.5/Repositories/iModel--" + iModelId + "/iModelScope"]]));
    let requestResponse = responseBuilder.generatePostResponse<EventSAS>(responseObject);
    const postBody = responseBuilder.generatePostBody<Code>(responseBuilder.generateObject<EventSAS>(EventSAS));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);
    const sas = await imodelHubClient.Events().getSASToken(accessToken, iModelId);

    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Subscriptions", subscription.wsgId + "/messages/head");
    requestResponse = '{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":1,"CodeScope":"0X100000000FF","CodeSpecId":"0xff","State":1,"Values":["TestCode143678383"]}';
    responseBuilder.MockResponse(RequestType.Delete, requestPath, requestResponse, 1, "", {"content-type": "CodeEvent"});
    const event = await imodelHubClient.Events().getEvent(sas.sasToken!, sas.baseAddres!, subscription.wsgId);

    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "EventSubscription", subscription.wsgId);
    responseBuilder.MockResponse(RequestType.Delete, requestPath, "");
    await imodelHubClient.Events().Subscriptions().delete(accessToken, iModelId, subscription.wsgId);
    chai.expect(event).instanceof(CodeEvent);
  });

  it("should delete all briefcases", async () => {
    let requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    const requestObject = responseBuilder.generateObject<Briefcase>(Briefcase, new Map<string, any>([
                                                            ["briefcaseId", 1234],
                                                           ]));
    let requestResponse = responseBuilder.generateGetResponse<Briefcase>(requestObject, 3);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase", "1234");
    responseBuilder.MockResponse(RequestType.Delete, requestPath, "", 3);

    const promises = new Array<Promise<void>>();
    let briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(imodelHubClient.Briefcases().delete(accessToken, iModelId, briefcase.briefcaseId!));
    });
    await Promise.all(promises);

    requestResponse = responseBuilder.generateGetResponse<Briefcase>(new Briefcase(), 0);
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    briefcases = await imodelHubClient.Briefcases().get(accessToken, iModelId);
    chai.expect(briefcases.length).equals(0);
  });

  it("should get the thumbnail as a PNG file", async () => {
    const pngPrefixStr = "data:image/png;base64,iVBORw0KGgo"; // From 64bit encoding of bytes [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    let response = pngPrefixStr;
    let requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "SmallThumbnail", iModelId + "/$file");

    for (let i = 0; i < 3500; i++) { response += "a"; }
    responseBuilder.MockResponse(RequestType.Get, requestPath, response);

    const smallImage: string = await imodelHubClient.Thumbnails().get(accessToken, projectId, iModelId, "Small");
    chai.expect(smallImage.length).greaterThan(1000);
    chai.expect(smallImage.startsWith(pngPrefixStr));

    requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "LargeThumbnail", iModelId + "/$file");
    responseBuilder.MockResponse(RequestType.Get, requestPath, response);

    const largeImage: string = await imodelHubClient.Thumbnails().get(accessToken, projectId, iModelId, "Large");
    chai.expect(largeImage.length).greaterThan(3500);
    chai.expect(largeImage.startsWith(pngPrefixStr));
  });

  it("should fail creating existing and initialized iModel", async () => {
    if (!TestConfig.enableNock)
      return;
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel");
    const requestResponse = responseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
                                                          new Map<string, any>([["iModelInitialized", true]]));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, undefined, undefined, 409);

    await imodelHubClient.IModels().create(accessToken, projectId, TestConfig.iModelName,
                    downloadToPath + "empty-files/empty.bim")
                    .should.eventually.be.rejectedWith(IModelHubResponseError)
                    .and.have.property("id", IModelHubResponseErrorId.iModelAlreadyExists);
  });

  it("should create iModel and upload SeedFile", async () => {
    if (!TestConfig.enableNock)
      return;
    let requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel");
    let postBody = responseBuilder.generatePostBody<IModel>(
                      responseBuilder.generateObject<IModel>(IModel,
                        new Map<string, any>([["name", TestConfig.iModelName]])));
    let requestResponse = responseBuilder.generatePostResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
                                new Map<string, any>([
                                  ["wsgId", iModelId],
                                  ["name", TestConfig.iModelName],
                                  ["initialized", true],
                                ])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    // SeedFile upload
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "SeedFile");
    postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                          new Map<string, any>([["fileName", "empty.bim"], ["fileSize", "0"]])));
    requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                                new Map<string, any>([
                                  ["wsgId", "00000000-0000-0000-0000-000000000000"],
                                  ["fileId", "123456"],
                                  ["fileName", "empty.bim"],
                                  ["uploadUrl", `https://qa-imodelhubapi.bentley.com/imodelhub-${iModelId}/123456`],
                                ])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    // SeedFile upload to blob storage
    responseBuilder.MockResponse(RequestType.Put, `/imodelhub-${iModelId}/123456`, "");
    // confirmSeedFile
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "SeedFile", "00000000-0000-0000-0000-000000000000");
    postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
      new Map<string, any>([["wsgId", "00000000-0000-0000-0000-000000000000"], ["fileName", "empty.bim"], ["fileId", "123456"], ["isUploaded", true]])));

    requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                                new Map<string, any>([
                                  ["fileId", "123456"],
                                  ["wsgId", "00000000-0000-0000-0000-000000000000"],
                                  ["isUploaded", true],
                                ])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    // get SeedFile initialization state
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "SeedFile");
    requestResponse = responseBuilder.generateGetResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                       new Map<string, any>([["initializationState", 0]])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, TestConfig.iModelName,
                      downloadToPath + "empty-files/empty.bim");

    chai.expect(iModel.wsgId).equals(iModelId);
    chai.expect(iModel.name).equals(TestConfig.iModelName);
    chai.expect(iModel.initialized).equals(true);
  });

  it("should continue creating not initialized iModel", async () => {
    if (!TestConfig.enableNock)
      return;
    let requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel");
    let postBody = responseBuilder.generatePostBody<IModel>(
                      responseBuilder.generateObject<IModel>(IModel,
                        new Map<string, any>([["name", TestConfig.iModelName]])));
    let requestResponse = responseBuilder.generateError("iModelHub.iModelAlreadyExists", "iModel already exists", undefined,
                                                          new Map<string, any>([["iModelInitialized", false]]));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);

    requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel", `?$filter=Name+eq+%27${TestConfig.iModelName}%27`);
    requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
                        new Map<string, any>([
                          ["wsgId", iModelId],
                          ["name", TestConfig.iModelName],
                          ["initialized", true],
                        ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    // SeedFile upload
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "SeedFile");
    postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                                              new Map<string, any>([["fileName", "empty.bim"], ["fileSize", "0"]])));
    requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                                new Map<string, any>([
                                  ["wsgId", "00000000-0000-0000-0000-000000000000"],
                                  ["fileId", "123456"],
                                  ["fileName", "empty.bim"],
                                  ["uploadUrl", `https://qa-imodelhubapi.bentley.com/imodelhub-${iModelId}/123456`],
                                ])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    // SeedFile upload to blob storage
    responseBuilder.MockResponse(RequestType.Put, `/imodelhub-${iModelId}/123456`, "");
    // confirmSeedFile
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "SeedFile", "00000000-0000-0000-0000-000000000000");
    postBody = responseBuilder.generatePostBody<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
      new Map<string, any>([["wsgId", "00000000-0000-0000-0000-000000000000"], ["fileName", "empty.bim"], ["fileId", "123456"], ["isUploaded", true]])));

    requestResponse = responseBuilder.generatePostResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                                new Map<string, any>([
                                  ["fileId", "123456"],
                                  ["wsgId", "00000000-0000-0000-0000-000000000000"],
                                  ["isUploaded", true],
                                ])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    // get SeedFile initialization state
    requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "SeedFile");
    requestResponse = responseBuilder.generateGetResponse<SeedFile>(responseBuilder.generateObject<SeedFile>(SeedFile,
                       new Map<string, any>([["initializationState", 0]])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    const iModel = await imodelHubClient.IModels().create(accessToken, projectId, TestConfig.iModelName,
      downloadToPath + "empty-files/empty.bim");

    chai.expect(iModel.wsgId).equals(iModelId);
    chai.expect(iModel.name).equals(TestConfig.iModelName);
    chai.expect(iModel.initialized).equals(true);
  });
});
