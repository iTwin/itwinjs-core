/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { NativeAppBackend, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { IModelJsExpressServer } from "@bentley/express-server";
import { BentleyCloudRpcManager, ElectronRpcConfiguration, ElectronRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { TestUserCredentials, TestUtility } from "@bentley/oidc-signin-tool";
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

import { rpcInterfaces } from "../common/RpcInterfaces";
import { getTokenCallbackName, serializeToken } from "../common/SideChannels";
import "./RpcImpl";
import { CloudEnv } from "./cloudEnv";

// tslint:disable:no-console

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
  NativeAppBackend.startup(hostConfig);

  Logger.initializeToConsole();
  Logger.setLevel("imodeljs-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("imodeljs-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
  Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture
  Logger.setLevel("imodeljs-backend.ConcurrencyControl", LogLevel.Trace);

  if (ElectronRpcConfiguration.isElectron) {
    ElectronRpcManager.initializeImpl({}, rpcInterfaces);
  } else {
    const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, rpcInterfaces);

    // create a basic express web server
    const port = Number(process.env.CERTA_PORT || 3011) + 2000;
    const server = new IModelJsExpressServer(rpcConfig.protocol);
    await server.initialize(port);
    console.log("Web backend for full-stack-tests listening on port " + port);
  }
}

async function signin(user: TestUserCredentials): Promise<AccessToken> {
  // Handle OIDC signin
  console.log("Starting OIDC signin...");
  console.time("Finished OIDC signin in");

  const clientId = Config.App.get("imjs_oidc_browser_test_client_id");

  if (undefined === clientId)
    throw new Error("Invalid or missing client id.  Please set 'imjs_oidc_browser_test_client_id' to a valid client.");

  // Only getting the token for the `imjs_test_regular_user_name` user.
  // This request is dependent on the following environment variables:
  //    - `imjs_oidc_browser_test_client_id`
  //    - `imjs_oidc_browser_test_redirect_uri`
  //    - `imjs_oidc_browser_test_scopes`

  const token = await TestUtility.getAccessToken(user);
  if (undefined === token)
    throw new Error("Failed to get access token");

  console.timeEnd("Finished OIDC signin in");

  return token;
}

registerBackendCallback(getTokenCallbackName, async (user: any): Promise<string> => {
  const accessToken = await signin(user);
  return JSON.stringify(serializeToken(accessToken));
});

module.exports = init();
