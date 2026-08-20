/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createHttpBackendCallbackInvoker } from "@itwin/vitest-browser-bridge/callbacks/http";
import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";
import { ProcessDetector } from "@itwin/core-bentley";
import { browserBackendCallbackPath } from "../common/SideChannels";

const invokeHttpBackendCallback = createHttpBackendCallbackInvoker({
  url: () => {
    const backendPort = Number(window.location.port) + 2000;
    return `${window.location.protocol}//${window.location.hostname}:${backendPort}${browserBackendCallbackPath}`;
  },
});

export async function executeBackendCallback(name: string, ...args: any[]): Promise<any> {
  if (ProcessDetector.isElectronAppFrontend)
    return invokeBackendCallback(name, ...args);

  return invokeHttpBackendCallback(name, ...args);
}
