/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "setBackendAccessToken";

export type SerializedAccessToken = [string, any];

type BackendCallbackInvoker = (name: string, ...args: unknown[]) => Promise<unknown>;
let vitestCallback: BackendCallbackInvoker | undefined;

// Vitest supplies its transport without making Certa's Webpack bundle import the ESM-only bridge.
export function setBackendCallbackInvoker(invoke: BackendCallbackInvoker): void {
  vitestCallback = invoke;
}

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  if (vitestCallback)
    return await vitestCallback(getTokenCallbackName, user) as AccessToken;

  const certaCallbackModule = await import("@itwin/certa/lib/utils/CallbackUtils") as unknown as {
    executeBackendCallback?: (name: string, ...args: any[]) => Promise<unknown>;
    default?: { executeBackendCallback?: (name: string, ...args: any[]) => Promise<unknown> };
  };
  const executeCertaBackendCallback = async (name: string, ...args: any[]) =>
    certaCallbackModule.executeBackendCallback?.(name, ...args) ?? certaCallbackModule.default?.executeBackendCallback?.(name, ...args);
  const accessToken = await executeCertaBackendCallback(getTokenCallbackName, user);
  if (accessToken === undefined)
    throw new Error("Certa callback utility does not export executeBackendCallback");
  return accessToken as AccessToken;
}
