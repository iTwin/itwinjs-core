/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { getToken, OidcConfiguration } from "../OidcPublicClient";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

describe("Sign in", () => {
  it("successful", async () => {
    const userCredentials = {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };

    const config: OidcConfiguration = {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
    };

    await getToken(userCredentials.email, userCredentials.password, userCredentials.scope, config, 102);
  });
});
