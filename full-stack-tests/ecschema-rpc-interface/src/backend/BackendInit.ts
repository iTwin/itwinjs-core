/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { TestUtility } from "@itwin/oidc-signin-tool/lib/cjs/TestUtility";
import { exposeBackendCallbacks } from "../common/SideChannels";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

// "getToken" is the legacy callback name used by @itwin/oidc-signin-tool's
// getAccessTokenFromBackend helper. Register it in the bridge registry so it
// resolves correctly under vitest-certa-bridge.
registerBackendCallback("getToken", async (user: any, oidcConfig?: any) => {
  if (oidcConfig === undefined || oidcConfig === null)
    return TestUtility.getAccessToken(user);
  return TestUtility.getAuthorizationClient(user, oidcConfig).getAccessToken();
});

module.exports = (async () => {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  exposeBackendCallbacks();
})();
