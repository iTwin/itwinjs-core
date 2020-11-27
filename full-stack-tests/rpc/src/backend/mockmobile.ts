/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MobileRpcConfiguration, MobileRpcManager } from "@bentley/imodeljs-common";
import { setupPushTest } from "./push";

export async function setupMockMobileTest(port: number): Promise<void> {
  MobileRpcConfiguration.setup = {
    obtainPort: () => port,
    checkPlatform: () => true,
  };
}

export async function initializeMockMobileTest(): Promise<void> {
  MobileRpcManager.initializeImpl([]);

  await setupPushTest(async () => MobileRpcManager.ready());
}
