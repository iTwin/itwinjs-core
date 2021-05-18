/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import { GuidString } from "@bentley/bentleyjs-core";
import { Briefcase, ChangeSet, CheckpointV2, CheckpointV2ErrorId, CheckpointV2Query, CheckpointV2State, IModelClient } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";
import { workDir } from "./TestConstants";

chai.should();

function mockContainerAccessKey(checkpoint: CheckpointV2) {
  checkpoint.containerAccessKeyAccount = "imodelhubdevsatest";
  checkpoint.containerAccessKeyContainer = "imodelblocks-3101cca9-707c-4c82-8ef4-7afccfbd2421";
  checkpoint.containerAccessKeySAS = "?sv=2018-03-28&sr=....";
  checkpoint.containerAccessKeyDbName = "a016840dd72272624a3b2afb56e5bc51b8874584.bim";
}

function mockGetCheckpointV2(imodelId: GuidString, query?: string, ...checkpoints: CheckpointV2[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "CheckpointV2", query);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<CheckpointV2>(checkpoints);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockCreateCheckpointV2(imodelId: GuidString, id?: number, checkpoint: CheckpointV2 = ResponseBuilder.generateObject<CheckpointV2>(CheckpointV2)) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "CheckpointV2");
  const postBody = ResponseBuilder.generatePostBody<CheckpointV2>(checkpoint);

  const responseCheckpoint = new CheckpointV2();
  responseCheckpoint.state = checkpoint.state ?? CheckpointV2State.InProgress;
  responseCheckpoint.changeSetId = checkpoint.changeSetId;
  if (!!id) {
    responseCheckpoint.wsgId = id.toString();
  }

  if (responseCheckpoint.state === CheckpointV2State.InProgress) {
    mockContainerAccessKey(responseCheckpoint);
  }

  const requestResponse = ResponseBuilder.generatePostResponse<CheckpointV2>(responseCheckpoint);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUpdateCheckpointV2(imodelId: GuidString, checkpoint: CheckpointV2) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId.toString(), "CheckpointV2", checkpoint.wsgId);
  const requestResponse = ResponseBuilder.generatePostResponse(checkpoint);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse);
}

function mockCheckpointV2(changeSetId: string, state: CheckpointV2State, id?: string, mockAccessKey: boolean = false, errorId?: CheckpointV2ErrorId,
  failedChangeSetId?: string, jobId?: string, jobRunDurationMS?: string): CheckpointV2 {
  const result = new CheckpointV2();
  result.changeSetId = changeSetId;
  result.state = state;
  if (!!id) {
    result.wsgId = id;
  }

  result.failureInfoErrorId = errorId;
  result.failureInfoFailedChangeSetId = failedChangeSetId;
  result.failureInfoJobId = jobId;
  result.failureInfoJobRunDurationMS = jobRunDurationMS;

  if (mockAccessKey) {
    mockContainerAccessKey(result);
  }
  return result;
}

function assertContainerAccessKey(checkpoint: CheckpointV2) {
  chai.assert(checkpoint.containerAccessKeyAccount);
  chai.expect(checkpoint.containerAccessKeyAccount!.length).to.be.greaterThan(0);
  chai.assert(checkpoint.containerAccessKeyContainer);
  chai.assert(checkpoint.containerAccessKeyContainer!.startsWith("imodelblocks-"));
  chai.assert(checkpoint.containerAccessKeySAS);
  chai.assert(checkpoint.containerAccessKeySAS!.startsWith("?sv="));
  chai.assert(checkpoint.containerAccessKeyDbName);
  chai.assert(checkpoint.containerAccessKeyDbName!.endsWith(".bim"));
}

