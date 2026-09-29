/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { inject } from "vitest";
import { backendCallbackTokenKey, createHttpBackendCallbackInvoker } from "@itwin/vitest-browser-bridge/callbacks/http";
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";
import { ProcessDetector } from "@itwin/core-bentley";
import { backendOriginFor } from "@itwin/vitest-browser-bridge/ports";
import { browserBackendCallbackPath } from "../common/SideChannels";

const invokeHttpBackendCallback = createHttpBackendCallbackInvoker({
  url: () => `${backendOriginFor(window.location)}${browserBackendCallbackPath}`,
  token: () => inject(backendCallbackTokenKey),
});

export async function executeBackendCallback(name: string, ...args: any[]): Promise<any> {
  if (ProcessDetector.isElectronAppFrontend)
    return invokeBackendCallback(name, ...args);

  return invokeHttpBackendCallback(name, ...args);
}
