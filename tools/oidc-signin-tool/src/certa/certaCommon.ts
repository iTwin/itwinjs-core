/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { AccessToken } from "@bentley/itwin-client";
import { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "../TestUsers";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "getToken";

export type SerializedAccessToken = [string, any];

export async function getAccessTokenFromBackend(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
  const accessTokens = await executeBackendCallback(getTokenCallbackName, user, oidcConfig); // TODO: Check if this eventually changes to getting just a token string
  const serializedToken: SerializedAccessToken = JSON.parse(accessTokens);
  return serializedToken[0];
}
