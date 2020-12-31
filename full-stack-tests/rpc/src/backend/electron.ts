/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendIpc } from "@bentley/imodeljs-backend";
import { ElectronRpcManager } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { setupPushTest } from "./push";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");
  const electronManager = new (require("@bentley/electron-manager").ElectronManager)();
  BackendIpc.initialize(electronManager);
  const rpcConfig = ElectronRpcManager.initializeImpl({}, rpcInterfaces, electronManager);

  registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
    rpcConfig.protocol.transferChunkThreshold = value;
    return true;
  });

  await setupPushTest();
}

module.exports = init();
