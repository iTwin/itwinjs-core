/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MobileRpcConfiguration, MobileRpcManager } from "@bentley/imodeljs-common";
import { setupIpcTest } from "./ipc";
import { setupPushTest } from "./push";

export async function setupMockMobileTest(port: number) {
  MobileRpcConfiguration.setup = {
    obtainPort: () => port,
    checkPlatform: () => true,
  };
}

export async function initializeMockMobileTest() {
  MobileRpcManager.initializeImpl([]);

  await setupPushTest(async () => MobileRpcManager.ready());
  await setupIpcTest(async () => MobileRpcManager.ready());
}
