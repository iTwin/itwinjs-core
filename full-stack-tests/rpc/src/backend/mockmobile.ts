/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MobileHost, MobileRpcConfiguration, MobileRpcManager } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { MobileTestInterface } from "../common/TestRpcInterface";
import { setupIpcTest } from "./ipc";

export async function setupMockMobileTest(port: number) {
  MobileRpcConfiguration.setup = { // eslint-disable-line deprecation/deprecation
    obtainPort: () => port,
    checkPlatform: () => true,
  };
}

export async function initializeMockMobileTest() {
  await MobileHost.startup();
  MobileRpcManager.initializeImpl([MobileTestInterface]); // eslint-disable-line deprecation/deprecation

  await setupIpcTest(async () => MobileRpcManager.ready()); // eslint-disable-line deprecation/deprecation
}
