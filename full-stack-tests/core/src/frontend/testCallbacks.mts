/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import type { AccessToken } from "@itwin/core-bentley";

interface TestUserCredentials {
  email: string;
  password: string;
  scope?: string;
}
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";
import { createHttpBackendCallbackInvoker } from "@itwin/vitest-browser-bridge/callbacks/http";
import { browserBackendCallbackPath, getTokenCallbackName } from "../common/testCallbacks.js";

const invokeHttpBackendCallback = createHttpBackendCallbackInvoker({
  url: () => {
    const backendUrl = new URL(window.location.href);
    backendUrl.port = (Number(backendUrl.port) + 2000).toString();
    backendUrl.pathname = browserBackendCallbackPath;
    backendUrl.search = "";
    backendUrl.hash = "";
    return backendUrl.toString();
  },
});

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  const accessToken = ProcessDetector.isElectronAppFrontend
    ? await invokeBackendCallback(getTokenCallbackName, user)
    : await invokeHttpBackendCallback(getTokenCallbackName, user);
  return accessToken as AccessToken;
}
