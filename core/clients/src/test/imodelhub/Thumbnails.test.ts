/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import * as utils from "./TestUtils";

chai.should();

describe("iModelHub ThumbnailHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    accessToken = await utils.login();
    iModelId = await utils.getIModelId(accessToken);
    projectId = await utils.getProjectId();
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
