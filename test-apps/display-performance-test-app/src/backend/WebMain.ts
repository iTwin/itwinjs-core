/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as child_process from "child_process";
import * as chromeLauncher from "chrome-launcher";
import * as express from "express";
import * as path from "path";
import { BentleyCloudRpcConfiguration, BentleyCloudRpcManager, IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { initializeBackend } from "./backend";

/* eslint-disable no-console */

export function getRpcInterfaces() {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
}

// Start the Express web server
function startWebServer() {
  // set up the express server.
  const appExp = express();
  // Enable CORS for all apis
  appExp.all("/*", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", BentleyCloudRpcConfiguration.accessControl.allowOrigin);
    res.header("Access-Control-Allow-Methods", BentleyCloudRpcConfiguration.accessControl.allowMethods);
    res.header("Access-Control-Allow-Headers", BentleyCloudRpcConfiguration.accessControl.allowHeaders);
    next();
  });
  // All we do is serve out static files, so We have only the simple public path route.
  // If args.resources is relative, we expect it to be relative to process.cwd
  const resourceRoot = path.resolve(process.cwd(), "./build");
  appExp.use(express.static(resourceRoot));
  appExp.use("*", (_req, resp) => {
    resp.sendFile(path.resolve(resourceRoot, "index.html"));
  });
  // Run the server...
  appExp.set("port", 3000);
  const announceWebServer = () => { };
  DisplayPerfRpcInterface.webServer = appExp.listen(appExp.get("port"), announceWebServer);
}

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  // Initialize the webserver
  startWebServer();

  // Initialize the backend
  await initializeBackend();

  let serverConfig: any;
  let browser = "";
  const chromeFlags: Array<string> = [];

  process.argv.forEach((arg) => {
    if (arg.split(".").pop() === "json")
      DisplayPerfRpcInterface.jsonFilePath = arg;
    else if (arg === "chrome" || arg === "edge" || arg === "firefox")
      browser = arg;
    else if (arg === "headless")
      chromeFlags.push("--headless");
  });

  if (serverConfig === undefined) {
    serverConfig = { port: 3001, baseUrl: "https://localhost" };
  } else {

  }

  // Set up the ability to serve the supported rpcInterfaces via web requests
  const cloudConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "display-performance-test-app", version: "v1.0" } }, getRpcInterfaces());

  const app = express();
  app.use(express.text({ limit: "50mb" }));

  // Enable CORS for all apis
  app.all("/*", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", BentleyCloudRpcConfiguration.accessControl.allowOrigin);
    res.header("Access-Control-Allow-Methods", BentleyCloudRpcConfiguration.accessControl.allowMethods);
    res.header("Access-Control-Allow-Headers", BentleyCloudRpcConfiguration.accessControl.allowHeaders);
    next();
  });

  // --------------------------------------------
  // Routes
  // --------------------------------------------
  app.get("/v3/swagger.json", (req, res) => cloudConfig.protocol.handleOpenApiDescriptionRequest(req, res));
  app.post("*", async (req, res) => cloudConfig.protocol.handleOperationPostRequest(req, res));
  app.get(/\/imodel\//, async (req, res) => cloudConfig.protocol.handleOperationGetRequest(req, res));
  app.use("*", (_req, res) => { res.send("<h1>IModelJs RPC Server</h1>"); });

  // ---------------------------------------------
  // Run the server...
  // ---------------------------------------------
  app.set("port", serverConfig.port);
  const announce = () => console.log(`***** Display Performance Testing App listening on ${serverConfig.baseUrl}:${app.get("port")}`);

  DisplayPerfRpcInterface.backendServer = app.listen(app.get("port"), announce);

  // ---------------------------------------------
  // Start the browser, if given a specific one
  // ---------------------------------------------
  if (browser === "chrome")
    chromeLauncher.launch({ // eslint-disable-line @typescript-eslint/no-floating-promises
      startingUrl: "http://localhost:3000",
      chromeFlags,
    }).then((val) => { DisplayPerfRpcInterface.chrome = val; });
  else if (browser === "firefox")
    child_process.execSync("start firefox http://localhost:3000");
  else if (browser === "edge")
    child_process.execSync("start microsoft-edge:http://localhost:3000");
})();
