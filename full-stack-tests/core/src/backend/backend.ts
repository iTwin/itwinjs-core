/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./RpcImpl";
// Sets up certa to allow a method on the frontend to get an access token
import "@bentley/oidc-signin-tool/lib/certa/certaBackend";
import * as http from "http";
import * as path from "path";
import serveHandler = require("serve-handler");
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelJsExpressServer } from "@bentley/express-server";
import { FileNameResolver, IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { BentleyCloudRpcManager, ElectronRpcConfiguration, ElectronRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";
import { EditCommandAdmin } from "@bentley/imodeljs-editor-backend";
import * as testCommands from "./TestEditCommands";

/* eslint-disable no-console */

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
  await IModelHost.startup(hostConfig);
  IModelHost.snapshotFileNameResolver = new BackendTestAssetResolver();

  Logger.initializeToConsole();
  Logger.setLevel("imodeljs-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("imodeljs-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture
  Logger.setLevel("imodeljs-backend.ConcurrencyControl", LogLevel.Error);

  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeImpl({}, rpcInterfaces);
    EditCommandAdmin.registerModule(testCommands);
  } else {
    const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);

    // create a basic express web server
    const port = Number(process.env.CERTA_PORT || 3011) + 2000;
    const server = new IModelJsExpressServer(rpcConfig.protocol);
    await server.initialize(port);
    console.log(`Web backend for full-stack-tests listening on port ${port}`);

    await new Promise((resolve) => {
      http.createServer(async (request, response) => {
        return serveHandler(request, response, {
          cleanUrls: false,
          public: "lib",
          headers: [{ source: "*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }],
        });
      }).listen(Number(process.env.CERTA_PORT ?? 3011) + 3000, undefined, undefined, resolve);
    });
  }
}

/** A FileNameResolver for resolving test iModel files from core/backend */
class BackendTestAssetResolver extends FileNameResolver {
  /** Resolve a base file name to a full path file name in the core/backend/lib/test/assets/ directory. */
  public tryResolveFileName(inFileName: string): string {
    if (path.isAbsolute(inFileName)) {
      return inFileName;
    }
    return path.join(__dirname, "../../../../core/backend/lib/test/assets/", inFileName);
  }
  /** Resolve a key (for testing FileNameResolver) */
  public tryResolveKey(fileKey: string): string | undefined {
    switch (fileKey) {
      case "test-key": return this.tryResolveFileName("test.bim");
      case "test2-key": return this.tryResolveFileName("test2.bim");
      default: return undefined;
    }
  }
}

module.exports = init();
