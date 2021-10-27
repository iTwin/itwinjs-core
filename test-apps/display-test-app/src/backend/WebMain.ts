/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as enableWs from "express-ws";
import { Logger } from "@itwin/core-bentley";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager } from "@itwin/core-common";
import { getRpcInterfaces, initializeDtaBackend } from "./Backend";
import { LocalhostIpcHost } from "@itwin/core-backend";

/* eslint-disable no-console */

// function called when we start the backend webserver
const dtaWebMain = (async () => {
  // Initialize our backend
  await initializeDtaBackend();

  let serverConfig: any;
  let serverOptions: any;
  if (process.argv.length === 3) {
    Logger.logTrace("SVT", `reading server config from ${process.argv[2]}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
  const cloudConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "display-test-app", version: "v1.0" } }, getRpcInterfaces());

  const app = express();
  enableWs(app);
  app.use(express.text());

  // Enable CORS for all apis
  app.all("/*", (_req: any, res: any, next: any) => {
    res.header("Access-Control-Allow-Origin", BentleyCloudRpcConfiguration.accessControl.allowOrigin);
    res.header("Access-Control-Allow-Methods", BentleyCloudRpcConfiguration.accessControl.allowMethods);
    res.header("Access-Control-Allow-Headers", BentleyCloudRpcConfiguration.accessControl.allowHeaders);
    next();
  });

  // --------------------------------------------
  // Routes
  // --------------------------------------------
  (app as any).ws("/ipc", (ws: any, _req: any) => LocalhostIpcHost.connect(ws));
  app.get("/v3/swagger.json", (req: any, res: any) => cloudConfig.protocol.handleOpenApiDescriptionRequest(req, res));
  app.post("*", async (req: any, res: any) => cloudConfig.protocol.handleOperationPostRequest(req, res));
  app.get(/\/imodel\//, async (req: any, res: any) => cloudConfig.protocol.handleOperationGetRequest(req, res));
  app.use("/tiles", express.static(path.join(__dirname, "tiles"), {
    fallthrough: false,
    index: false,
  }));
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
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
dtaWebMain();
