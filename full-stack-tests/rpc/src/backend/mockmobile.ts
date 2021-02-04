/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileRpcConfiguration, MobileRpcManager, MobileHost } from "@bentley/mobile-manager/lib/MobileBackend";
import { setupIpcTest } from "./ipc";

export async function setupMockMobileTest(port: number) {
  MobileRpcConfiguration.setup = {
    obtainPort: () => port,
    checkPlatform: () => true,
  };
}

export async function initializeMockMobileTest() {
  MobileHost.startup();
  MobileRpcManager.initializeImpl([]);

  await setupIpcTest(async () => MobileRpcManager.ready());
}
