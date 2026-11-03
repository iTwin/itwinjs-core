/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend.js";
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";
import { getTokenCallbackName, verticalCrsChangesCallbackName } from "../common/testCallbacks.js";

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  const accessToken = await invokeBackendCallback(getTokenCallbackName, user);
  if (typeof accessToken !== "string")
    throw new Error(`Expected the backend to return an access token string, got ${typeof accessToken}.`);
  return accessToken;
}

/** Drives the backend Vertical CRS changeset fixture; returns the JSON the backend produced for the action. */
export async function executeVerticalCrsChanges(action: "setup" | "update" | "cleanup"): Promise<string> {
  const result = await invokeBackendCallback(verticalCrsChangesCallbackName, action);
  if (typeof result !== "string")
    throw new Error(`Expected the backend to return a string, got ${typeof result}.`);
  return result;
}
