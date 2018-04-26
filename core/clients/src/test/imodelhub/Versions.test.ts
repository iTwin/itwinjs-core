/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";

import { TestConfig } from "../TestConfig";

import { IModel, SeedFile, Version, IModelQuery, VersionQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AuthorizationToken, AccessToken } from "../../Token";
import { ConnectClient, Project } from "../../ConnectClients";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

describe("iModelHub VersionHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
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
  });

  afterEach(() => {
    responseBuilder.clearMocks();
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
});
