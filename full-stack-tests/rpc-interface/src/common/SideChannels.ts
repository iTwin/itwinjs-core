/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// import { ServiceAuthorizationClient, ServiceAuthorizationClientConfiguration } from "@itwin/service-authorization";
import { AccessToken } from "@itwin/core-bentley";
import { executeBackendCallback, registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";

const getEnvCallbackName = "getEnv";
const getClientAccessTokenCallbackName = "getClientAccessToken";

export function exposeBackendCallbacks() {
  registerBackendCallback(getEnvCallbackName, () => {
    return JSON.stringify(process.env);
  });

  registerBackendCallback(getClientAccessTokenCallbackName, async () => {
    // const authClient = new ServiceAuthorizationClient(clientConfiguration);
    // const token = await authClient.getAccessToken();
    return "";
  });
}

export async function getProcessEnvFromBackend(): Promise<NodeJS.ProcessEnv> {
  return JSON.parse(await executeBackendCallback(getEnvCallbackName));
}
export async function getClientAccessTokenFromBackend(): Promise<AccessToken> {
  // const tokenString = await executeBackendCallback(getClientAccessTokenCallbackName, clientConfiguration);
  return "";
}
