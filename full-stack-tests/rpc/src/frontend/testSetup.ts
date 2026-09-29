/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { executeBackendCallback } from "./executeBackendCallback";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager, EmptyLocalization, RpcConfiguration } from "@itwin/core-common";
import { IModelApp, LocalhostIpcApp } from "@itwin/core-frontend";
import { MobileRpcManager } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
import { backendOriginFor, backendPortFor, parseFrontendPort } from "@itwin/vitest-browser-bridge/ports";
import { mobileBackendPortFor } from "../common/BrowserTestPorts";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, MobileTestInterface, MultipleClientsInterface, rpcInterfaces } from "../common/TestRpcInterface";

Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Warning);
RpcConfiguration.disableRoutingValidation = true;

function initializeCloud() {
  const mobilePort = mobileBackendPortFor(parseFrontendPort(window.location.port, "The Vitest page port"));

  const config = BentleyCloudRpcManager.initializeClient({
    info: { title: "rpc-full-stack-test", version: "v1.0" },
    pathPrefix: backendOriginFor(window.location),
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

export const configuredEnvironment = process.env.VITEST_RPC_ENVIRONMENT;
export let currentEnvironment: string;

export async function setupFrontend(electronStartup?: () => Promise<void>) {
  currentEnvironment = await executeBackendCallback(BackendTestCallbacks.getEnvironment);
  // Test skips use the configured environment, so it must match the backend that actually started.
  if (currentEnvironment !== configuredEnvironment)
    throw new Error(`RPC test environment mismatch: configured "${configuredEnvironment}", but the backend reported "${currentEnvironment}".`);
  switch (currentEnvironment) {
    case "http":
      return initializeCloud();
    case "electron":
      if (electronStartup === undefined)
        throw new Error("Electron frontend startup was not provided.");
      await electronStartup();
      return;
    case "websocket":
      let socketUrl = new URL(window.location.toString());
      socketUrl.port = backendPortFor(parseFrontendPort(socketUrl.port, "The Vitest page port")).toString();
      socketUrl = LocalhostIpcApp.buildUrlForSocket(socketUrl);

      BentleyCloudRpcManager.initializeClient({ info: { title: "", version: "" } }, rpcInterfaces);
      return LocalhostIpcApp.startup({
        localhostIpcApp: { socketUrl },
        iModelApp: { localization: new EmptyLocalization() },
      });
  }
}

export async function teardownFrontend() {
  if (currentEnvironment === "websocket")
    await IModelApp.shutdown();
}
