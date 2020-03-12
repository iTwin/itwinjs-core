/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback, executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

const getEnvCallbackName = "getEnv";

export function exposeBackendCallbacks() {
  registerBackendCallback(getEnvCallbackName, () => {
    return JSON.stringify(process.env);
  });
}

export async function getProcessEnvFromBackend(): Promise<NodeJS.ProcessEnv> {
  return JSON.parse(await executeBackendCallback(getEnvCallbackName));
}
