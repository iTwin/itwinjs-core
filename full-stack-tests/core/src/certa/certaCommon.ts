/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "setBackendAccessToken";
export const verticalCrsChangesCallbackName = "verticalCrsChanges";

export type SerializedAccessToken = [string, any];

type BackendCallbackInvoker = (name: string, ...args: unknown[]) => Promise<unknown>;
let vitestCallback: BackendCallbackInvoker | undefined;

// Vitest supplies its transport without making Certa's Webpack bundle import the ESM-only bridge.
export function setBackendCallbackInvoker(invoke: BackendCallbackInvoker): void {
  vitestCallback = invoke;
}

/** Runs a callback registered by the backend, through the Vitest bridge when it is installed and through Certa otherwise. */
export async function executeBackendCallback(name: string, ...args: unknown[]): Promise<any> {
  if (vitestCallback)
    return vitestCallback(name, ...args);

  const certaCallbackModule = await import("@itwin/certa/lib/utils/CallbackUtils") as unknown as {
    executeBackendCallback?: (name: string, ...args: any[]) => Promise<unknown>;
    default?: { executeBackendCallback?: (name: string, ...args: any[]) => Promise<unknown> };
  };
  const executeCertaBackendCallback = certaCallbackModule.executeBackendCallback ?? certaCallbackModule.default?.executeBackendCallback;
  if (!executeCertaBackendCallback)
    throw new Error("Certa callback utility does not export executeBackendCallback");
  return executeCertaBackendCallback(name, ...args);
}

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  return await executeBackendCallback(getTokenCallbackName, user) as AccessToken;
}
