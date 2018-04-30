/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";

import { TestConfig } from "../TestConfig";

import { IModel, IModelQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AuthorizationToken, AccessToken } from "../../Token";
import { ConnectClient, Project } from "../../ConnectClients";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

describe("iModelHub ThumbnailHandler", () => {
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
});
