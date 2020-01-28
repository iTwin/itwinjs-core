/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { getTestOidcToken, TestOidcConfiguration, TestUserCredentials } from "@bentley/oidc-signin-tool";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { AccessToken, Config } from "@bentley/imodeljs-clients";

import { exposeBackendCallbacks } from "../common/SideChannels";
import { Settings } from "../common/Settings";

// tslint:disable:no-console

module.exports = (async () => {
  IModelJsConfig.init(true, true, Config.App);
  const settings = new Settings(process.env);
  const accessTokens = new Array<AccessToken>();

  // Do OIDC signin
  console.log("Starting OIDC signin...");
  console.time("Finished OIDC signin in");
  if (undefined !== settings.oidcClientId) {
    Config.App.set("imjs_buddi_resolve_url_using_region", settings.env);
    const oidcConfig: TestOidcConfiguration = {
      clientId: settings.oidcClientId,
      redirectUri: settings.oidcRedirect,
      scope: settings.oidcScopes,
    };

    for (const [username, password] of settings.users) {
      const userCredentials: TestUserCredentials = {
        email: username,
        password,
      };
      const token = await getTestOidcToken(oidcConfig, userCredentials, settings.env);
      if (undefined === token)
        throw new Error("Failed to get access token");

      accessTokens.push(token);
    }
  }
  console.timeEnd("Finished OIDC signin in");

  exposeBackendCallbacks(accessTokens);
})();
