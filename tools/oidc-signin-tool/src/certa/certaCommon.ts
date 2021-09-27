/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { AccessToken, IncludePrefix, UserInfo } from "@bentley/itwin-client";
import { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "../TestUsers";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "getToken";

export type SerializedAccessToken = [string, any];
export function serializeToken(token: AccessToken): SerializedAccessToken {
  return [
    token.toTokenString(IncludePrefix.Yes),
    token.getUserInfo(),
  ];
}

export function deserializeToken([tokenStr, userInfo]: SerializedAccessToken): AccessToken {
  const token = AccessToken.fromTokenString(tokenStr);
  token.setUserInfo(new UserInfo(userInfo.id, userInfo.email, userInfo.profile, userInfo.organization, userInfo.featureTracking));
  return token;
}

export async function getAccessTokenFromBackend(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
  const accessTokens = await executeBackendCallback(getTokenCallbackName, user, oidcConfig);
  return deserializeToken(JSON.parse(accessTokens));
}
