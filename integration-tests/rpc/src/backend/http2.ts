/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as spdy from "spdy";
import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { IModelJsExpressServer } from "@bentley/express-server";

import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import "./CommonBackendSetup";

registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "http2");

async function init() {
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "integration-test", version: "v1.0" } }, rpcInterfaces);
  // create a basic express web server
  const port = Number(process.env.CERTA_PORT || 3021) + 2000;
  const server = new IModelJsHttp2ExpressServer(rpcConfig.protocol);
  await server.initialize(port, {
    key: fs.readFileSync(path.join(__dirname, "../../local_dev_server.key")),
    cert: fs.readFileSync(path.join(__dirname, "../../local_dev_server.crt")),
  });
  // tslint:disable-next-line:no-console
  console.log("HTTP2 Web backend for integration-tests listening on port " + port);
}

export class IModelJsHttp2ExpressServer extends IModelJsExpressServer {
  public async initialize(port: number | string, options?: https.ServerOptions): Promise<https.Server> {
    const spdyOptions: spdy.server.ServerOptions = {
      ...options,
      spdy: {
        protocols: ["h2"],
      },
    };

    this._configureMiddleware();
    this._configureHeaders();
    this._configureRoutes();

    this._app.set("port", port);
    const server: https.Server = spdy.createServer(spdyOptions, this._app);
    await new Promise((resolve) => server.listen(this._app.get("port"), resolve));
    return server;
  }
}

module.exports = init();
