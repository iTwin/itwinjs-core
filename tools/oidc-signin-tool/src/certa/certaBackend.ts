/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import { AccessToken } from "@itwin/core-bentley";
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "../TestUsers";
import { TestUtility } from "../TestUtility";
import { getTokenCallbackName } from "./certaCommon";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in.

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

// The assumption is the certa.json file is a peer of the `package.json` file and
// when certa is invoked via a npm script (in the package.json) the `.env` will
// also be a peer of both files.
loadEnv(path.join(process.cwd(), ".env"));

/** Signs in for the provided user.
 *
 * The default OIDC configuration is defined by the following environment variables,
 *   - `IMJS_OIDC_BROWSER_TEST_CLIENT_ID`
 *   - `IMJS_OIDC_BROWSER_TEST_REDIRECT_URI`
 *   - `IMJS_OIDC_BROWSER_TEST_SCOPES`
 *
 * If the oidcConfig param is provided, it will always be used over the default.
 */
async function signin(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
  let token: AccessToken | undefined;
  if (undefined === oidcConfig || null === oidcConfig) {
    token = await TestUtility.getAccessToken(user);
  } else {
    const client = TestUtility.getAuthorizationClient(user, oidcConfig);
    token = await client.getAccessToken();
  }

  if (undefined === token)
    throw new Error("Failed to get access token");

  return token;
}

registerBackendCallback(getTokenCallbackName, async (user: any, oidcConfig?: any): Promise<string> => {
  const accessToken = await signin(user, oidcConfig);
  return accessToken?.toString() ?? "";
});
