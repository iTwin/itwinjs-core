/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { getTokenCallbackName } from "./certaCommon";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { AccessToken } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { TestUtility } from "../frontend/TestUtility";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in

export function exposeBackendCallbacks(){
  registerBackendCallback(getTokenCallbackName, async (user: any): Promise<AccessToken> => {
    const accessToken = await TestUtility.getAccessToken(user, {
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
      redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "testRedirectUri",
      scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
    });
    (IModelHost.authorizationClient as ElectronMainAuthorization as any).setAccessToken(accessToken);
    return accessToken;
  });
}
