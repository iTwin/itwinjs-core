/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback as registerVitestBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { registerBackendCallback as registerCertaBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { getTokenCallbackName } from "./certaCommon";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { AccessToken } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { TestUtility as OidcTestUtility } from "@itwin/oidc-signin-tool";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in

export function exposeBackendCallbacks(){
  const registerBackendCallback = process.env.VITEST_CORE_RUNNER === "vitest" ? registerVitestBackendCallback : registerCertaBackendCallback;
  registerBackendCallback(getTokenCallbackName, async (user: any): Promise<AccessToken> => {
    const accessToken = await OidcTestUtility.getAuthorizationClient(user, {
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
      redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "testRedirectUri",
      scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
    }).getAccessToken();
    (IModelHost.authorizationClient as ElectronMainAuthorization as any).setAccessToken(accessToken);
    return accessToken;
  });
}
