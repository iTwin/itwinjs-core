/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { IModelJsExpressServer } from "@bentley/express-server";
import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { commonSetup } from "./CommonBackendSetup";

async function init() {
  await commonSetup();
  registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http");

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-full-stack-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const port = Number(process.env.CERTA_PORT || 3021) + 2000;
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  // tslint:disable-next-line:no-console
  console.log("Web backend for full-stack-tests listening on port " + port);
}

module.exports = init();
