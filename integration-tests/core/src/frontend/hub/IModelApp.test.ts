/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, ImsTestAuthorizationClient } from "@bentley/imodeljs-clients";
import { IModelApp, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { TestUsers } from "./TestUsers";

describe("IModelApp (#integration)", () => {

  before(async () => {
    IModelApp.startup({
      applicationId: "1234",
      applicationVersion: "testappversion",
      sessionId: "testsessionid",
    });

    const imsTestAuthorizationClient = new ImsTestAuthorizationClient();
    await imsTestAuthorizationClient.signIn(new ClientRequestContext(), TestUsers.regular);
    IModelApp.authorizationClient = imsTestAuthorizationClient;
  });

  after(async () => {
    IModelApp.shutdown();

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
    actualAccessTokenStr = actualAuthorizedRequestContext.accessToken.toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(actualAuthorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(actualAuthorizedRequestContext.sessionId, IModelApp.sessionId);
    assert.notEqual(actualAuthorizedRequestContext.activityId, activityId, "The activityId setup wasn't used by the RPC operation");

    authorizedRequestContext.enter();
    authorizedRequestContext.useContextForRpc = true;
    actualAuthorizedRequestContext = await TestRpcInterface.getClient().reportAuthorizedRequestContext();
    assert.isFalse(authorizedRequestContext.useContextForRpc);
    actualAccessTokenStr = actualAuthorizedRequestContext.accessToken.toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(actualAuthorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(actualAuthorizedRequestContext.sessionId, IModelApp.sessionId);
    assert.equal(actualAuthorizedRequestContext.activityId, activityId, "The activityId setup wasn't used by the RPC operation");

    actualAuthorizedRequestContext = await TestRpcInterface.getClient().reportAuthorizedRequestContext();
    actualAccessTokenStr = actualAuthorizedRequestContext.accessToken.toTokenString();
    assert.equal(actualAccessTokenStr, expectedAccessTokenStr);
    assert.equal(actualAuthorizedRequestContext.applicationId, IModelApp.applicationId);
    assert.equal(actualAuthorizedRequestContext.sessionId, IModelApp.sessionId);
    assert.notEqual(actualAuthorizedRequestContext.activityId, activityId, "The activityId setup wasn't used by the RPC operation");

    IModelApp.authorizationClient = undefined;
    const requestContext: ClientRequestContext = await TestRpcInterface.getClient().reportRequestContext();
    assert.equal(requestContext.applicationId, IModelApp.applicationId);
    assert.equal(requestContext.sessionId, IModelApp.sessionId);
    assert.notEqual(requestContext.activityId, activityId, "The activityId was not reset after an RPC operation");
  });

});
