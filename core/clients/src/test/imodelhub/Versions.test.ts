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

  it("should get named versions", async function (this: Mocha.ITestCallbackContext) {
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

  it("should create named version", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const versionName = "Version name";
    const changeSetId = utils.generateChangeSetId();
    utils.mockCreateVersion(responseBuilder, iModelId, versionName, changeSetId);
    const version: Version = await imodelHubClient.Versions().create(accessToken, iModelId, changeSetId, versionName);

    chai.expect(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(changeSetId);
    chai.expect(version.name).to.be.equal(versionName);
  });

  it("should update named version", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const mockedVersion = utils.generateVersion();
    utils.mockGetVersions(responseBuilder, iModelId, mockedVersion);
    let version: Version = (await imodelHubClient.Versions().get(accessToken, iModelId))[0];

    chai.expect(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(mockedVersion.changeSetId!);
    chai.expect(version.name).to.be.equal(mockedVersion.name!);

    mockedVersion.name = "Updated name";
    utils.mockUpdateVersion(responseBuilder, iModelId, mockedVersion);
    version = await imodelHubClient.Versions().update(accessToken, iModelId, mockedVersion);

    chai.expect(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(mockedVersion.changeSetId!);
    chai.expect(version.name).to.be.equal(mockedVersion.name!);
  });
});
