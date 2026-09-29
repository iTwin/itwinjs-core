/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { readBackendCallbackToken } from "@itwin/vitest-browser-bridge/callbacks/http";
import { LocalhostIpcHost } from "@itwin/core-backend";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager, WebAppRpcProtocol } from "@itwin/core-common";
import { WebEditServer } from "@itwin/express-server";
import { backendPortFor, frontendPortEnvVar, parseFrontendPort } from "@itwin/vitest-browser-bridge/ports";
import { BackendTestCallbacks } from "../common/SideChannels";
import { AttachedInterface, rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";
import { setupIpcTest } from "./ipc";
import { notifyReady } from "./notifyReady";
import { AttachedInterfaceImpl } from "./TestRpcImpl";
import { installBrowserTestRoutes } from "./TestServer";

async function init() {
  const frontendPort = parseFrontendPort(process.env[frontendPortEnvVar], frontendPortEnvVar);
  const port = backendPortFor(frontendPort);

  await commonSetup(registerBackendCallback);
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "websocket");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const webEditServer = new TestWebEditServer(rpcConfig.protocol, readBackendCallbackToken(process.env));
  const httpServer = await webEditServer.initialize(port);

  await LocalhostIpcHost.startup({ localhostIpcHost: { noServer: true } });

  // eslint-disable-next-line no-console
  console.log(`Web backend for rpc full-stack-tests listening on port ${port}`);

  initializeAttachedInterfacesTest(rpcConfig);
  await setupIpcTest(async () => Promise.resolve(), LocalhostIpcHost.socket, registerBackendCallback);
  notifyReady("websocket");

  return () => {
    httpServer.close();
  };
}

class TestWebEditServer extends WebEditServer {
  private readonly _callbackToken: string;

  public constructor(protocol: WebAppRpcProtocol, callbackToken: string) {
    super(protocol);
    this._callbackToken = callbackToken;
  }

  protected override _configureHeaders() {
    super._configureHeaders();
    installBrowserTestRoutes(this._app, this._callbackToken);
  }
}

function initializeAttachedInterfacesTest(config: BentleyCloudRpcConfiguration) {
  AttachedInterfaceImpl.register();
  config.attach(AttachedInterface);
}

module.exports = init();
