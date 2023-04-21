/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager, EmptyLocalization, RpcConfiguration } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { IModelApp, LocalhostIpcApp } from "@itwin/core-frontend";
import { MobileRpcManager } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, MobileTestInterface, MultipleClientsInterface, rpcInterfaces } from "../common/TestRpcInterface";

Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);
RpcConfiguration.disableRoutingValidation = true;

function initializeCloud(protocol: string) {
  const port = Number(window.location.port) + 2000;
  const mobilePort = port + 2000;

  const config = BentleyCloudRpcManager.initializeClient({
    info: { title: "rpc-full-stack-test", version: "v1.0" },
    pathPrefix: `${protocol}://${window.location.hostname}:${port}`,
  }, rpcInterfaces);

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
      return ElectronApp.startup({
        iModelApp: {
          rpcInterfaces,
          localization: new EmptyLocalization(),
        },
      });
    case "websocket":
      let socketUrl = new URL(window.location.toString());
      socketUrl.port = (parseInt(socketUrl.port, 10) + 2000).toString();
      socketUrl = LocalhostIpcApp.buildUrlForSocket(socketUrl);

      BentleyCloudRpcManager.initializeClient({ info: { title: "", version: "" } }, rpcInterfaces);
      return LocalhostIpcApp.startup({
        localhostIpcApp: { socketUrl },
        iModelApp: { localization: new EmptyLocalization() },
      });
  }
});

after(async () => {
  if (currentEnvironment === "websocket") {
    await IModelApp.shutdown();
  }
});
