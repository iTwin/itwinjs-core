/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import "./RpcImpl";
import * as path from "path";
import { BentleyLoggerCategory, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";
import { IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import { BackendLoggerCategory, IModelHostConfiguration, NativeLoggerCategory } from "@bentley/imodeljs-backend";
import { RpcConfiguration } from "@bentley/imodeljs-common";
import { ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";

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
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  RpcConfiguration.developmentMode = true;

  // Bootstrap the cloud environment
  await CloudEnv.initialize();

  // Start the backend
  const iModelHost = new IModelHostConfiguration();
  iModelHost.imodelClient = CloudEnv.cloudEnv.imodelClient;
  iModelHost.concurrentQuery.concurrent = 2;
  iModelHost.concurrentQuery.pollInterval = 5;
  iModelHost.cacheDir = path.join(__dirname, "out");
  await ElectronHost.startup({ electronHost: { rpcInterfaces }, iModelHost });
}
module.exports = init();
