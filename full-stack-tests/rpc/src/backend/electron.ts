/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { setupPushTest } from "./push";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const ElectronManager = (await import("@bentley/electron-manager")).ElectronManager;
  const manager = new ElectronManager({ rpcInterfaces });

  registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
    manager.rpcConfig.protocol.transferChunkThreshold = value;
    return true;
  });

  await setupPushTest();
}

module.exports = init();
