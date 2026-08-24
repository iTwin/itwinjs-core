/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { AccessToken, ProcessDetector } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { TestUtility as OidcTestUtility } from "@itwin/oidc-signin-tool";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { getTokenCallbackName } from "../common/testCallbacks";

/** Register backend callbacks used by both the Chromium and Electron test runners. */
export function exposeBackendCallbacks() {
  registerBackendCallback(getTokenCallbackName, async (user: TestUserCredentials): Promise<AccessToken> => {
    const accessToken = ProcessDetector.isElectronAppBackend
      ? await OidcTestUtility.getAuthorizationClient(user, {
        clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
        redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "testRedirectUri",
        scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
      }).getAccessToken()
      : await OidcTestUtility.getAccessToken(user);

    if (ProcessDetector.isElectronAppBackend)
      (IModelHost.authorizationClient as ElectronMainAuthorization as any).setAccessToken(accessToken);

    return accessToken;
  });
}
