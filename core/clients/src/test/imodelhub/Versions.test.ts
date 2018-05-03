/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { Version, VersionQuery } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import * as utils from "./TestUtils";

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

  it("should get named versions",  async function(this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(responseBuilder, iModelId, ...mockedVersions);
    // Needs to create before expecting more than 0
    const versions: Version[] = await imodelHubClient.Versions().get(accessToken, iModelId);
    chai.expect(versions.length).equals(3);

    let i = 0;
    for (const expectedVersion of versions) {
      utils.mockGetVersionById(responseBuilder, iModelId, mockedVersions[i++]);
      const actualVersion: Version = (await imodelHubClient.Versions().get(accessToken, iModelId, new VersionQuery().byId(expectedVersion.wsgId)))[0];
      chai.expect(!!actualVersion);
      chai.expect(actualVersion.changeSetId).to.be.equal(expectedVersion.changeSetId);
    }
  });
});
