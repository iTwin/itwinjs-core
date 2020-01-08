/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, IncludePrefix, UserInfo } from "@bentley/imodeljs-clients";
import { registerBackendCallback, executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

const getEnvCallbackName = "getEnv";
const getTokensCallbackName = "getTokens";

type SerializedAccessToken = [string, unknown];
function serializeToken(token: AccessToken): SerializedAccessToken {
  return [
    token.toTokenString(IncludePrefix.Yes),
    token.getUserInfo(),
  ];
}

function deserializeToken([tokenStr, userInfo]: SerializedAccessToken): AccessToken {
  const token = AccessToken.fromTokenString(tokenStr);
  token.setUserInfo(UserInfo.fromJson(userInfo)!);
  return token;
}

export function exposeBackendCallbacks(accessTokens: AccessToken[]) {
  registerBackendCallback(getEnvCallbackName, () => {
    return JSON.stringify(process.env);
  });

  registerBackendCallback(getTokensCallbackName, () => {
    return JSON.stringify(accessTokens.map(serializeToken));
  });
}

export async function getProcessEnvFromBackend(): Promise<NodeJS.ProcessEnv> {
  return JSON.parse(await executeBackendCallback(getEnvCallbackName));
}

export async function getAccessTokensFromBackend() {
  const rawTokens: SerializedAccessToken[] = JSON.parse(await executeBackendCallback(getTokensCallbackName));
  return rawTokens.map(deserializeToken);
}