describe("iModelHub CheckpointV2Handler", () => {
  let contextId: string;
  let imodelId: GuidString;
  let iModelClient: IModelClient;
  let briefcase: Briefcase;
  let changeSets: ChangeSet[];
  let requestContext: AuthorizedClientRequestContext;

  before(async function () {
    this.timeout(0);
    const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext(accessToken);

    contextId = await utils.getProjectId(requestContext);
    await utils.createIModel(requestContext, utils.sharedimodelName, contextId, true, true);
    imodelId = await utils.getIModelId(requestContext, utils.sharedimodelName, contextId);
    iModelClient = utils.getDefaultClient();
    briefcase = (await utils.getBriefcases(requestContext, imodelId, 1))[0];

    // Ensure that at least 3 exist
    changeSets = await utils.createChangeSets(requestContext, imodelId, briefcase, 0, 3);

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir);
    }
  });

  after(async () => {
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(requestContext, contextId, utils.sharedimodelName);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  // CheckpointV2 not in QA yet, make unit tests until they can be reenabled as integration tests
  it("should query CheckpointsV2 with ContainerAccessKey (#unit)", async () => {
    mockGetCheckpointV2(imodelId, `?$select=*,HasContainer-forward-ContainerAccessKey.*`, mockCheckpointV2("", CheckpointV2State.Successful, "1", true));
    const checkpoints = await iModelClient.checkpointsV2.get(requestContext, imodelId, new CheckpointV2Query().selectContainerAccessKey());
    chai.assert(checkpoints);
    chai.expect(checkpoints.length).to.be.equal(1);
    assertContainerAccessKey(checkpoints[0]);
  });

  // CheckpointV2 not in QA yet, make unit tests until they can be reenabled as integration tests
  it("should create successful CheckpointV2 (#unit)", async () => {
    const changeSetId = changeSets[2].id!;
    const createCheckpoint = new CheckpointV2();
    createCheckpoint.changeSetId = changeSetId;

    // Create InProgress CheckpointV2
    mockCreateCheckpointV2(imodelId, 2, createCheckpoint);
    const createdCheckpoint = await iModelClient.checkpointsV2.create(requestContext, imodelId, createCheckpoint);
    chai.assert(createdCheckpoint);
    chai.expect(!!createdCheckpoint.wsgId);
    chai.expect(createdCheckpoint.changeSetId).to.be.eq(changeSetId);
    chai.expect(createdCheckpoint.state).to.be.eq(CheckpointV2State.InProgress);
    assertContainerAccessKey(createdCheckpoint);

    // Update CheckpointV2 to Successful state
    const checkpointToUpdate = new CheckpointV2();
    checkpointToUpdate.wsgId = createdCheckpoint.wsgId;
    checkpointToUpdate.state = CheckpointV2State.Successful;
    mockUpdateCheckpointV2(imodelId, checkpointToUpdate);
    const updatedCheckpoint = await iModelClient.checkpointsV2.update(requestContext, imodelId, checkpointToUpdate);
    chai.assert(updatedCheckpoint);
    chai.expect(updatedCheckpoint.containerAccessKeyAccount).to.be.undefined;
    chai.expect(updatedCheckpoint.state).to.be.eq(CheckpointV2State.Successful);

    // Verify CheckpointV2 was updated
    mockGetCheckpointV2(imodelId, `?$filter=ChangeSetId+eq+%27${changeSetId}%27`, mockCheckpointV2(changeSetId, CheckpointV2State.Successful, createdCheckpoint.wsgId));
    const checkpoints = await iModelClient.checkpointsV2.get(requestContext, imodelId, new CheckpointV2Query().byChangeSetId(changeSetId));
    chai.assert(checkpoints);
    chai.expect(checkpoints.length).to.be.equal(1);
    chai.expect(checkpoints[0].wsgId).to.be.equal(createdCheckpoint.wsgId);
    chai.expect(checkpoints[0].state).to.be.equal(CheckpointV2State.Successful);

    // Verify preceding CheckpointV2
    await verifyPrecedingCheckpointV2(changeSetId, changeSetId);
    await verifyPrecedingCheckpointV2(changeSets[1].id!, "");
    await verifyPrecedingCheckpointV2(changeSets[0].id!, "");
  });

  async function verifyPrecedingCheckpointV2(changeSetId: string, expectedPrecedingChangeSetId: string) {
    mockGetCheckpointV2(imodelId, `?$filter=PrecedingCheckpointV2-backward-ChangeSet.Id+eq+%27${changeSetId}%27`, mockCheckpointV2(expectedPrecedingChangeSetId, CheckpointV2State.Successful, "1"));
    const checkpoints = await iModelClient.checkpointsV2.get(requestContext, imodelId, new CheckpointV2Query().precedingCheckpointV2(changeSetId));
    chai.assert(checkpoints);
    chai.expect(checkpoints.length).to.be.equal(1);
    chai.expect(checkpoints[0].changeSetId).to.be.equal(expectedPrecedingChangeSetId);
    chai.expect(checkpoints[0].state).to.be.equal(CheckpointV2State.Successful);
  }

  // CheckpointV2 not in QA yet, make unit tests until they can be reenabled as integration tests
  it("should create failed CheckpointV2 (#unit)", async () => {
    const changeSetId = changeSets[1].id!;
    const createCheckpoint = new CheckpointV2();
    createCheckpoint.changeSetId = changeSetId;

    // Create InProgress CheckpointV2
    mockCreateCheckpointV2(imodelId, 2, createCheckpoint);
    const createdCheckpoint = await iModelClient.checkpointsV2.create(requestContext, imodelId, createCheckpoint);
    chai.assert(createdCheckpoint);
    chai.expect(!!createdCheckpoint.wsgId);
    chai.expect(createdCheckpoint.changeSetId).to.be.eq(changeSetId);
    chai.expect(createdCheckpoint.state).to.be.eq(CheckpointV2State.InProgress);
    assertContainerAccessKey(createdCheckpoint);

    // Update CheckpointV2 to Failed state
    const checkpointToUpdate = new CheckpointV2();
    checkpointToUpdate.wsgId = createdCheckpoint.wsgId;
    checkpointToUpdate.state = CheckpointV2State.Failed;
    checkpointToUpdate.failureInfoErrorId = CheckpointV2ErrorId.ApplyChangeSetError;
    checkpointToUpdate.failureInfoFailedChangeSetId = changeSetId;
    checkpointToUpdate.failureInfoJobId = "jobId";
    checkpointToUpdate.failureInfoJobRunDurationMS = "1500";
    mockUpdateCheckpointV2(imodelId, checkpointToUpdate);
    const updatedCheckpoint = await iModelClient.checkpointsV2.update(requestContext, imodelId, checkpointToUpdate);
    chai.assert(updatedCheckpoint);
    chai.expect(updatedCheckpoint.containerAccessKeyAccount).to.be.undefined;
    chai.expect(updatedCheckpoint.state).to.be.eq(CheckpointV2State.Failed);

    // Verify CheckpointV2 was created
    const queryResultCheckpoint = mockCheckpointV2(changeSetId, CheckpointV2State.Failed, createdCheckpoint.wsgId, false, CheckpointV2ErrorId.ApplyChangeSetError,
      changeSetId, "jobId", "1500");
    mockGetCheckpointV2(imodelId, `?$filter=ChangeSetId+eq+%27${changeSetId}%27&$select=*,HasCheckpointV2FailureInfo-forward-CheckpointV2FailureInfo.*`,
      queryResultCheckpoint);

    const checkpoints = await iModelClient.checkpointsV2.get(requestContext, imodelId, new CheckpointV2Query().byChangeSetId(changeSetId).selectFailureInfo());
    chai.assert(checkpoints);
    chai.expect(checkpoints.length).to.be.equal(1);
    const queriedCheckpoint = checkpoints[0];
    chai.expect(queriedCheckpoint.wsgId).to.be.equal(createdCheckpoint.wsgId);
    chai.expect(queriedCheckpoint.state).to.be.equal(CheckpointV2State.Failed);
    chai.expect(queriedCheckpoint.failureInfoErrorId).to.be.equal(CheckpointV2ErrorId.ApplyChangeSetError);
    chai.expect(queriedCheckpoint.failureInfoFailedChangeSetId).to.be.equal(changeSetId);
    chai.expect(queriedCheckpoint.failureInfoJobId).to.be.equal("jobId");
    chai.expect(queriedCheckpoint.failureInfoJobRunDurationMS).to.be.equal("1500");
  });
});
