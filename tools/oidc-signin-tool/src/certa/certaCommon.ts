/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, IncludePrefix, UserInfo } from "@bentley/imodeljs-clients";
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

import { TestUserCredentials } from "../TestUsers";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "getToken";

export type SerializedAccessToken = [string, unknown];
export function serializeToken(token: AccessToken): SerializedAccessToken {
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

export async function getAccessTokenFromBackend(user: TestUserCredentials): Promise<AccessToken> {
  const accessTokens = await executeBackendCallback(getTokenCallbackName, user);
  return deserializeToken(JSON.parse(accessTokens));
}
