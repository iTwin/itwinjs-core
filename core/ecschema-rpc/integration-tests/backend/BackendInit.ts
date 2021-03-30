/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import { Config } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Settings } from "../common/Settings";
import { exposeBackendCallbacks } from "../common/SideChannels";

// tslint:disable:no-console

module.exports = (async () => {
  IModelJsConfig.init(true, true, Config.App);

  // Need to create a new one on the backend to properly setup dotenv
  const settings = new Settings(process.env);

  Config.App.set("imjs_buddi_resolve_url_using_region", settings.env);

  exposeBackendCallbacks();
})();
