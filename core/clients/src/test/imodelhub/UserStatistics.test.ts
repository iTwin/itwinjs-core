/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { UserStatisticsQuery, UserStatistics } from "../../imodelhub/UserStatistics";
import { TestUsers } from "../TestConfig";

chai.should();

function mockGetUserStatistics(iModelId: string, query: UserStatisticsQuery, userStatistics: UserStatistics[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "UserInfo",
    `${query.getId() || ""}?$select=${query.getQueryOptions().$select}`);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<UserStatistics>(userStatistics);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

function generateUsersStatistics(count: number, userIds: string[], briefcasesCount?: number[], ownedLocksCount?: number[], pushedChangesetsCount?: number[]): UserStatistics[] {
  const statistics: UserStatistics[] = [];

  for (let i = 0; i < count; i++) {
    statistics.push(generateUserStatistics((userIds !== undefined) ? userIds[i] : undefined,
      (briefcasesCount !== undefined) ? briefcasesCount[i] : undefined,
      (ownedLocksCount !== undefined) ? ownedLocksCount[i] : undefined,
      (pushedChangesetsCount !== undefined) ? pushedChangesetsCount[i] : undefined));
  }

  return statistics;
}

function generateUserStatistics(userId?: string, briefcasesCount?: number, ownedLocksCount?: number,
  pushedChangesetsCount?: number, lastChangeSetPushDate?: string): UserStatistics {
  const userStatistics = new UserStatistics();
  if (userId !== undefined) {
    userStatistics.wsgId = userId;
  }
  userStatistics.briefcasesCount = briefcasesCount;
  userStatistics.ownedLocksCount = ownedLocksCount;
  userStatistics.pushedChangeSetsCount = pushedChangesetsCount;
  userStatistics.lastChangeSetPushDate = lastChangeSetPushDate;
  return userStatistics;
}

describe("iModelHubClient UserStatisticsHandler", () => {
  let accessToken: AccessToken;
  let accessToken2: AccessToken;
  let iModelId: string;

  const imodelName = "imodeljs-clients Statistics test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();

  const user1BriefcasesCount = 2;
  const user1OwnedLocksCount = 1;
  const user1PushedChangesetsCount = 1;

  const user2BriefcasesCount = 1;
  const user2OwnedLocksCount = 1;
  const user2PushedChangesetsCount = 0;

  before(async function (this: Mocha.IHookCallbackContext) {
    accessToken = await utils.login();
    accessToken2 = await utils.login(TestUsers.regular);
    await utils.createIModel(accessToken, imodelName, undefined, true);
    iModelId = await utils.getIModelId(accessToken, imodelName);

    if (!TestConfig.enableMocks) {
      // generate data for user statistics
      // user 1
      if (user1BriefcasesCount > 0) {
        const briefcases = await utils.getBriefcases(accessToken, iModelId, user1BriefcasesCount);
        await utils.createChangeSets(accessToken, iModelId, briefcases[0], 0, user1PushedChangesetsCount);
        await utils.createLocks(accessToken, iModelId, briefcases[0], user1OwnedLocksCount);
      }
      // user 2
      if (user2BriefcasesCount > 0) {
        const briefcases = await utils.getBriefcases(accessToken2, iModelId, user1BriefcasesCount + user2BriefcasesCount);
        await utils.createChangeSets(accessToken2, iModelId, briefcases[user1BriefcasesCount], user1PushedChangesetsCount, user2PushedChangesetsCount);
        await utils.createLocks(accessToken2, iModelId, briefcases[user1BriefcasesCount], user2OwnedLocksCount);
      }
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should get user briefcases count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessToken.getUserProfile()!.userId).selectBriefcasesCount();
    mockGetUserStatistics(iModelId, query, [generateUserStatistics(accessToken.getUserProfile()!.userId, user1BriefcasesCount)]);

    const briefcasesCount = await imodelHubClient.UserStatistics().GetUserStatistics(accessToken, iModelId, query);

    chai.assert(briefcasesCount);
    chai.expect(briefcasesCount.briefcasesCount).to.be.equal(user1BriefcasesCount);
  });

  it("should get user owned locks count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessToken.getUserProfile()!.userId).selectOwnedLocksCount();
    mockGetUserStatistics(iModelId, query, [generateUserStatistics(accessToken.getUserProfile()!.userId, undefined,
      user1OwnedLocksCount)]);

    const ownedLocksCount = await imodelHubClient.UserStatistics().GetUserStatistics(accessToken, iModelId, query);

    chai.assert(ownedLocksCount);
    chai.expect(ownedLocksCount.ownedLocksCount).to.be.equal(user1OwnedLocksCount);
  });

  it("should get user pushed changesets count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessToken.getUserProfile()!.userId).selectPushedChangeSetsCount();
    mockGetUserStatistics(iModelId, query, [generateUserStatistics(accessToken.getUserProfile()!.userId, undefined,
      undefined, user1PushedChangesetsCount)]);

    const pushedChangesetsCount = await imodelHubClient.UserStatistics().GetUserStatistics(accessToken, iModelId,
      query);

    chai.assert(pushedChangesetsCount);
    chai.expect(pushedChangesetsCount.pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
  });

  it("should get user last changeset push date", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessToken.getUserProfile()!.userId).selectLastChangeSetPushDate();
    mockGetUserStatistics(iModelId, query, [generateUserStatistics(accessToken.getUserProfile()!.userId, undefined,
      undefined, undefined, "date")]);

    const lastChangeSetPushDate = await imodelHubClient.UserStatistics().GetUserStatistics(accessToken, iModelId,
      query);

    chai.assert(lastChangeSetPushDate);
    chai.assert(lastChangeSetPushDate.lastChangeSetPushDate);
    chai.expect(lastChangeSetPushDate.lastChangeSetPushDate!.length > 1);
  });

  it("should get user pushed changesets count and last changeset push date", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessToken.getUserProfile()!.userId)
      .selectPushedChangeSetsCount().selectLastChangeSetPushDate();
    mockGetUserStatistics(iModelId, query, [generateUserStatistics(accessToken.getUserProfile()!.userId, undefined,
      undefined, user1PushedChangesetsCount, "date")]);

    const changesetStatistics = await imodelHubClient.UserStatistics().GetUserStatistics(accessToken, iModelId,
      query);

    chai.assert(changesetStatistics);
    chai.expect(changesetStatistics.lastChangeSetPushDate!.length > 1);
    chai.expect(changesetStatistics.pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
  });

  it("should get briefcases and owned locks count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessToken.getUserProfile()!.userId).selectBriefcasesCount().selectOwnedLocksCount();
    mockGetUserStatistics(iModelId, query, [generateUserStatistics(accessToken.getUserProfile()!.userId, user1BriefcasesCount, user1OwnedLocksCount)]);

    const briefcasesLocksStatistics = await imodelHubClient.UserStatistics().GetUserStatistics(accessToken, iModelId,
      query);

    chai.assert(briefcasesLocksStatistics);
    chai.expect(briefcasesLocksStatistics.ownedLocksCount).to.be.equal(user1OwnedLocksCount);
    chai.expect(briefcasesLocksStatistics.briefcasesCount).to.be.equal(user1BriefcasesCount);
  });

  it("should get all iModel users Briefcases count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().selectBriefcasesCount();
    mockGetUserStatistics(iModelId, query,
      generateUsersStatistics(2, [accessToken2.getUserProfile()!.userId, accessToken.getUserProfile()!.userId],
        [user2BriefcasesCount, user1BriefcasesCount]));

    const iModelStatistics = await imodelHubClient.UserStatistics().GetAllUsersStatistics(accessToken, iModelId, query);

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    chai.expect(iModelStatistics[1].briefcasesCount).to.be.equal(user1BriefcasesCount);
    chai.expect(iModelStatistics[0].briefcasesCount).to.be.equal(user2BriefcasesCount);
  });

  it("should get all iModel statistics", async function (this: Mocha.ITestCallbackContext) {
    mockGetUserStatistics(iModelId, new UserStatisticsQuery().selectAll(),
      generateUsersStatistics(2, [accessToken2.getUserProfile()!.userId, accessToken.getUserProfile()!.userId],
        [user2BriefcasesCount, user1BriefcasesCount],
        [user2OwnedLocksCount, user1OwnedLocksCount], [user2PushedChangesetsCount, user1PushedChangesetsCount]));

    const iModelStatistics = await imodelHubClient.UserStatistics().GetAllUsersStatistics(accessToken, iModelId);

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    chai.expect(iModelStatistics[1].ownedLocksCount).to.be.equal(user1OwnedLocksCount);
    chai.expect(iModelStatistics[1].briefcasesCount).to.be.equal(user1BriefcasesCount);
    chai.expect(iModelStatistics[1].pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
    chai.expect(iModelStatistics[0].ownedLocksCount).to.be.equal(user2OwnedLocksCount);
    chai.expect(iModelStatistics[0].briefcasesCount).to.be.equal(user2BriefcasesCount);
    chai.expect(iModelStatistics[0].pushedChangeSetsCount).to.be.equal(user2PushedChangesetsCount);
  });
});
