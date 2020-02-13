/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// Sets up a local backend to be used for testing within the iModel.js repo.

import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config } from "@bentley/imodeljs-clients";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { IModelJsExpressServer } from "@bentley/express-server";
import { BentleyCloudRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { Presentation as PresentationBackend } from "@bentley/presentation-backend";

import { Settings, getRpcInterfaces } from "../common/Settings";

IModelJsConfig.init(true, true, Config.App);
const settings = new Settings(process.env);

// tslint:disable-next-line:no-floating-promises
(async () => {
  RpcConfiguration.developmentMode = true;

  // Start the backend
  const hostConfig = new IModelHostConfiguration();
  hostConfig.concurrentQuery.concurrent = 2;
  hostConfig.concurrentQuery.pollInterval = 5;
  IModelHost.startup(hostConfig);

  PresentationBackend.initialize();

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, getRpcInterfaces(settings));

  // create a basic express web server
  const port = 5011;
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  // tslint:disable-next-line:no-console
  console.log("Web backend for full-stack-tests listening on port " + port);
})();
