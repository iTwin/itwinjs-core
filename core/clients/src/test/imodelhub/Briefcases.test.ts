/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";
import * as fs from "fs";
import * as path from "path";

import { TestConfig } from "../TestConfig";

import { IModel, Briefcase, EventSubscription, IModelHubRequestError,
  IModelHubRequestErrorId, IModelQuery, BriefcaseQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AuthorizationToken, AccessToken } from "../../Token";
import { ConnectClient, Project } from "../../ConnectClients";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";

declare const __dirname: string;

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

describe("iModelHub BriefcaseHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  // let seedFileId: string;
  let briefcaseId: number;
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

  function generateBriefcase(id: number): Briefcase {
    return responseBuilder.generateObject<Briefcase>(Briefcase, new Map<string, any>([["briefcaseId", id]]));
  }

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
});
