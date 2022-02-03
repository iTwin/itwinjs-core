/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import type { BentleyCloudRpcConfiguration} from "@itwin/core-common";
import { BentleyCloudRpcManager } from "@itwin/core-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { initializeMockMobileTest, setupMockMobileTest } from "./mockmobile";
import { initializeWebRoutingTest } from "./routing";
import { AttachedInterfaceImpl } from "./TestRpcImpl";
import { TestServer } from "./TestServer";

async function init() {
  const port = Number(process.env.CERTA_PORT || 3021) + 2000;
  const mobilePort = port + 2000;
  await setupMockMobileTest(mobilePort);

  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const server = new TestServer(rpcConfig.protocol);
  await server.initialize(port);
  // eslint-disable-next-line no-console
  console.log(`Web backend for rpc full-stack-tests listening on port ${port}`);

  initializeAttachedInterfacesTest(rpcConfig);
  initializeWebRoutingTest(rpcConfig.protocol);

  await initializeMockMobileTest();

  // eslint-disable-next-line no-console
  console.log(`Mobile backend for rpc full-stack-tests listening on port ${mobilePort}`);
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  AttachedInterfaceImpl.register();
  config.attach(AttachedInterface);
}

module.exports = init();
