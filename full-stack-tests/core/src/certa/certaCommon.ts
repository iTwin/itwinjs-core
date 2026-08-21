/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, ProcessDetector } from "@itwin/core-bentley";
import { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";

// Shared by both the frontend and backend side of the tests
export const getTokenCallbackName = "setBackendAccessToken";

export type SerializedAccessToken = [string, any];

// Keep Certa's CommonJS Webpack bundle from resolving the bridge's ESM-only browser export.
// The loader is only evaluated by the Vitest Electron renderer.
interface VitestCallbackModule {
  invokeBackendCallback(name: string, ...args: unknown[]): Promise<unknown>;
}

const loadVitestCallback = new Function("return import('@itwin/vitest-browser-bridge/callbacks/browser');") as () => Promise<VitestCallbackModule>;

export async function setBackendAccessToken(user: TestUserCredentials): Promise<AccessToken> {
  if (ProcessDetector.isElectronAppFrontend) {
    const vitestCallbackModule = await loadVitestCallback();
    return await vitestCallbackModule.invokeBackendCallback(getTokenCallbackName, user) as AccessToken;
  }

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
