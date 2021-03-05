/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { loadEnv } from "@bentley/config-loader";
import { AccessToken } from "@bentley/itwin-client";
import { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "../TestUsers";
import { TestUtility } from "../TestUtility";
import { getTokenCallbackName, serializeToken } from "./certaCommon";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in.

/* eslint-disable no-console */

// The assumption is the certa.json file is a peer of the `package.json` file and
// when certa is invoked via a npm script (in the package.json) the `.env` will
// also be a peer of both files.
loadEnv(path.join(process.cwd(), ".env"));

/** Signs in for the provided user.
 *
 * The default OIDC configuration is defined by the following environment variables,
 *   - `imjs_oidc_browser_test_client_id`
 *   - `imjs_oidc_browser_test_redirect_uri`
 *   - `imjs_oidc_browser_test_scopes`
 *
 * If the oidcConfig param is provided, it will always be used over the default.
 */
async function signin(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
  // Handle OIDC signin
  // console.log("Starting OIDC signin...");
  // console.time("Finished OIDC signin in");

  let token: AccessToken;
  if (undefined === oidcConfig || null === oidcConfig) {
    token = await TestUtility.getAccessToken(user);
  } else {
    const client = TestUtility.getAuthorizationClient(user, oidcConfig);
    token = await client.getAccessToken();
  }

  if (undefined === token)
    throw new Error("Failed to get access token");

  // console.timeEnd("Finished OIDC signin in");

  return token;
}

registerBackendCallback(getTokenCallbackName, async (user: any, oidcConfig?: any): Promise<string> => {
  const accessToken = await signin(user, oidcConfig);
  return JSON.stringify(serializeToken(accessToken));
});
