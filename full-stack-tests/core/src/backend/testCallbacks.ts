/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { AccessToken } from "@itwin/core-bentley";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { TestUtility as OidcTestUtility } from "@itwin/oidc-signin-tool";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { getTokenCallbackName } from "../common/testCallbacks";

/** Lets the Electron test backend inject the token it signed in with; `setAccessToken` is protected in the base class. */
export class TestElectronMainAuthorization extends ElectronMainAuthorization {
  public override setAccessToken(token: AccessToken): void {
    super.setAccessToken(token);
  }
}

/** Register backend callbacks used by both the Chromium and Electron test runners.
 * @param electronAuth The Electron backend's authorization client, which serves tokens to the renderer; omit for Chrome.
 */
export function exposeBackendCallbacks(electronAuth?: TestElectronMainAuthorization) {
  registerBackendCallback(getTokenCallbackName, async (user: TestUserCredentials): Promise<AccessToken> => {
    const accessToken = electronAuth
      ? await OidcTestUtility.getAuthorizationClient(user, {
        clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
        redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "testRedirectUri",
        scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
      }).getAccessToken()
      : await OidcTestUtility.getAccessToken(user);

    electronAuth?.setAccessToken(accessToken);

    return accessToken;
  });
}
