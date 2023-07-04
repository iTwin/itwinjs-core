/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, ProcessDetector } from "@itwin/core-bentley";
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { IModelHost } from "@itwin/core-backend";
import { IModelReadRpcInterface, RpcConfiguration } from "@itwin/core-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { resetOp8Initializer, TestRpcImpl2 } from "./TestRpcImpl";
import { join } from "path";

export async function commonSetup(): Promise<void> {
  RpcConfiguration.developmentMode = true;

  const cacheDir = join(__dirname, ".cache");
  // Start the backend
  if (ProcessDetector.isElectronAppBackend) {
    await ElectronHost.startup({ electronHost: { rpcInterfaces }, iModelHost: { cacheDir } });
  } else
    await IModelHost.startup({ cacheDir });

  registerBackendCallback(BackendTestCallbacks.registerTestRpcImpl2Class, () => {
    TestRpcImpl2.register();
    TestRpcImpl2.instantiate();
    return true;
  });

  registerBackendCallback(BackendTestCallbacks.replaceTestRpcImpl2Instance, () => {
    TestRpcImpl2.instantiate();
    return true;
  });

  registerBackendCallback(BackendTestCallbacks.unregisterTestRpcImpl2Class, () => {
    TestRpcImpl2.unregister();
    return true;
  });

  registerBackendCallback(BackendTestCallbacks.setIncompatibleInterfaceVersion, () => {
    IModelReadRpcInterface.interfaceVersion = "0.0.0";
    return true;
  });

  const compatibleVersion = IModelReadRpcInterface.interfaceVersion;
  registerBackendCallback(BackendTestCallbacks.restoreIncompatibleInterfaceVersion, () => {
    IModelReadRpcInterface.interfaceVersion = compatibleVersion;
    return true;
  });

  registerBackendCallback(BackendTestCallbacks.resetOp8Initializer, () => {
    resetOp8Initializer();
    return true;
  });

  Logger.initializeToConsole();
}
