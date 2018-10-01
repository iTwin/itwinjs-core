/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { IModelHubClientError, IModelClient } from "../..";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { UserStatisticsQuery, UserStatistics } from "../../imodelhub";
import { TestUsers } from "../TestConfig";
import { IModelHubStatus, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

chai.should();

function mockGetUserStatistics(imodelId: Guid, userStatistics: UserStatistics[], query?: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestResponse = ResponseBuilder.generateGetArrayResponse<UserStatistics>(userStatistics);
  let requestPath;
  if (query === undefined) {
    requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "UserInfo", "$query");
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse);
  } else {
    requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "UserInfo", `${query ? query : ""}`);
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
  }
}

function generateUsersStatistics(count: number, userIds: string[], briefcasesCount?: number[], ownedLocksCount?: number[],
  pushedChangesetsCount?: number[], lastChangeSetPushDate?: string[]): UserStatistics[] {
  const statistics: UserStatistics[] = [];

  for (let i = 0; i < count; i++) {
    const userStatistics = new UserStatistics();
    if (userIds !== undefined) {
      userStatistics.wsgId = userIds[i];
    }

    userStatistics.briefcasesCount = briefcasesCount !== undefined ? briefcasesCount[i] : 0;
    userStatistics.ownedLocksCount = ownedLocksCount !== undefined ? ownedLocksCount[i] : 0;
    userStatistics.pushedChangeSetsCount = pushedChangesetsCount !== undefined ? pushedChangesetsCount[i] : 0;
    userStatistics.lastChangeSetPushDate = lastChangeSetPushDate !== undefined ? lastChangeSetPushDate[i] : "2018-05-01T12:00:00.36Z";

    statistics.push(userStatistics);
  }

  return statistics;
}

function sortStatistics(value: UserStatistics[]) {
  value.sort((a: UserStatistics, b: UserStatistics) => a.wsgId.localeCompare(b.wsgId));
}

