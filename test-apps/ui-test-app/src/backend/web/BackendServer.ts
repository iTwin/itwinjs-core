/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console
import * as express from "express";
import { RpcInterfaceDefinition, BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { IModelJsExpressServer } from "@bentley/imodeljs-backend";

/* ---- not used with separate web and RPC server
import * as path from "path";

class UITestExpressServer extends IModelJsExpressServer {
  protected _configureRoutes() {
    super._configureRoutes();
    // server out our static files (locale files, javascript files, icons, etc. from the ../public directory/)
    const publicDir = path.resolve(__dirname, "../public");
    this._app.use(express.static(publicDir));
    this._app.use("*", (_req, resp) => { resp.sendFile(path.resolve(publicDir, "index.html")); });
  }
}
--------------------------------------------------------*/

/**
 * Initializes Web Server backend
 */
export default async function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell BentleyCloudRpcManager which RPC interfaces to handle
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "ui-test-app", version: "v1.0" } }, rpcs);

  // create a basic express web server
  const port = Number(process.env.PORT || 3001);
  const app = express();
  const server = new IModelJsExpressServer(app, rpcConfig.protocol);
  await server.initialize(port);
  console.log("Web backend for ui-test-app listening on port " + port);
}
