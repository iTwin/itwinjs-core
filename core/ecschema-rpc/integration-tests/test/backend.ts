/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Sets up a local backend to be used for testing within the iModel.js repo.

import { Config } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelJsExpressServer } from "@bentley/express-server";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { BentleyCloudRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { getRpcInterfaces } from "../common/Settings";

IModelJsConfig.init(true, true, Config.App);

// tslint:disable-next-line:no-floating-promises
(async () => {
  RpcConfiguration.developmentMode = true;

  // Start the backend
  const hostConfig = new IModelHostConfiguration();
  hostConfig.concurrentQuery.concurrent = 2;
  hostConfig.concurrentQuery.pollInterval = 5;
  await IModelHost.startup(hostConfig);

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "schema-rpc-test", version: "v1.0" } }, getRpcInterfaces());

  // create a basic express web server
  const port = 5011;
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  // tslint:disable-next-line:no-console
  console.log("Web backend for schema-rpc-tests listening on port " + port);
})();
