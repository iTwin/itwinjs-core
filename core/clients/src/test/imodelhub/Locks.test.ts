/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { Lock } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

chai.should();

function mockGetLocks(responseBuilder: ResponseBuilder, imodelId: string, ...locks: Lock[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Lock");
  const requestResponse = responseBuilder.generateGetArrayResponse<Lock>(locks);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, requestResponse);
}

describe("iModelHubClient LockHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  const imodelName = "imodeljs-clients Locks test";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();
  const imodelHubClient: IModelHubClient = utils.getDefaultClient(responseBuilder);

  before(async function (this: Mocha.IHookCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    accessToken = await utils.login();
    // Doesn't create an imodel right now, but should in the future
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should get information on Locks", async function (this: Mocha.ITestCallbackContext) {

    mockGetLocks(responseBuilder, iModelId, responseBuilder.generateObject<Lock>(Lock));
    // Needs to acquire before expecting more than 0.
    const locks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId);
    chai.expect(locks.length).to.be.greaterThan(0);
  });
});
