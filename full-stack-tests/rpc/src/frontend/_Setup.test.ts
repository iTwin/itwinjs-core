/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BentleyCloudRpcManager, ElectronRpcManager, RpcConfiguration, RpcDefaultConfiguration } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";

RpcConfiguration.disableRoutingValidation = true;

function initializeCloud(protocol: string) {
  const config = BentleyCloudRpcManager.initializeClient({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);
  config.protocol.pathPrefix = `${protocol}://${window.location.hostname}:${Number(window.location.port) + 2000}`;
}

before(async () => {
  const currentEnvironment: string = await executeBackendCallback(BackendTestCallbacks.getEnvironment);
  switch (currentEnvironment) {
    case "http": return initializeCloud("http");
    case "electron": return ElectronRpcManager.initializeClient({}, rpcInterfaces);
    case "direct": {
      // (global as any).window = undefined;
      const { commonSetup } = require("../backend/CommonBackendSetup");
      await commonSetup();
      const config = RpcConfiguration.obtain(RpcDefaultConfiguration);
      config.interfaces = () => rpcInterfaces as any;
      return RpcConfiguration.initializeInterfaces(config);
    }
  }

  throw new Error(`Invalid test environment: "${currentEnvironment}"`);
});
