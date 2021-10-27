/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { IModelHost } from "@itwin/core-backend";
import { IModelReadRpcInterface, RpcConfiguration } from "@itwin/core-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { resetOp8Initializer, TestRpcImpl2 } from "./TestRpcImpl";

export async function commonSetup(): Promise<void> {
  RpcConfiguration.developmentMode = true;

  // Start the backend
  if (ProcessDetector.isElectronAppBackend){
    const baseOidcScopes = [
      "openid",
      "email",
      "profile",
      "organization",
      "itwinjs",
    ];
    const authConfig = {
      clientId: "imodeljs-spa-test",
      redirectUri: "http://localhost:3000/signin-callback",
      scope: baseOidcScopes.join(" "),
    };
    await ElectronHost.startup({ electronHost: { rpcInterfaces, authConfig } });
  } else
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
  Logger.setLevel("core-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("core-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture
}
