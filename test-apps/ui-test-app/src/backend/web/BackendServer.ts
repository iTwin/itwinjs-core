/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console
import { IModelError, IModelStatus, RpcInterfaceDefinition, BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { IModelJsExpressServer } from "@bentley/express-server";
import { Logger, LogLevel, EnvMacroSubst } from "@bentley/bentleyjs-core";
import { BunyanLoggerConfig, SeqLoggerConfig } from "@bentley/logger-config";

const loggerCategory = "ui-test-app";

// Setup to log to a locally install seq server from https://datalust.co/download
const defaultConfigValues = {
  "TESTAPP-SEQ-URL": "http://localhost",
  "TESTAPP-SEQ-PORT": 5341,
  "TESTAPP-API-KEY": "InvalidApiKey",
};

/** Initializes logging based on the configuration json file */
export function initializeLogging() {
  const config: any = require("./BackendServer.config.json");
  EnvMacroSubst.replaceInProperties(config, true, defaultConfigValues);

  if ("seq" in config) {
    if (EnvMacroSubst.anyPropertyContainsEnvvars(config.seq, true))
      throw new IModelError(IModelStatus.NotFound, "Unmatched environment variables in 'seq' element in BackendServer.config.json.", Logger.logError, loggerCategory, () => config.seq);
    BunyanLoggerConfig.logToBunyan(SeqLoggerConfig.createBunyanSeqLogger(config.seq, loggerCategory));
  } else {
    Logger.initializeToConsole();

  }

  Logger.setLevelDefault(LogLevel.Error);
  if ("loggerConfig" in config)
    Logger.configureLevels(config.loggerConfig);
}

/**
 * Initializes Web Server backend
 */
export default async function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell BentleyCloudRpcManager which RPC interfaces to handle
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "ui-test-app", version: "v1.0" } }, rpcs);

  // create a basic express web server
  const port = Number(process.env.PORT || 3001);
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  console.log("Web backend for ui-test-app listening on port " + port);
}
