/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { AccessToken } from "../../Token";
import { ResponseBuilder, ScopeType, RequestType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
import { TestUsers } from "../TestConfig";
import { UserInfoQuery, UserInfo, UserProfile, IModelHubRequestError, IModelClient } from "../..";
import { IModelHubStatus } from "@bentley/bentleyjs-core";

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
  let accessToken: AccessToken;
  let accessToken2: AccessToken;
  let iModelId: string;

  const imodelName = "imodeljs-clients UserInfo test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();

  before(async function (this: Mocha.IHookCallbackContext) {
    accessToken = await utils.login();
    accessToken2 = await utils.login(TestUsers.regular);
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);

    if (!TestConfig.enableMocks) {
      await utils.getBriefcases(accessToken, iModelId, 1);
      await utils.getBriefcases(accessToken2, iModelId, 1);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should get one user info", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedUserInfo = generateUserInfo([accessToken.getUserProfile()!]);
      mockGetUserInfo(iModelId, mockedUserInfo, `${mockedUserInfo[0].id}`);
    }

    const query = new UserInfoQuery().byId(accessToken.getUserProfile()!.userId);
    const userInfo = (await imodelHubClient.Users().get(accessToken, iModelId, query));
    chai.assert(userInfo);
    chai.expect(userInfo.length).to.be.equal(1);
    chai.expect(userInfo[0].id).to.be.equal(accessToken.getUserProfile()!.userId);
    chai.expect(userInfo[0].firstName).to.be.equal(accessToken.getUserProfile()!.firstName);
    chai.expect(userInfo[0].lastName).to.be.equal(accessToken.getUserProfile()!.lastName);
  });

  it("should get several users info", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks) {
      const mockedUsersInfo = generateUserInfo([accessToken.getUserProfile()!, accessToken2.getUserProfile()!]);
      mockGetUserInfo(iModelId, mockedUsersInfo);
    }

    const query = new UserInfoQuery().byIds(
      [accessToken.getUserProfile()!.userId,
      accessToken2.getUserProfile()!.userId]);
    const userInfo = (await imodelHubClient.Users().get(accessToken, iModelId, query));
    chai.assert(userInfo);
    chai.expect(userInfo.length).to.be.equal(2);
    chai.expect(userInfo[0].id).to.be.equal(accessToken2.getUserProfile()!.userId);
    chai.expect(userInfo[0].firstName).to.be.equal(accessToken2.getUserProfile()!.firstName);
    chai.expect(userInfo[0].lastName).to.be.equal(accessToken2.getUserProfile()!.lastName);
    chai.expect(userInfo[1].id).to.be.equal(accessToken.getUserProfile()!.userId);
    chai.expect(userInfo[1].firstName).to.be.equal(accessToken.getUserProfile()!.firstName);
    chai.expect(userInfo[1].lastName).to.be.equal(accessToken.getUserProfile()!.lastName);
  });

  it("should fail to get users without ids", async () => {
    let error: IModelHubRequestError | undefined;
    try {
      await imodelHubClient.Users().get(accessToken, iModelId, new UserInfoQuery().byIds([]));
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber!).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });
});
