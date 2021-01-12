/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { GuidString, IModelHubStatus } from "@bentley/bentleyjs-core";
import { IModelClient, IModelHubClientError, UserStatistics, UserStatisticsQuery } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext, UserInfo } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";

chai.should();

function mockGetUserStatistics(imodelId: GuidString, userStatistics: UserStatistics[], query?: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestResponse = ResponseBuilder.generateGetArrayResponse<UserStatistics>(userStatistics);
  let requestPath;
  if (query === undefined) {
    requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "UserInfo", "$query");
    ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse);
  } else {
    requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "UserInfo", `${query ? query : ""}`);
    ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
  }
}

function generateUsersStatistics(count: number, users: UserInfo[], briefcasesCount?: number[], ownedLocksCount?: number[],
  pushedChangesetsCount?: number[], lastChangeSetPushDate?: string[]): UserStatistics[] {
  const statistics: UserStatistics[] = [];

  for (let i = 0; i < count; i++) {
    const userStatistics = new UserStatistics();
    if (users !== undefined) {
      userStatistics.wsgId = users[i].id;
      userStatistics.email = users[i].email!.id;
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
  value.sort((a: UserStatistics, b: UserStatistics) => 0 - a.email!.localeCompare(b.email!));
}

describe("iModelHubClient UserStatisticsHandler", () => {
  const requestContexts: AuthorizedClientRequestContext[] = [];
  let contextId: string;
  let imodelId: GuidString;

  let imodelHubClient: IModelClient;

  const user1BriefcasesCount = 2;
  const user1OwnedLocksCount = 1;
  const user1PushedChangesetsCount = 1;

  const user2BriefcasesCount = 1;
  const user2OwnedLocksCount = 1;
  const user2PushedChangesetsCount = 0;

  before(async () => {
    const superAccessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    const managerAccessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.manager);
    requestContexts.push(new AuthorizedClientRequestContext(superAccessToken));
    requestContexts.push(new AuthorizedClientRequestContext(managerAccessToken));

    contextId = await utils.getProjectId(requestContexts[0]);
    await utils.createIModel(requestContexts[0], utils.sharedimodelName, contextId, true, true);
    imodelId = await utils.getIModelId(requestContexts[0], utils.sharedimodelName, contextId);
    imodelHubClient = utils.getDefaultClient();

    if (!TestConfig.enableMocks) {
      // generate data for user statistics
      // user 1
      if (user1BriefcasesCount > 0) {
        const briefcases = await utils.getBriefcases(requestContexts[0], imodelId, user1BriefcasesCount);
        await utils.createChangeSets(requestContexts[0], imodelId, briefcases[0], 0, user1PushedChangesetsCount);
        await utils.createLocks(requestContexts[0], imodelId, briefcases[0], user1OwnedLocksCount);
      }
      // user 2
      if (user2BriefcasesCount > 0) {
        const briefcases = await utils.getBriefcases(requestContexts[1], imodelId, user2BriefcasesCount);
        await utils.createChangeSets(requestContexts[1], imodelId, briefcases[0], user1PushedChangesetsCount, user2PushedChangesetsCount);
        await utils.createLocks(requestContexts[1], imodelId, briefcases[0], user2OwnedLocksCount);
      }
    }
  });

  after(async () => {
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(requestContexts[0], contextId, utils.sharedimodelName);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should get user briefcases count", async () => {
    const query = new UserStatisticsQuery().byId(requestContexts[0].accessToken.getUserInfo()!.id).selectBriefcasesCount();
    const textQuery = `${requestContexts[0].accessToken.getUserInfo()!.id}?$select=*,HasStatistics-forward-Statistics.BriefcasesCount`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [requestContexts[0].accessToken.getUserInfo()!], [user1BriefcasesCount]), textQuery);

    const briefcasesCount = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId, query))[0];

    chai.assert(briefcasesCount);
    chai.expect(briefcasesCount.briefcasesCount).to.be.equal(user1BriefcasesCount);
  });

  it("should get user owned locks count", async () => {
    const query = new UserStatisticsQuery().byId(requestContexts[0].accessToken.getUserInfo()!.id).selectOwnedLocksCount();
    const textQuery = `${requestContexts[0].accessToken.getUserInfo()!.id}?$select=*,HasStatistics-forward-Statistics.OwnedLocksCount`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [requestContexts[0].accessToken.getUserInfo()!], undefined,
      [user1OwnedLocksCount]), textQuery);

    const ownedLocksCount = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId, query))[0];

    chai.assert(ownedLocksCount);
    chai.expect(ownedLocksCount.ownedLocksCount).to.be.equal(user1OwnedLocksCount);
  });

  it("should get user pushed changesets count", async () => {
    const query = new UserStatisticsQuery().byId(requestContexts[0].accessToken.getUserInfo()!.id).selectPushedChangeSetsCount();
    const textQuery = `${requestContexts[0].accessToken.getUserInfo()!.id}?$select=*,HasStatistics-forward-Statistics.PushedChangeSetsCount`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [requestContexts[0].accessToken.getUserInfo()!], undefined,
      undefined, [user1PushedChangesetsCount]), textQuery);

    const pushedChangesetsCount = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId,
      query))[0];

    chai.assert(pushedChangesetsCount);
    chai.expect(pushedChangesetsCount.pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
  });

  it("should get user last changeset push date", async () => {
    const query = new UserStatisticsQuery().byId(requestContexts[0].accessToken.getUserInfo()!.id).selectLastChangeSetPushDate();
    const textQuery = `${requestContexts[0].accessToken.getUserInfo()!.id}?$select=*,HasStatistics-forward-Statistics.LastChangeSetPushDate`;

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [requestContexts[0].accessToken.getUserInfo()!], undefined,
      undefined, undefined, ["date"]), textQuery);

    const lastChangeSetPushDate = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId,
      query))[0];

    chai.assert(lastChangeSetPushDate);
    chai.assert(lastChangeSetPushDate.lastChangeSetPushDate);
    chai.expect(lastChangeSetPushDate.lastChangeSetPushDate!.length > 1);
  });

  it("should get user pushed changesets count and last changeset push date", async () => {
    const query = new UserStatisticsQuery().byId(requestContexts[0].accessToken.getUserInfo()!.id)
      .selectPushedChangeSetsCount().selectLastChangeSetPushDate();
    const textQuery = `${requestContexts[0].accessToken.getUserInfo()!.id}?$select=*,HasStatistics-forward-Statistics.PushedChangeSetsCount,`
      + "HasStatistics-forward-Statistics.LastChangeSetPushDate";

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [requestContexts[0].accessToken.getUserInfo()!], undefined,
      undefined, [user1PushedChangesetsCount], ["date"]), textQuery);

    const changesetStatistics = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId,
      query))[0];

    chai.assert(changesetStatistics);
    chai.expect(changesetStatistics.lastChangeSetPushDate!.length > 1);
    chai.expect(changesetStatistics.pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
  });

  it("should get briefcases and owned locks count", async () => {
    const query = new UserStatisticsQuery().byId(requestContexts[0].accessToken.getUserInfo()!.id).selectBriefcasesCount().selectOwnedLocksCount();
    const textQuery = `${requestContexts[0].accessToken.getUserInfo()!.id}?$select=*,HasStatistics-forward-Statistics.BriefcasesCount,`
      + "HasStatistics-forward-Statistics.OwnedLocksCount";

    mockGetUserStatistics(imodelId, generateUsersStatistics(1, [requestContexts[0].accessToken.getUserInfo()!],
      [user1BriefcasesCount], [user1OwnedLocksCount]), textQuery);

    const briefcasesLocksStatistics = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId,
      query))[0];

    chai.assert(briefcasesLocksStatistics);
    chai.expect(briefcasesLocksStatistics.ownedLocksCount).to.be.equal(user1OwnedLocksCount);
    chai.expect(briefcasesLocksStatistics.briefcasesCount).to.be.equal(user1BriefcasesCount);
  });

  it("should get all iModel users Briefcases count", async () => {
    const query = new UserStatisticsQuery().selectBriefcasesCount();
    const textQuery = "?$select=*,HasStatistics-forward-Statistics.BriefcasesCount";

    mockGetUserStatistics(imodelId, generateUsersStatistics(2,
      [requestContexts[0].accessToken.getUserInfo()!, requestContexts[1].accessToken.getUserInfo()!],
      [user1BriefcasesCount, user2BriefcasesCount]), textQuery);

    const iModelStatistics = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId, query));

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    sortStatistics(iModelStatistics);
    chai.expect(iModelStatistics[0].briefcasesCount).to.be.equal(user1BriefcasesCount);
    chai.expect(iModelStatistics[1].briefcasesCount).to.be.equal(user2BriefcasesCount);
  });

  it("should get two users Pushed Changesets count", async () => {
    const query = new UserStatisticsQuery()
      .byIds([requestContexts[0].accessToken.getUserInfo()!.id, requestContexts[1].accessToken.getUserInfo()!.id])
      .selectPushedChangeSetsCount();

    mockGetUserStatistics(imodelId, generateUsersStatistics(2,
      [requestContexts[0].accessToken.getUserInfo()!, requestContexts[1].accessToken.getUserInfo()!],
      undefined, undefined, [user1PushedChangesetsCount, user2PushedChangesetsCount]));

    const iModelStatistics = (await imodelHubClient.users.statistics.get(requestContexts[0], imodelId, query));

    chai.assert(iModelStatistics);
    chai.expect(iModelStatistics.length === 2);
    sortStatistics(iModelStatistics);
    chai.expect(iModelStatistics[0].pushedChangeSetsCount).to.be.equal(user1PushedChangesetsCount);
    chai.expect(iModelStatistics[1].pushedChangeSetsCount).to.be.equal(user2PushedChangesetsCount);
  });

  it("should get all iModel statistics", async () => {
    const textQuery = "?$select=*,HasStatistics-forward-Statistics.*";

    mockGetUserStatistics(imodelId, generateUsersStatistics(2,
      [requestContexts[0].accessToken.getUserInfo()!, requestContexts[1].accessToken.getUserInfo()!],
      [user1BriefcasesCount, user2BriefcasesCount],
      [user1OwnedLocksCount, user2OwnedLocksCount], [user1PushedChangesetsCount, user2PushedChangesetsCount]), textQuery);

    const iModelStatistics = await imodelHubClient.users.statistics.get(requestContexts[0], imodelId);

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
      await imodelHubClient.users.statistics.get(requestContexts[0], imodelId, new UserStatisticsQuery().byIds([]));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });
});
