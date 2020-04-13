/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as express from "express";
import * as https from "https";
import * as fs from "fs";

import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { Logger } from "@bentley/bentleyjs-core";
import { getRpcInterfaces, initializeBackend } from "./backend";

// tslint:disable:no-console

// Initialize the backend
initializeBackend();

let serverConfig: any;
let serverOptions: any;
if (process.argv.length === 3) {
  Logger.logTrace("SVT", `reading server config from ${process.argv[2]}`);

  try {
    // tslint:disable-next-line:no-var-requires
    serverConfig = require(process.argv[2]);
    serverOptions = {
      key: fs.readFileSync(serverConfig.keyFile),
      cert: fs.readFileSync(serverConfig.certFile),
    };
  } catch (_err) { }
}

if (serverConfig === undefined)
  serverConfig = { port: 3001, baseUrl: "https://localhost" };

Logger.logTrace("SVT", `config = ${JSON.stringify(serverConfig)}`);

// Set up the ability to serve the supported rpcInterfaces via web requests
const cloudConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "display-test-app", version: "v1.0" } }, getRpcInterfaces("browser"));

const app = express();
app.use(express.text());

// Enable CORS for all apis
app.all("/*", (_req: any, res: any, next: any) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id, X-Session-Id, X-Application-Id, X-Application-Version, X-User-Id");
  next();
});

// --------------------------------------------
// Routes
// --------------------------------------------
app.get("/v3/swagger.json", (req: any, res: any) => cloudConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req: any, res: any) => cloudConfig.protocol.handleOperationPostRequest(req, res));
app.get(/\/imodel\//, async (req: any, res: any) => cloudConfig.protocol.handleOperationGetRequest(req, res));
app.use("*", (_req: any, res: any) => { res.send("<h1>IModelJs RPC Server</h1>"); });

// ---------------------------------------------
// Run the server...
// ---------------------------------------------
app.set("port", serverConfig.port);

const announce = () => console.log(`***** display-test-app listening on ${serverConfig.baseUrl}:${app.get("port")}`);

if (serverOptions === undefined) {
  app.listen(app.get("port"), announce);
} else {
  https.createServer(serverOptions, app).listen(app.get("port"), announce);
}
