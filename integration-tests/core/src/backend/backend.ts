/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { Config } from "@bentley/imodeljs-clients";
import { IModelJsExpressServer } from "@bentley/express-server";
import { BentleyCloudRpcManager, ElectronRpcConfiguration, ElectronRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import "./RpcImpl";

IModelJsConfig.init(true, true, Config.App);
RpcConfiguration.developmentMode = true;

// Start the backend
const hostConfig = new IModelHostConfiguration();
IModelHost.startup(hostConfig);

Logger.initializeToConsole();
Logger.setLevel("imodeljs-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
Logger.setLevel("imodeljs-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture

async function init() {
  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeImpl({}, rpcInterfaces);
  } else {
    const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "integration-test", version: "v1.0" } }, rpcInterfaces);

    // create a basic express web server
    const port = Number(process.env.CERTA_PORT || 3011) + 2000;
    const server = new IModelJsExpressServer(rpcConfig.protocol);
    await server.initialize(port);
    // tslint:disable-next-line:no-console
    console.log("Web backend for integration-tests listening on port " + port);
  }
}

module.exports = init();
