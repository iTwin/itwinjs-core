/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcConfiguration, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config } from "@bentley/imodeljs-clients";
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import { TestRpcImpl2, resetOp8Initializer } from "./TestRpcImpl";

IModelJsConfig.init(true, true, Config.App);
RpcConfiguration.developmentMode = true;

// Start the backend
IModelHost.startup();

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
  IModelReadRpcInterface.version = "0.0.0";
  return true;
});

const compatibleVersion = IModelReadRpcInterface.version;
registerBackendCallback(BackendTestCallbacks.restoreIncompatibleInterfaceVersion, () => {
  IModelReadRpcInterface.version = compatibleVersion;
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
