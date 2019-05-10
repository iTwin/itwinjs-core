/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import * as path from "path";
import { GuidString } from "@bentley/bentleyjs-core";
import {
  AccessToken, IModelClient, Briefcase, ChangeSet, Checkpoint, CheckpointQuery, AuthorizedClientRequestContext,
} from "@bentley/imodeljs-clients";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import { TestUsers } from "../TestUsers";
import * as utils from "./TestUtils";

chai.should();

function mockGetCheckpoint(imodelId: GuidString, query?: string, ...checkpoints: Checkpoint[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "Checkpoint", query);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Checkpoint>(checkpoints);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockCheckpoint(mergedChangeSetId: string, mockUrl: boolean = false): Checkpoint {
  const result = new Checkpoint();
  result.mergedChangeSetId = mergedChangeSetId;
  if (mockUrl)
    result.downloadUrl = "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile";
  result.fileName = "Test.bim";
  result.fileSize = utils.getMockFileSize();
  return result;
}

describe("iModelHub CheckpointHandler", () => {
  let imodelId: GuidString;
  let iModelClient: IModelClient;
  let briefcase: Briefcase;
  let changeSets: ChangeSet[];
  const imodelName = "imodeljs-clients Checkpoints test";
  let requestContext: AuthorizedClientRequestContext;

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext(accessToken);

    await utils.createIModel(requestContext, imodelName);
    imodelId = await utils.getIModelId(requestContext, imodelName);
    iModelClient = utils.getDefaultClient();
    briefcase = (await utils.getBriefcases(requestContext, imodelId, 1))[0];

    // Ensure that at least 3 exist
    changeSets = await utils.createChangeSets(requestContext, imodelId, briefcase, 0, 3);

    if (!TestConfig.enableMocks) {
      const checkpoints = await iModelClient.checkpoints.get(requestContext, imodelId);
      if (checkpoints.length === 0)
        this.skip();
    }

    if (!fs.existsSync(utils.workDir)) {
      fs.mkdirSync(utils.workDir);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should query and download Checkpoint", async function (this: Mocha.ITestCallbackContext) {
    mockGetCheckpoint(imodelId, `?$select=*,FileAccessKey-forward-AccessKey.DownloadURL`, mockCheckpoint("", true));
    const checkpoints = await iModelClient.checkpoints.get(requestContext, imodelId, new CheckpointQuery().selectDownloadUrl());
    chai.assert(checkpoints);
    chai.expect(checkpoints.length).to.be.equal(1);
    chai.assert(checkpoints[0].downloadUrl);

    utils.mockFileResponse(2);
    const progressTracker = new utils.ProgressTracker();
    await iModelClient.checkpoints.download(requestContext, checkpoints[0], path.join(utils.workDir, checkpoints[0].fileName!), progressTracker.track());
    progressTracker.check();
  });

  it("should query Checkpoint by id", async function (this: Mocha.ITestCallbackContext) {
    mockGetCheckpoint(imodelId, `?$filter=MergedChangeSetId+eq+%27${changeSets[2].id!}%27`, mockCheckpoint(changeSets[2].id!));
    const checkpoints = await iModelClient.checkpoints.get(requestContext, imodelId, new CheckpointQuery().byChangeSetId(changeSets[2].id!));
    chai.assert(checkpoints);
    chai.expect(checkpoints.length).to.be.equal(1);
  });

  it("should query nearest Checkpoint", async function (this: Mocha.ITestCallbackContext) {
    mockGetCheckpoint(imodelId, `?$filter=NearestCheckpoint-backward-ChangeSet.Id+eq+%27${changeSets[0].id!}%27`, mockCheckpoint(""));
    const checkpoints1 = await iModelClient.checkpoints.get(requestContext, imodelId, new CheckpointQuery().nearestCheckpoint(changeSets[0].id!));
    chai.assert(checkpoints1);
    chai.expect(checkpoints1.length).to.be.equal(1);
    chai.expect(checkpoints1[0].mergedChangeSetId).to.be.equal("");

    mockGetCheckpoint(imodelId, `?$filter=NearestCheckpoint-backward-ChangeSet.Id+eq+%27${changeSets[1].id!}%27`, mockCheckpoint(changeSets[2].id!));
    const checkpoints2 = await iModelClient.checkpoints.get(requestContext, imodelId, new CheckpointQuery().nearestCheckpoint(changeSets[1].id!));
    chai.assert(checkpoints2);
    chai.expect(checkpoints2.length).to.be.equal(1);
    chai.expect(checkpoints2[0].mergedChangeSetId).to.be.equal(changeSets[2].id!);
  });

  it("should query preceding Checkpoint", async function (this: Mocha.ITestCallbackContext) {
    mockGetCheckpoint(imodelId, `?$filter=PrecedingCheckpoint-backward-ChangeSet.Id+eq+%27${changeSets[1].id!}%27`, mockCheckpoint(""));
    const checkpoints1 = await iModelClient.checkpoints.get(requestContext, imodelId, new CheckpointQuery().precedingCheckpoint(changeSets[1].id!));
    chai.assert(checkpoints1);
    chai.expect(checkpoints1.length).to.be.equal(1);
    chai.expect(checkpoints1[0].mergedChangeSetId).to.be.equal("");

    mockGetCheckpoint(imodelId, `?$filter=PrecedingCheckpoint-backward-ChangeSet.Id+eq+%27${changeSets[2].id!}%27`, mockCheckpoint(changeSets[2].id!));
    const checkpoints2 = await iModelClient.checkpoints.get(requestContext, imodelId, new CheckpointQuery().precedingCheckpoint(changeSets[2].id!));
    chai.assert(checkpoints2);
    chai.expect(checkpoints2.length).to.be.equal(1);
    chai.expect(checkpoints2[0].mergedChangeSetId).to.be.equal(changeSets[2].id!);
  });
});
