/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { readBackendCallbackToken } from "@itwin/vitest-browser-bridge/callbacks/http";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager } from "@itwin/core-common";
import { MobileHost } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { backendPortFor, frontendPortEnvVar, parseFrontendPort } from "@itwin/vitest-browser-bridge/ports";
import { mobileBackendPortFor } from "../common/BrowserTestPorts";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { initializeMockMobileTest, setupMockMobileTest } from "./mockmobile";
import { notifyReady } from "./notifyReady";
import { initializeWebRoutingTest } from "./routing";
import { AttachedInterfaceImpl } from "./TestRpcImpl";
import { TestServer } from "./TestServer";

async function init() {
  const frontendPort = parseFrontendPort(process.env[frontendPortEnvVar], frontendPortEnvVar);
  const port = backendPortFor(frontendPort);
  const mobilePort = mobileBackendPortFor(frontendPort);
  await setupMockMobileTest(mobilePort);

  await commonSetup(registerBackendCallback);
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const testServer = new TestServer(rpcConfig.protocol, readBackendCallbackToken(process.env));
  const httpServer = await testServer.initialize(port);

  // eslint-disable-next-line no-console
  console.log(`Web backend for rpc full-stack-tests listening on port ${port}`);

  initializeAttachedInterfacesTest(rpcConfig);
  initializeWebRoutingTest(rpcConfig.protocol);

  await initializeMockMobileTest(registerBackendCallback);

  // eslint-disable-next-line no-console
  console.log(`Mobile backend for rpc full-stack-tests listening on port ${mobilePort}`);
  notifyReady("http");
  return () => {
    httpServer.close();
    MobileHost.onWillTerminate.raiseEvent();
  };
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  AttachedInterfaceImpl.register();
  config.attach(AttachedInterface);
}

module.exports = init();
