/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { getTestOidcToken } from "../TestOidcClient";
import { TestUsers, TestOidcConfiguration } from "../TestUsers";
import { TestUtility } from "../TestUtility";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

describe("Sign in (#integration)", () => {
  let oidcConfig: TestOidcConfiguration;

  before(() => {
    oidcConfig = {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };
  });

  it("success with valid user", async () => {
    const validUser = TestUsers.regular;
    const token = await getTestOidcToken(oidcConfig, validUser);
    assert.exists(token);
  });

  it.skip("failure with invalid Bentley federated user", async () => {
    const invalidUser = {
      email: "invalid@bentley.com",
      password: "invalid",
    };

    await expect(getTestOidcToken(oidcConfig, invalidUser))
      .to.be.rejectedWith(Error, `Failed OIDC signin for ${invalidUser.email}.\nError: Incorrect user ID or password. Type the correct user ID and password, and try again.`);
  });

  it("failure with invalid user", async () => {
    const invalidUser = {
      email: "invalid@email.com",
      password: "invalid",
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };
    await expect(getTestOidcToken(oidcConfig, invalidUser))
      .to.be.rejectedWith(Error, `Failed OIDC signin for ${invalidUser.email}.\nError: We didn't recognize the username or password you entered. Please try again.`);
  });
});

describe("TestUsers utility (#integration)", () => {

  it("can sign-in all the typically used integration test users", async () => {
    let token = await TestUtility.getAccessToken(TestUsers.regular);
    assert.exists(token);
    token = await TestUtility.getAccessToken(TestUsers.manager);
    assert.exists(token);
    token = await TestUtility.getAccessToken(TestUsers.super);
    assert.exists(token);
    token = await TestUtility.getAccessToken(TestUsers.superManager);
    assert.exists(token);
  });

  it("can construct request context for integration test users", async () => {
    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    assert.exists(requestContext);
  });

});
