/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/bentleyjs-core";
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "../TestUsers";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "getToken";

export type SerializedAccessToken = [string, any];

export async function getAccessTokenFromBackend(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
  const accessToken = await executeBackendCallback(getTokenCallbackName, user, oidcConfig);
  return accessToken;
}
