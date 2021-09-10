/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { ElectronHost } from "@bentley/electron-manager/cjs/ElectronBackend";
import { BackendTestCallbacks } from "../common/SideChannels";
import { commonSetup } from "./CommonBackendSetup";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");
  registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
    ElectronHost.rpcConfig.protocol.transferChunkThreshold = value;
    return true;
  });

}

module.exports = init();
