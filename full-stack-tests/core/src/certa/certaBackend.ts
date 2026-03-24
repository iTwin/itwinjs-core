/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { getTokenCallbackName } from "./certaCommon";
import { AccessToken } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { TestUtility as OidcTestUtility } from "@itwin/oidc-signin-tool/lib/cjs/TestUtility";

const legacyGetTokenCallbackName = "getToken";

async function getAccessToken(user: any, oidcConfig?: any): Promise<AccessToken> {
  const accessToken = oidcConfig === undefined || oidcConfig === null
    ? await OidcTestUtility.getAccessToken(user)
    : await OidcTestUtility.getAuthorizationClient(user, oidcConfig).getAccessToken();

  // Electron uses the backend auth client to satisfy some backend-side requests.
  const authClient = IModelHost.authorizationClient as { setAccessToken?(token: AccessToken): void } | undefined;
  authClient?.setAccessToken?.(accessToken);
  return accessToken;
}

export function exposeBackendCallbacks(){
  registerBackendCallback(getTokenCallbackName, getAccessToken);
  registerBackendCallback(legacyGetTokenCallbackName, getAccessToken);
}
