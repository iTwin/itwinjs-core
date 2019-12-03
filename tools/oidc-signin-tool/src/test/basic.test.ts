/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { getToken, OidcConfiguration } from "../OidcPublicClient";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

describe("Sign in", () => {
  it("success with valid user", async () => {
    const userCredentials = {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };

    const config: OidcConfiguration = {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
    };

    const token = await getToken(userCredentials.email, userCredentials.password, userCredentials.scope, config, 102);
    assert.exists(token);
  });

  it("failure with invalid user", async () => {
    const userCredentials = {
      email: "invalid@email.com",
      password: "invalid",
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };
    const config: OidcConfiguration = {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
    };
    await expect(getToken(userCredentials.email, userCredentials.password, userCredentials.scope, config, 102)).to.be.rejectedWith(Error, `Error: Failed OIDC signin for ${userCredentials.email}.\nUser name not found or incorrect password.`);
  });
});
