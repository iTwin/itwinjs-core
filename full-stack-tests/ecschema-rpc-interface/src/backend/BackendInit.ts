/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import * as path from "path";
import { Config } from "@bentley/bentleyjs-core";
import { Settings } from "../common/Settings";
import { exposeBackendCallbacks } from "../common/SideChannels";
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

module.exports = (async () => {
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  // Need to create a new one on the backend to properly setup dotenv
  const settings = new Settings(process.env);

  Config.App.set("imjs_buddi_resolve_url_using_region", settings.env);

  exposeBackendCallbacks();
})();
