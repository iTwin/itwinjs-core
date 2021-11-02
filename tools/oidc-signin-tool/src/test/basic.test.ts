/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as path from "path";
import { getTestAccessToken, TestBrowserAuthorizationClientConfiguration, TestUsers, TestUtility } from "../index";
import * as fs from "fs";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

const assert = chai.assert;
const expect = chai.expect;
chai.use(chaiAsPromised);

loadEnv(path.join(__dirname, "..", "..", "..", ".env"));

describe("Sign in (#integration)", () => {
  let oidcConfig: TestBrowserAuthorizationClientConfiguration;

  before(() => {
    if (process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID === undefined)
      throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_CLIENT_ID");
    if (process.env.IMJS_OIDC_BROWSER_TEST_REDIRECT_URI === undefined)
      throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_REDIRECT_URI");
    if (process.env.IMJS_OIDC_BROWSER_TEST_SCOPES === undefined)
      throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_SCOPES");

    oidcConfig = {
      clientId: process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_OIDC_BROWSER_TEST_REDIRECT_URI ?? "",
      scope: process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? "",
    };
  });

  it("success with valid user", async () => {
    const validUser = TestUsers.regular;
    const token = await getTestAccessToken(oidcConfig, validUser);
    assert.exists(token);
  });

  // test will not work without using a desktop client. setup correctly on master, will enable there.
  it("success with valid user and iTwin Platform scope", async () => {
    const validUser = TestUsers.regular;
    const token = await getTestAccessToken({
      ...oidcConfig,
      scope: `${oidcConfig.scope} projects:read`,
    }, validUser);
    assert.exists(token);
  });

  it("failure with invalid url", async () => {
    const oidcInvalidConfig = { ...oidcConfig, redirectUri: "invalid.com" };
    const validUser = TestUsers.regular;
    await expect(getTestAccessToken(oidcInvalidConfig, validUser))
      .to.be.rejectedWith(Error, `Failed OIDC signin for ${validUser.email}.\nError:`);
  });

  it.skip("failure with invalid Bentley federated user", async () => {
    const invalidUser = {
      email: "invalid@bentley.com",
      password: "invalid",
    };

    await expect(getTestAccessToken(oidcConfig, invalidUser))
      .to.be.rejectedWith(Error, `Failed OIDC signin for ${invalidUser.email}.\nError: Incorrect user ID or password. Type the correct user ID and password, and try again.`);
  });

  it.skip("failure with invalid user", async () => {
    const invalidUser = {
      email: "invalid@email.com",
      password: "invalid",
      scope: process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? "",
    };
    await expect(getTestAccessToken(oidcConfig, invalidUser))
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

});
