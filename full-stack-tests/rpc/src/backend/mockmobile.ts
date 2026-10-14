/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { MobileHost, MobileRpcConfiguration, MobileRpcManager } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { MobileRpcServer } from "@itwin/core-mobile/lib/cjs/backend/MobileRpcServer";
import { BackendTestCallbacks } from "../common/SideChannels";
import { MobileTestInterface } from "../common/TestRpcInterface";
import { setupIpcTest } from "./ipc";

export async function setupMockMobileTest(port: number) {
  MobileRpcConfiguration.setup = {
    obtainPort: () => port,
    checkPlatform: () => true,
  };
}

export async function initializeMockMobileTest() {
  await MobileHost.startup();
  MobileRpcManager.initializeImpl([MobileTestInterface]);

  registerBackendCallback(BackendTestCallbacks.startMockMobileTest, () => MobileRpcServer.rpcToken);
  registerBackendCallback(BackendTestCallbacks.restartMockMobileTest, async () => {
    const reconnect = MobileHost.device.reconnect?.bind(MobileHost.device);
    try {
      return await new Promise<string>((resolve) => {
        MobileHost.device.reconnect = (port) => resolve(JSON.stringify({ port, rpcToken: MobileRpcServer.rpcToken }));
        MobileHost.onEnterBackground.raiseEvent();
        MobileHost.onEnterForeground.raiseEvent();
      });
    } finally {
      MobileHost.device.reconnect = reconnect;
    }
  });

  await setupIpcTest(async () => MobileRpcManager.ready());
}
