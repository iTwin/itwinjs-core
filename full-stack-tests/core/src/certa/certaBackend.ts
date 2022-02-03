/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { getTokenCallbackName } from "./certaCommon";
import { IModelHost } from "@itwin/core-backend";
import { TestUtility } from "@itwin/oidc-signin-tool/lib/cjs/";
import type { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import type { AccessToken } from "@itwin/core-bentley";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in

export function exposeBackendCallbacks(){
  registerBackendCallback(getTokenCallbackName, async (user: any): Promise<AccessToken> => {
    const testAuthClient = TestUtility.getAuthorizationClient(user, {
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
      scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",
    });
    const accessToken = await testAuthClient.getAccessToken();
    (IModelHost.authorizationClient as ElectronMainAuthorization).setAccessToken(accessToken);
    return accessToken;
  });
}
