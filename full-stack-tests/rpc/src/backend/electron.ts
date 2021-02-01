/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import { commonSetup } from "./CommonBackendSetup";
import { setupPushTest } from "./push";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");
  registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
    ElectronHost.rpcConfig.protocol.transferChunkThreshold = value;
    return true;
  });

  await setupPushTest();
}

module.exports = init();
