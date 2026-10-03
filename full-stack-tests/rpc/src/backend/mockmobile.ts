/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHost, MobileRpcConfiguration, MobileRpcManager } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import type { BackendCallbackRegistrar } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { MobileTestInterface } from "../common/TestRpcInterface";
import { setupIpcTest } from "./ipc";

export async function setupMockMobileTest(port: number) {
  MobileRpcConfiguration.setup = {
    obtainPort: () => port,
    checkPlatform: () => true,
  };
}

export async function initializeMockMobileTest(registerBackendCallback: BackendCallbackRegistrar) {
  await MobileHost.startup();
  MobileRpcManager.initializeImpl([MobileTestInterface]);

  await setupIpcTest(async () => MobileRpcManager.ready(), undefined, registerBackendCallback);
}
