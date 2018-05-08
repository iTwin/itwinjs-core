/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { Version, VersionQuery, Briefcase, ChangeSet } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder } from "../ResponseBuilder";
import * as utils from "./TestUtils";

chai.should();

describe.skip("iModelHub VersionHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let briefcase: Briefcase;
  const imodelName = "imodeljs-clients Versions test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();

  before(async () => {
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    if (!TestConfig.enableMocks) {
      const changeSetCount = (await imodelHubClient.ChangeSets().get(accessToken, iModelId)).length;
      if (changeSetCount > 9) {
        // Recreate iModel if can't create any new changesets
        await utils.createIModel(accessToken, imodelName, undefined, true);
        iModelId = await utils.getIModelId(accessToken, imodelName);
      }
      const versionsCount = (await imodelHubClient.Versions().get(accessToken, iModelId)).length;
      if (versionsCount === 0) {
        // Create at least 1 named version
        let changeSet: ChangeSet;
        if (changeSetCount === 0 || changeSetCount > 9) {
          changeSet = (await utils.createChangeSets(accessToken, iModelId, briefcase, 0, 1))[0];
        } else {
          changeSet = (await imodelHubClient.ChangeSets().get(accessToken, iModelId))[0];
        }
        await imodelHubClient.Versions().create(accessToken, iModelId, changeSet.id!, "Version 1");
      }
    }
    briefcase = (await utils.getBriefcases(accessToken, iModelId, 1))[0];
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should create named version", async function (this: Mocha.ITestCallbackContext) {
    const mockedChangeSets = Array(1).fill(0).map(() => utils.generateChangeSet());
    utils.mockGetChangeSet(iModelId, false, ...mockedChangeSets);
    const changeSetsCount = (await imodelHubClient.ChangeSets().get(accessToken, iModelId)).length;

    // creating changeset for new named version
    const changeSet = (await utils.createChangeSets(accessToken, iModelId, briefcase, changeSetsCount, 1))[0];

    const versionName = `Version ${changeSetsCount}`;
    utils.mockCreateVersion(iModelId, versionName, changeSet.id);
    const version: Version = await imodelHubClient.Versions().create(accessToken, iModelId, changeSet.id!, versionName);

    chai.assert(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(changeSet.id);
    chai.expect(version.name).to.be.equal(versionName);
  });

  it("should get named versions", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersions = Array(3).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, ...mockedVersions);
    // Needs to create before expecting more than 0
    const versions: Version[] = await imodelHubClient.Versions().get(accessToken, iModelId);

    let i = 0;
    for (const expectedVersion of versions) {
      utils.mockGetVersionById(iModelId, mockedVersions[i++]);
      const actualVersion: Version = (await imodelHubClient.Versions().get(accessToken, iModelId, new VersionQuery().byId(expectedVersion.wsgId)))[0];
      chai.expect(!!actualVersion);
      chai.expect(actualVersion.changeSetId).to.be.equal(expectedVersion.changeSetId);
    }
  });

  it("should update named version", async function (this: Mocha.ITestCallbackContext) {
    const mockedVersions = Array(1).fill(0).map(() => utils.generateVersion());
    utils.mockGetVersions(iModelId, ...mockedVersions);

    let version: Version = (await imodelHubClient.Versions().get(accessToken, iModelId))[0];
    chai.assert(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);

    version.name += "+";
    utils.mockUpdateVersion(iModelId, version);
    version = await imodelHubClient.Versions().update(accessToken, iModelId, version);

    chai.assert(!!version);
    chai.expect(version.wsgId).to.have.length.above(0);
    chai.expect(version.changeSetId).to.be.equal(version.changeSetId!);
    chai.expect(version.name).to.be.equal(version.name!);
  });
});
