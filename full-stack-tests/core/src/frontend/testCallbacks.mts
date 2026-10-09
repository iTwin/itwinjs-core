/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend.js";
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";
import { getTokenCallbackName } from "../common/testCallbacks.js";

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  const accessToken = await invokeBackendCallback(getTokenCallbackName, user);
  if (typeof accessToken !== "string")
    throw new Error(`Expected the backend to return an access token string, got ${typeof accessToken}.`);
  return accessToken;
}
