/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-certa-bridge/callbackRegistry";
import { executeBackendCallback } from "@itwin/vitest-certa-bridge/client";

const getEnvCallbackName = "getEnv";

export function exposeBackendCallbacks() {
  registerBackendCallback(getEnvCallbackName, () => {
    return JSON.stringify(process.env);
  });
}

export async function getProcessEnvFromBackend(): Promise<NodeJS.ProcessEnv> {
  return JSON.parse(await executeBackendCallback(getEnvCallbackName));
}
