/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { IModelJsExpressServer } from "@bentley/imodeljs-backend";
import * as express from "express";

import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import "./CommonBackendSetup";

registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http");

async function init() {
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "rpc-integration-test", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const port = Number(process.env.PORT || 3021);
  const app = express();
  const server = new IModelJsExpressServer(app, rpcConfig.protocol);
  await server.initialize(port);
  // tslint:disable-next-line:no-console
  console.log("Web backend for integration-tests listening on port " + port);
}

module.exports = init();
