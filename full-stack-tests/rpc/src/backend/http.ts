/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { AttachedInterfaceImpl } from "./TestRpcImpl";
import { TestServer } from "./TestServer";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const port = Number(process.env.CERTA_PORT || 3021) + 2000;
  const server = new TestServer(rpcConfig.protocol);
  await server.initialize(port);

  initializeAttachedInterfacesTest(rpcConfig);

  // eslint-disable-next-line no-console
  console.log(`Web backend for full-stack-tests listening on port ${port}`);
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  AttachedInterfaceImpl.register();
  config.attach(AttachedInterface);
}

module.exports = init();
