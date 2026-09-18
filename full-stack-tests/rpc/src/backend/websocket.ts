/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { createHttpBackendCallbackHandler } from "@itwin/vitest-browser-bridge/callbacks/http";
import { LocalhostIpcHost } from "@itwin/core-backend";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager } from "@itwin/core-common";
import { WebEditServer } from "@itwin/express-server";
import { BackendTestCallbacks, browserBackendCallbackPath } from "../common/SideChannels";
import { AttachedInterface, rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { setupIpcTest } from "./ipc";
import { AttachedInterfaceImpl } from "./TestRpcImpl";

async function init() {
  const port = Number(process.env.VITEST_FRONTEND_PORT || 3020) + 2000;

  await commonSetup(registerBackendCallback);
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "websocket");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const webEditServer = new TestWebEditServer(rpcConfig.protocol);
  const httpServer = await webEditServer.initialize(port);

  await LocalhostIpcHost.startup({ localhostIpcHost: { noServer: true } });

  // eslint-disable-next-line no-console
  console.log(`Web backend for rpc full-stack-tests listening on port ${port}`);

  initializeAttachedInterfacesTest(rpcConfig);
  setupIpcTest(async () => Promise.resolve(), LocalhostIpcHost.socket, registerBackendCallback); // eslint-disable-line @typescript-eslint/no-floating-promises

  return () => {
    httpServer.close();
  };
}

class TestWebEditServer extends WebEditServer {
  protected override _configureHeaders() {
    super._configureHeaders();
    this._app.post(browserBackendCallbackPath, createHttpBackendCallbackHandler());
  }
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  AttachedInterfaceImpl.register();
  config.attach(AttachedInterface);
}

module.exports = init();
