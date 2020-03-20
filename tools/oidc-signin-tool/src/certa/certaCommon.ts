/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, IncludePrefix, UserInfo } from "@bentley/imodeljs-clients";
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

import { TestUserCredentials, TestOidcConfiguration } from "../TestUsers";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "getToken";

export type SerializedAccessToken = [string, any];
export function serializeToken(token: AccessToken): SerializedAccessToken {
  return [
    token.toTokenString(IncludePrefix.Yes),
    token.getUserInfo(),
  ];
}

function deserializeToken([tokenStr, userInfo]: SerializedAccessToken): AccessToken {
  const token = AccessToken.fromTokenString(tokenStr);
  token.setUserInfo(new UserInfo(userInfo.id, userInfo.email, userInfo.profile, userInfo.organization, userInfo.featureTracking));
  return token;
}

export async function getAccessTokenFromBackend(user: TestUserCredentials, oidcConfig?: TestOidcConfiguration): Promise<AccessToken> {
  const accessTokens = await executeBackendCallback(getTokenCallbackName, user, oidcConfig);
  return deserializeToken(JSON.parse(accessTokens));
}
