/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import type { AccessToken } from "@itwin/core-bentley";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend.js";
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";
import { backendCallbackTokenKey, createHttpBackendCallbackInvoker } from "@itwin/vitest-browser-bridge/callbacks/http";
import { inject } from "vitest";
import { backendOriginFor } from "@itwin/vitest-browser-bridge/ports";
import { browserBackendCallbackPath, getTokenCallbackName } from "../common/testCallbacks.js";

const invokeHttpBackendCallback = createHttpBackendCallbackInvoker({
  url: () => `${backendOriginFor(window.location)}${browserBackendCallbackPath}`,
  token: () => inject(backendCallbackTokenKey),
});

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  const accessToken = ProcessDetector.isElectronAppFrontend
    ? await invokeBackendCallback(getTokenCallbackName, user)
    : await invokeHttpBackendCallback(getTokenCallbackName, user);
  if (typeof accessToken !== "string")
    throw new Error(`Expected the backend to return an access token string, got ${typeof accessToken}.`);
  return accessToken;
}