describe("iModelHubClient UserStatisticsHandler", () => {
  const accessTokens: AccessToken[] = [];
  let imodelId: Guid;

  const imodelName = "imodeljs-clients Statistics test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();
  const actx = new ActivityLoggingContext("");

  const user1BriefcasesCount = 2;
  const user1OwnedLocksCount = 1;
  const user1PushedChangesetsCount = 1;

  const user2BriefcasesCount = 1;
  const user2OwnedLocksCount = 1;
  const user2PushedChangesetsCount = 0;

  before(async function (this: Mocha.IHookCallbackContext) {
    accessTokens.push(await utils.login());
    accessTokens.push(await utils.login(TestUsers.manager));
    await utils.createIModel(accessTokens[0], imodelName, undefined, true);
    imodelId = await utils.getIModelId(accessTokens[0], imodelName);

    if (!TestConfig.enableMocks) {
      // generate data for user statistics
      // user 1
      if (user1BriefcasesCount > 0) {
        const briefcases = await utils.getBriefcases(accessTokens[0], imodelId, user1BriefcasesCount);
        await utils.createChangeSets(accessTokens[0], imodelId, briefcases[0], 0, user1PushedChangesetsCount);
        await utils.createLocks(accessTokens[0], imodelId, briefcases[0], user1OwnedLocksCount);
      }
      // user 2
      if (user2BriefcasesCount > 0) {
        const briefcases = await utils.getBriefcases(accessTokens[1], imodelId, user1BriefcasesCount + user2BriefcasesCount);
        await utils.createChangeSets(accessTokens[1], imodelId, briefcases[user1BriefcasesCount], user1PushedChangesetsCount, user2PushedChangesetsCount);
        await utils.createLocks(accessTokens[1], imodelId, briefcases[user1BriefcasesCount], user2OwnedLocksCount);
      }
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should get user briefcases count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessTokens[0].getUserProfile()!.userId).selectBriefcasesCount();
    const textQuery = `${accessTokens[0].getUserProfile()!.userId}?$select=*,HasStatistics-forward-Statistics.BriefcasesCount`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [accessTokens[0].getUserProfile()!.userId], [user1BriefcasesCount]), textQuery);

    const briefcasesCount = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId, query))[0];

    chai.assert(briefcasesCount);
    chai.expect(briefcasesCount.briefcasesCount).to.be.equal(user1BriefcasesCount);
  });

  it("should get user owned locks count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessTokens[0].getUserProfile()!.userId).selectOwnedLocksCount();
    const textQuery = `${accessTokens[0].getUserProfile()!.userId}?$select=*,HasStatistics-forward-Statistics.OwnedLocksCount`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [accessTokens[0].getUserProfile()!.userId], undefined,
      [user1OwnedLocksCount]), textQuery);

    const ownedLocksCount = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId, query))[0];

    chai.assert(ownedLocksCount);
    chai.expect(ownedLocksCount.ownedLocksCount).to.be.equal(user1OwnedLocksCount);
  });

  it("should get user pushed changesets count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessTokens[0].getUserProfile()!.userId).selectPushedChangeSetsCount();
    const textQuery = `${accessTokens[0].getUserProfile()!.userId}?$select=*,HasStatistics-forward-Statistics.PushedChangeSetsCount`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [accessTokens[0].getUserProfile()!.userId], undefined,
      undefined, [user1PushedChangesetsCount]), textQuery);

    const pushedChangesetsCount = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId,
      query))[0];

    chai.assert(pushedChangesetsCount);
    chai.expect(pushedChangesetsCount.pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
  });

  it("should get user last changeset push date", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessTokens[0].getUserProfile()!.userId).selectLastChangeSetPushDate();
    const textQuery = `${accessTokens[0].getUserProfile()!.userId}?$select=*,HasStatistics-forward-Statistics.LastChangeSetPushDate`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [accessTokens[0].getUserProfile()!.userId], undefined,
      undefined, undefined, ["date"]), textQuery);

    const lastChangeSetPushDate = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId,
      query))[0];

    chai.assert(lastChangeSetPushDate);
    chai.assert(lastChangeSetPushDate.lastChangeSetPushDate);
    chai.expect(lastChangeSetPushDate.lastChangeSetPushDate!.length > 1);
  });

  it("should get user pushed changesets count and last changeset push date", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessTokens[0].getUserProfile()!.userId)
      .selectPushedChangeSetsCount().selectLastChangeSetPushDate();
    const textQuery = `${accessTokens[0].getUserProfile()!.userId}?$select=*,HasStatistics-forward-Statistics.PushedChangeSetsCount,`
      + "HasStatistics-forward-Statistics.LastChangeSetPushDate";

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [accessTokens[0].getUserProfile()!.userId], undefined,
      undefined, [user1PushedChangesetsCount], ["date"]), textQuery);

    const changesetStatistics = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId,
      query))[0];

    chai.assert(changesetStatistics);
    chai.expect(changesetStatistics.lastChangeSetPushDate!.length > 1);
    chai.expect(changesetStatistics.pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
  });

  it("should get briefcases and owned locks count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().byId(accessTokens[0].getUserProfile()!.userId).selectBriefcasesCount().selectOwnedLocksCount();
    const textQuery = `${accessTokens[0].getUserProfile()!.userId}?$select=*,HasStatistics-forward-Statistics.BriefcasesCount,`
      + "HasStatistics-forward-Statistics.OwnedLocksCount";

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [accessTokens[0].getUserProfile()!.userId],
      [user1BriefcasesCount], [user1OwnedLocksCount]), textQuery);

    const briefcasesLocksStatistics = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId,
      query))[0];

    chai.assert(briefcasesLocksStatistics);
    chai.expect(briefcasesLocksStatistics.ownedLocksCount).to.be.equal(user1OwnedLocksCount);
    chai.expect(briefcasesLocksStatistics.briefcasesCount).to.be.equal(user1BriefcasesCount);
  });

  it("should get all iModel users Briefcases count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery().selectBriefcasesCount();
    const textQuery = "?$select=*,HasStatistics-forward-Statistics.BriefcasesCount";

    mockGetUserStatistics(imodelId, generateUsersStatistics(2,
      [accessTokens[0].getUserProfile()!.userId, accessTokens[1].getUserProfile()!.userId],
      [user1BriefcasesCount, user2BriefcasesCount]), textQuery);

    const iModelStatistics = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId, query));

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    sortStatistics(iModelStatistics);
    chai.expect(iModelStatistics[0].briefcasesCount).to.be.equal(user1BriefcasesCount);
    chai.expect(iModelStatistics[1].briefcasesCount).to.be.equal(user2BriefcasesCount);
  });

  it("should get two users Pushed Changesets count", async function (this: Mocha.ITestCallbackContext) {
    const query = new UserStatisticsQuery()
      .byIds([accessTokens[0].getUserProfile()!.userId, accessTokens[1].getUserProfile()!.userId])
      .selectPushedChangeSetsCount();

    mockGetUserStatistics(imodelId, generateUsersStatistics(2,
      [accessTokens[0].getUserProfile()!.userId, accessTokens[1].getUserProfile()!.userId],
      undefined, undefined, [user1PushedChangesetsCount, user2PushedChangesetsCount]));

    const iModelStatistics = (await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId, query));

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    sortStatistics(iModelStatistics);
    chai.expect(iModelStatistics[0].pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
    chai.expect(iModelStatistics[1].pushedChangeSetsCount).to.be.equal(user2PushedChangesetsCount);
  });

  it("should get all iModel statistics", async function (this: Mocha.ITestCallbackContext) {
    const textQuery = "?$select=*,HasStatistics-forward-Statistics.*";

    mockGetUserStatistics(imodelId, generateUsersStatistics(2,
      [accessTokens[0].getUserProfile()!.userId, accessTokens[1].getUserProfile()!.userId],
      [user1BriefcasesCount, user2BriefcasesCount],
      [user1OwnedLocksCount, user2OwnedLocksCount], [user1PushedChangesetsCount, user2PushedChangesetsCount]),
      textQuery);

    const iModelStatistics = await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId);

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    sortStatistics(iModelStatistics);
    chai.expect(iModelStatistics[0].ownedLocksCount).to.be.equal(user1OwnedLocksCount);
    chai.expect(iModelStatistics[0].briefcasesCount).to.be.equal(user1BriefcasesCount);
    chai.expect(iModelStatistics[0].pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
    chai.expect(iModelStatistics[1].ownedLocksCount).to.be.equal(user2OwnedLocksCount);
    chai.expect(iModelStatistics[1].briefcasesCount).to.be.equal(user2BriefcasesCount);
    chai.expect(iModelStatistics[1].pushedChangeSetsCount).to.be.equal(user2PushedChangesetsCount);
  });

  it("should fail to get user statistics without ids", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await imodelHubClient.Users().Statistics().get(actx, accessTokens[0], imodelId, new UserStatisticsQuery().byIds([]));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber!).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });
});
