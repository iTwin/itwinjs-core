/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { getTokenCallbackName } from "./certaCommon";
import { AccessToken, ProcessDetector } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { TestUtility as OidcTestUtility } from "@itwin/oidc-signin-tool/lib/cjs/TestUtility";

async function getAccessToken(user: any, oidcConfig?: any): Promise<AccessToken> {
  const accessToken = oidcConfig === undefined || oidcConfig === null
    ? await OidcTestUtility.getAccessToken(user)
    : await OidcTestUtility.getAuthorizationClient(user, oidcConfig).getAccessToken();

  // Only set the backend auth client in Electron — in Chrome/web mode this function
  // runs in the Vite dev-server process which has no IModelHost auth client.
  if (ProcessDetector.isElectronAppBackend) {
    const authClient = IModelHost.authorizationClient as { setAccessToken?(token: AccessToken): void } | undefined;
    authClient?.setAccessToken?.(accessToken);
  }
  return accessToken;
}

// "getToken" is the legacy callback name used by @itwin/oidc-signin-tool and other
// external packages that predate the vitest-certa-bridge migration.
const legacyGetTokenCallbackName = "getToken";

export function exposeBackendCallbacks(){
  registerBackendCallback(getTokenCallbackName, getAccessToken);
  registerBackendCallback(legacyGetTokenCallbackName, getAccessToken);
}
