/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { getTokenCallbackName } from "./certaCommon";
import { IModelHost } from "@itwin/core-backend";
import { TestUtility } from "@itwin/oidc-signin-tool/lib/cjs/";
import { ElectronAuthorizationBackend } from "@itwin/electron-authorization/lib/cjs/ElectronBackend";
import { AccessToken } from "@itwin/core-bentley";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in

export function exposeBackendCallbacks(){
  registerBackendCallback(getTokenCallbackName, async (user: any, oidcConfig?: any): Promise<AccessToken> => {
    const testAuthClient = TestUtility.getAuthorizationClient(user, oidcConfig);
    const accessToken = await testAuthClient.getAccessToken();
    (IModelHost.authorizationClient as ElectronAuthorizationBackend).setAccessToken(accessToken);
    return accessToken;
  });
}
