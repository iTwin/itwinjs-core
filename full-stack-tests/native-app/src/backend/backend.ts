/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyLoggerCategory, Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelJsExpressServer } from "@bentley/express-server";
import { IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import { BackendLoggerCategory, IModelHostConfiguration, NativeAppBackend, NativeLoggerCategory } from "@bentley/imodeljs-backend";
import { BentleyCloudRpcManager, ElectronRpcConfiguration, ElectronRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { ITwinClientLoggerCategory } from "@bentley/itwin-client";
// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import * as path from "path";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";
import "./RpcImpl";
/* eslint-disable no-console */

function initDebugLogLevels(reset?: boolean) {
  Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
  Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
  Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(BackendLoggerCategory.ConcurrencyControl, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(ITwinClientLoggerCategory.Clients, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(ITwinClientLoggerCategory.Request, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.Licensing, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.ECDb, reset ? LogLevel.Error : LogLevel.Trace);
  Logger.setLevel(NativeLoggerCategory.ECObjectsNative, reset ? LogLevel.Error : LogLevel.Trace);
}

export function setupDebugLogLevels() {
  initDebugLogLevels(false);
}

async function init() {
  IModelJsConfig.init(true, true, Config.App);

  RpcConfiguration.developmentMode = true;

  // Bootstrap the cloud environment
  await CloudEnv.initialize();

  // Start the backend
  const hostConfig = new IModelHostConfiguration();
  hostConfig.imodelClient = CloudEnv.cloudEnv.imodelClient;
  hostConfig.concurrentQuery.concurrent = 2;
  hostConfig.concurrentQuery.pollInterval = 5;
  hostConfig.cacheDir = path.join(__dirname, "out");
  await NativeAppBackend.startup(hostConfig);

  Logger.initializeToConsole();
  // setupDebugLogLevels();

  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeImpl({}, rpcInterfaces);
  } else {
    const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);

    // create a basic express web server
    const port = Number(process.env.CERTA_PORT || 3011) + 2000;
    const server = new IModelJsExpressServer(rpcConfig.protocol);
    await server.initialize(port);
    console.log(`Web backend for full-stack-tests listening on port ${port}`);
  }
}

module.exports = init();
