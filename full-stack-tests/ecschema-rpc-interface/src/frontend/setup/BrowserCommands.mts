/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "@itwin/oidc-signin-tool";
import { commands } from "vitest/browser";

// Implemented in vitest.config.mts, where the environment and credentials live.
declare module "vitest/browser" {
  interface BrowserCommands {
    getEnv: () => Promise<string>;
    getAccessToken: (user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration) => Promise<AccessToken>;
  }
}

export async function getProcessEnv(): Promise<NodeJS.ProcessEnv> {
  return JSON.parse(await commands.getEnv());
}

export async function getAccessToken(user: TestUserCredentials, oidcConfig?: TestBrowserAuthorizationClientConfiguration): Promise<AccessToken> {
  return commands.getAccessToken(user, oidcConfig);
}
