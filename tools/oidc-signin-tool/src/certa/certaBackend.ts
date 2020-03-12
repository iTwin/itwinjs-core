/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config, AccessToken } from "@bentley/imodeljs-clients";

import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

import { TestUserCredentials } from "../TestUsers";
import { TestUtility } from "../TestUtility";
import { getTokenCallbackName, serializeToken } from "./certaCommon";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in.

// tslint:disable no-console

async function signin(user: TestUserCredentials): Promise<AccessToken> {
  // Handle OIDC signin
  console.log("Starting OIDC signin...");
  console.time("Finished OIDC signin in");

  const clientId = Config.App.get("imjs_oidc_browser_test_client_id");

  if (undefined === clientId)
    throw new Error("Invalid or missing client id.  Please set 'imjs_oidc_browser_test_client_id' to a valid client.");

  // Only getting the token for the `imjs_test_regular_user_name` user.
  // This request is dependent on the following environment variables:
  //    - `imjs_oidc_browser_test_client_id`
  //    - `imjs_oidc_browser_test_redirect_uri`
  //    - `imjs_oidc_browser_test_scopes`

  const token = await TestUtility.getAccessToken(user);
  if (undefined === token)
    throw new Error("Failed to get access token");

  console.timeEnd("Finished OIDC signin in");

  return token;
}

registerBackendCallback(getTokenCallbackName, async (user: any): Promise<string> => {
  const accessToken = await signin(user);
  return JSON.stringify(serializeToken(accessToken));
});

export async function init() {
  IModelJsConfig.init(true, true, Config.App);
}
