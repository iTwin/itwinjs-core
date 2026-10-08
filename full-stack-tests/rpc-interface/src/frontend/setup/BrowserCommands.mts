/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { ServiceAuthorizationClientConfiguration } from "@itwin/service-authorization";
import { commands } from "vitest/browser";

// Implemented in vitest.config.mts, where the environment and credentials live.
declare module "vitest/browser" {
  interface BrowserCommands {
    getEnv: () => Promise<string>;
    getServiceAuthToken: (config: ServiceAuthorizationClientConfiguration) => Promise<AccessToken>;
  }
}

export async function getProcessEnv(): Promise<NodeJS.ProcessEnv> {
  return JSON.parse(await commands.getEnv());
}

export async function getServiceAuthToken(config: ServiceAuthorizationClientConfiguration): Promise<AccessToken> {
  return commands.getServiceAuthToken(config);
}

export async function getClientAccessToken(): Promise<AccessToken> {
  // const authClient = new ServiceAuthorizationClient(clientConfiguration);
  // const token = await authClient.getAccessToken();
  return "";
}
