/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";

import { TestConfig } from "../TestConfig";

import { SeedFile, Version, VersionQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import * as utils from "./TestUtils";

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

describe("iModelHub VersionHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    accessToken = await utils.login();
    iModelId = await utils.getIModelId(accessToken);
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  (TestConfig.enableMocks ? it : it.skip)("should get named versions", async () => {
    const versionsCount = 3;
    const responseObject = responseBuilder.generateObject<Version>(Version, new Map<string, any>([
                                                              ["wsgId", "00000000-0000-0000-0000-000000000000"],
                                                              ["name", "TestModel"],
                                                              ["changesetId", "0123456789"],
                                                            ]));
    let requestPath = responseBuilder.createRequestUrl(ScopeType.iModel, iModelId, "Version");
    let requestResponse = responseBuilder.generateGetResponse<SeedFile>(responseObject, versionsCount);
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);

    // Needs to create before expecting more than 0
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
