/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config, isElectronMain, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelHost, NativeHost } from "@bentley/imodeljs-backend";
import { IModelReadRpcInterface, RpcConfiguration } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { resetOp8Initializer, TestRpcImpl2 } from "./TestRpcImpl";

export async function commonSetup(): Promise<void> {
  IModelJsConfig.init(true, true, Config.App);
  RpcConfiguration.developmentMode = true;

  // Start the backend
  if (isElectronMain)
    await NativeHost.startup();
  else
    await IModelHost.startup();

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
  Logger.setLevel("imodeljs-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("imodeljs-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture
}
