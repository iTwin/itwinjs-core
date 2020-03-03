/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { IModelJsExpressServer } from "@bentley/express-server";
import { BentleyCloudRpcManager, ElectronRpcConfiguration, ElectronRpcManager, RpcConfiguration } from "@bentley/imodeljs-common";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { rpcInterfaces } from "../common/RpcInterfaces";

import { exposeBackendCallbacks } from "../common/SideChannels";

// tslint:disable no-console

IModelJsConfig.init(true, true, Config.App);
RpcConfiguration.developmentMode = true;

// Start the backend
const hostConfig = new IModelHostConfiguration();
hostConfig.concurrentQuery.concurrent = 2;
hostConfig.concurrentQuery.pollInterval = 5;
IModelHost.startup(hostConfig);

Logger.initializeToConsole();
Logger.setLevel("imodeljs-backend.IModelReadRpcImpl", LogLevel.Error);  // Change to trace to debug
Logger.setLevel("imodeljs-backend.IModelDb", LogLevel.Error);  // Change to trace to debug
Logger.setLevel("Performance", LogLevel.Error);  // Change to Info to capture

async function init() {
  await signin();

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

async function signin() {
  // Handle OIDC signin
  console.log("Starting OIDC signin...");
  console.time("Finished OIDC signin in");

  const accessTokens = new Array<AccessToken>();
  const clientId = Config.App.get("imjs_oidc_browser_test_client_id");

  if (undefined !== clientId) {

    // Only getting the token for the `imjs_test_regular_user_name` user.
    // This request is dependent on the following environment variables:
    //    - `imjs_oidc_browser_test_client_id`
    //    - `imjs_oidc_browser_test_redirect_uri`
    //    - `imjs_oidc_browser_test_scopes`

    const token = await TestUtility.getAccessToken(TestUsers.regular);
    if (undefined === token)
      throw new Error("Failed to get access token");
    accessTokens.push(token);
  }
  console.timeEnd("Finished OIDC signin in");

  exposeBackendCallbacks(accessTokens);
}

module.exports = init();
