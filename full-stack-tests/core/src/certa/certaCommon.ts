/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import type { AccessToken } from "@itwin/core-bentley";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "setBackendAccessToken";

export type SerializedAccessToken = [string, any];

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  const accessToken = await executeBackendCallback(getTokenCallbackName, user);
  return accessToken;
}
