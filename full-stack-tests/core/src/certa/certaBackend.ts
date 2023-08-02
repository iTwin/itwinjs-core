/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { getTokenCallbackName } from "./certaCommon";
import { TestUtility } from "@itwin/oidc-signin-tool/lib/cjs/";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { AccessToken } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in

export function exposeBackendCallbacks(){
  registerBackendCallback(getTokenCallbackName, async (user: any): Promise<AccessToken> => {
    const accessToken = await TestUtility.getAccessToken(user);
    await (IModelHost.authorizationClient as ElectronMainAuthorization).signInSilent();
    return accessToken;
  });
}
