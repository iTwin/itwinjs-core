/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { setupPushTest } from "./push";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronHost";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");
  await ElectronHost.startup({ electronHost: { rpcInterfaces } });
  registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
    ElectronHost.rpcConfig.protocol.transferChunkThreshold = value;
    return true;
  });

  await setupPushTest();
}

module.exports = init();
