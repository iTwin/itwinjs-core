/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager, RpcConfiguration, RpcDefaultConfiguration } from "@bentley/imodeljs-common";
import { MobileRpcManager } from "@bentley/mobile-manager/lib/MobileFrontend";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, MobileTestInterface, MultipleClientsInterface, rpcInterfaces } from "../common/TestRpcInterface";

RpcConfiguration.disableRoutingValidation = true;

function initializeCloud(protocol: string) {
  const port = Number(window.location.port) + 2000;
  const mobilePort = port + 2000;

  const config = BentleyCloudRpcManager.initializeClient({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);
  config.protocol.pathPrefix = `${protocol}://${window.location.hostname}:${port}`;

  initializeMultipleClientsTest(config.protocol.pathPrefix);
  initializeAttachedInterfacesTest(config);
  setupMockMobileFrontend(mobilePort);
}

function setupMockMobileFrontend(port: number) {
  window.location.hash = `port=${port}`;
  MobileRpcManager.initializeClient([MobileTestInterface]);
}

function initializeMultipleClientsTest(path: string) {
  const config1 = BentleyCloudRpcManager.initializeClient(
    { info: { title: `rpc-full-stack-test-config${MultipleClientsInterface.config1.id}`, version: "v1.0" } },
    [MultipleClientsInterface],
    MultipleClientsInterface.config1,
  );

  config1.protocol.pathPrefix = path;

  const config2 = BentleyCloudRpcManager.initializeClient(
    { info: { title: `rpc-full-stack-test-config${MultipleClientsInterface.config2.id}`, version: "v1.0" } },
    [MultipleClientsInterface],
    MultipleClientsInterface.config2,
  );

  config2.protocol.pathPrefix = path;
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  config.attach(AttachedInterface);
}

export let currentEnvironment: string;

before(async () => {
  currentEnvironment = await executeBackendCallback(BackendTestCallbacks.getEnvironment);
  switch (currentEnvironment) {
    case "http":
      return initializeCloud("http");
    case "electron":
      return ElectronApp.startup({ iModelApp: { rpcInterfaces } });
    case "direct": {
      // (global as any).window = undefined;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { commonSetup } = require("../backend/CommonBackendSetup");
      await commonSetup();
      const config = RpcConfiguration.obtain(RpcDefaultConfiguration);
      config.interfaces = () => rpcInterfaces as any;
      return RpcConfiguration.initializeInterfaces(config);
    }
  }
});
