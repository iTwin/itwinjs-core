/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext, ClientRequestContextProps } from "@bentley/bentleyjs-core";
import { AuthorizedFrontendRequestContext, IModelApp } from "@bentley/imodeljs-frontend";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestFrontendAuthorizationClient, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";

describe("IModelApp (#integration)", () => {

  before(async () => {
    await IModelApp.shutdown();
    await IModelApp.startup({
      applicationId: "1234",
      applicationVersion: "testappversion",
      sessionId: "testsessionid",
    });

    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(requestContext.accessToken);
  });

  after(async () => {
    await IModelApp.shutdown();

    IModelApp.authorizationClient = undefined;
  });

  it("should setup access token and application id values for the backend", async () => {
    const expectedAccessTokenStr = (await IModelApp.authorizationClient!.getAccessToken()).toTokenString();

    let authorizedRequestContext: AuthorizedClientRequestContext = await AuthorizedFrontendRequestContext.create();
    authorizedRequestContext.enter();

    authorizedRequestContext = ClientRequestContext.current as AuthorizedFrontendRequestContext;
    let actualAccessTokenStr = authorizedRequestContext.accessToken.toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(authorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(authorizedRequestContext.sessionId, IModelApp.sessionId);
    const activityId = authorizedRequestContext.activityId;

    let actualAuthorizedRequestContext = await TestRpcInterface.getClient().reportAuthorizedRequestContext();
    actualAccessTokenStr = AccessToken.fromJson(actualAuthorizedRequestContext.accessToken).toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(actualAuthorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(actualAuthorizedRequestContext.sessionId, IModelApp.sessionId);
    assert.notEqual(actualAuthorizedRequestContext.activityId, activityId, "The activityId setup wasn't used by the RPC operation");

    authorizedRequestContext.enter();
    authorizedRequestContext.useContextForRpc = true;
    actualAuthorizedRequestContext = await TestRpcInterface.getClient().reportAuthorizedRequestContext();
    assert.isFalse(authorizedRequestContext.useContextForRpc);
    actualAccessTokenStr = AccessToken.fromJson(actualAuthorizedRequestContext.accessToken).toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(actualAuthorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(actualAuthorizedRequestContext.sessionId, IModelApp.sessionId);
    assert.equal(actualAuthorizedRequestContext.activityId, activityId, "The activityId setup wasn't used by the RPC operation");

    actualAuthorizedRequestContext = await TestRpcInterface.getClient().reportAuthorizedRequestContext();
    actualAccessTokenStr = AccessToken.fromJson(actualAuthorizedRequestContext.accessToken).toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(actualAuthorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(actualAuthorizedRequestContext.sessionId, IModelApp.sessionId);
    assert.notEqual(actualAuthorizedRequestContext.activityId, activityId, "The activityId setup wasn't used by the RPC operation");

    IModelApp.authorizationClient = undefined;
    const requestContext: ClientRequestContextProps = await TestRpcInterface.getClient().reportRequestContext();
    assert.equal(requestContext.applicationId, IModelApp.applicationId);
    assert.equal(requestContext.sessionId, IModelApp.sessionId);
    assert.notEqual(requestContext.activityId, activityId, "The activityId was not reset after an RPC operation");
  });

});
