/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { LocalhostIpcHost } from "@itwin/core-backend";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager } from "@itwin/core-common";
import { WebEditServer } from "@itwin/express-server";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { AttachedInterfaceImpl } from "./TestRpcImpl";

async function init() {
  const port = Number(process.env.CERTA_PORT || 3021) + 2000;

  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "websocket");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const webEditServer = new WebEditServer(rpcConfig.protocol);
  const httpServer = await webEditServer.initialize(port);

  await LocalhostIpcHost.startup({ localhostIpcHost: { noServer: true } });

  // eslint-disable-next-line no-console
  console.log(`Web backend for rpc full-stack-tests listening on port ${port}`);

  initializeAttachedInterfacesTest(rpcConfig);

  return () => {
    httpServer.close();
  };
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  AttachedInterfaceImpl.register();
  config.attach(AttachedInterface);
}

module.exports = init();
