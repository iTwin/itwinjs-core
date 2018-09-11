/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { AccessToken } from "../../Token";
import { ResponseBuilder, ScopeType, RequestType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { TestUsers } from "../TestConfig";
import { UserInfoQuery, UserInfo, UserProfile, IModelHubClientError, IModelClient } from "../..";
import { IModelHubStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";

function mockGetUserInfo(iModelId: string, userInfo: UserInfo[], query?: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestResponse = ResponseBuilder.generateGetArrayResponse<UserInfo>(userInfo);
  let requestPath;
  if (query === undefined) {
    requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "UserInfo", "$query");
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse);
  } else {
    requestPath = utils.createRequestUrl(ScopeType.iModel, iModelId, "UserInfo", `${query ? query : ""}`);
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
  }
}

function generateUserInfo(userProfiles: UserProfile[]): UserInfo[] {
  const users: UserInfo[] = [];
  userProfiles.forEach((user: UserProfile) => {
    const userInfo = new UserInfo();
    userInfo.id = user.userId;
    userInfo.firstName = user.firstName;
    userInfo.lastName = user.lastName;
    userInfo.email = user.email;
    users.push(userInfo);
  });
  return users;
}

describe("iModelHubClient UserInfoHandler", () => {
  const accessTokens: AccessToken[] = [];
  let iModelId: string;
  const actx = new ActivityLoggingContext("");

  const imodelName = "imodeljs-clients UserInfo test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();

  before(async function (this: Mocha.IHookCallbackContext) {
    accessTokens.push(await utils.login());
    accessTokens.push(await utils.login(TestUsers.manager));

    accessTokens.sort((a: AccessToken, b: AccessToken) => a.getUserProfile()!.userId.localeCompare(b.getUserProfile()!.userId));
    await utils.createIModel(accessTokens[0], imodelName);
    iModelId = await utils.getIModelId(accessTokens[0], imodelName);

    if (!TestConfig.enableMocks) {
      await utils.getBriefcases(accessTokens[0], iModelId, 1);
      await utils.getBriefcases(accessTokens[1], iModelId, 1);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should get one user info", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedUserInfo = generateUserInfo([accessTokens[0].getUserProfile()!]);
      mockGetUserInfo(iModelId, mockedUserInfo, `${mockedUserInfo[0].id}`);
    }

    const query = new UserInfoQuery().byId(accessTokens[0].getUserProfile()!.userId);
    const userInfo = (await imodelHubClient.Users().get(actx, accessTokens[0], iModelId, query));
    chai.assert(userInfo);
    chai.expect(userInfo.length).to.be.equal(1);
    chai.expect(userInfo[0].id).to.be.equal(accessTokens[0].getUserProfile()!.userId);
    chai.expect(userInfo[0].firstName).to.be.equal(accessTokens[0].getUserProfile()!.firstName);
    chai.expect(userInfo[0].lastName).to.be.equal(accessTokens[0].getUserProfile()!.lastName);
  });

  it("should get several users info", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedUsersInfo = generateUserInfo([accessTokens[0].getUserProfile()!, accessTokens[1].getUserProfile()!]);
      mockGetUserInfo(iModelId, mockedUsersInfo);
    }

    const query = new UserInfoQuery().byIds(
      [accessTokens[0].getUserProfile()!.userId,
      accessTokens[1].getUserProfile()!.userId]);
    const userInfo = (await imodelHubClient.Users().get(actx, accessTokens[0], iModelId, query));
    userInfo.sort((a: UserInfo, b: UserInfo) => a.id!.localeCompare(b.id!));
    chai.assert(userInfo);
    chai.expect(userInfo.length).to.be.equal(2);
    for (let i = 0; i < 2; ++i) {
      chai.expect(userInfo[i].id).to.be.equal(accessTokens[i].getUserProfile()!.userId);
      chai.expect(userInfo[i].firstName).to.be.equal(accessTokens[i].getUserProfile()!.firstName);
      chai.expect(userInfo[i].lastName).to.be.equal(accessTokens[i].getUserProfile()!.lastName);
    }
  });

  it("should fail to get users without ids", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await imodelHubClient.Users().get(actx, accessTokens[0], iModelId, new UserInfoQuery().byIds([]));
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber!).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });
});
