/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
// Sets up certa to allow a method on the frontend to get an access token
import * as path from "path";
import { Config } from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { Settings } from "../common/Settings";
import { exposeBackendCallbacks } from "../common/SideChannels";

/* eslint-disable no-console */

module.exports = (async () => {
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  // Need to create a new one on the backend to properly setup dotenv
  const settings = new Settings(process.env);

  Config.App.set("imjs_buddi_resolve_url_using_region", settings.env);

  exposeBackendCallbacks();
})();
