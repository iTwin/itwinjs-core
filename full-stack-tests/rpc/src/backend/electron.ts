/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import { commonSetup } from "./CommonBackendSetup";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { setupIpcTestElectron } from "./ipc";

async function init() {
  await commonSetup();
  registerBackendCallback(
    BackendTestCallbacks.getEnvironment,
    () => "electron"
  );
  registerBackendCallback(
    BackendTestCallbacks.setChunkThreshold,
    (value: number) => {
      ElectronHost.rpcConfig.protocol.transferChunkThreshold = value;
      return true;
    }
  );
  setupIpcTestElectron();
}

module.exports = init();
