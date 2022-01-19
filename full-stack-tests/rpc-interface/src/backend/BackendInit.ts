/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@itwin/oidc-signin-tool/lib/cjs/certa/certaBackend";
// Sets up certa to allow a method on the frontend to get an access token
import * as path from "path";
import { exposeBackendCallbacks } from "../common/SideChannels";
import * as fs from "fs";

/* eslint-disable no-console */

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

  exposeBackendCallbacks();
})();
