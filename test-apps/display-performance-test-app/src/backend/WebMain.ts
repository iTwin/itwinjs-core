/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as fs from "fs";
import * as child_process from "child_process";
import * as chromeLauncher from "chrome-launcher";

import { BentleyCloudRpcManager, IModelTileRpcInterface, SnapshotIModelRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { initializeBackend } from "./backend";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

// tslint:disable:no-console

export function getRpcInterfaces() {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
}

function setupStandaloneConfiguration() {
  const filename = process.env.SVT_STANDALONE_FILENAME;
  if (filename !== undefined) {
    const configuration: any = {};
    configuration.standalone = true;
    configuration.standalonePath = filename;
    configuration.viewName = process.env.SVT_STANDALONE_VIEWNAME; // optional
    configuration.iModelName = filename;
    fs.writeFileSync(path.join(__dirname, "configuration.json"), JSON.stringify(configuration), "utf8");
  }
}

// Start the Express web server
function startWebServer() {
  // set up the express server.
  const appExp = express();
  // Enable CORS for all apis
  appExp.all("/*", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET");
    res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id");
    next();
  });
  // All we do is serve out static files, so We have only the simple public path route.
  // If args.resources is relative, we expect it to be relative to process.cwd
  const resourceRoot = path.resolve(process.cwd(), "./lib/webresources/");
  appExp.use(express.static(resourceRoot));
  appExp.use("*", (_req, resp) => {
    resp.sendFile(path.resolve("./lib/webresources/", "index.html"));
  });
  // Run the server...
  appExp.set("port", 3000);
  const announceWebServer = () => { }; // console.log(`***** WebServer listening on http:localHost:${appExp.get("port")}, resource root is ${resourceRoot}`);
  DisplayPerfRpcInterface.webServer = appExp.listen(appExp.get("port"), announceWebServer);
}

// Initialize the webserver
startWebServer();

// Initialize the backend
initializeBackend();

Logger.setLevelDefault(LogLevel.Error);
Logger.setLevel("imodeljs-clients", LogLevel.Trace);
Logger.setLevel("imodeljs-backend", LogLevel.Trace);
Logger.setLevel("SVT", LogLevel.Trace);

let serverConfig: any;
let browser = "";

process.argv.forEach((arg) => {
  if (arg.split(".").pop() === "json")
    DisplayPerfRpcInterface.jsonFilePath = arg;
  else if (arg === "chrome" || arg === "edge" || arg === "firefox")
    browser = arg;
});

if (serverConfig === undefined) {
  setupStandaloneConfiguration();

  serverConfig = { port: 3001, baseUrl: "https://localhost" };
} else {

}

Logger.logTrace("SVT", `config = ${JSON.stringify(serverConfig)}`);

// Set up the ability to serve the supported rpcInterfaces via web requests
const cloudConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "display-performance-test-app", version: "v1.0" } }, getRpcInterfaces());

const app = express();
app.use(bodyParser.text({ limit: "50mb" }));

// Enable CORS for all apis
app.all("/*", (_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, X-Correlation-Id, X-Session-Id, X-Application-Id, X-Application-Version, X-User-Id");
  next();
});

// --------------------------------------------
// Routes
// --------------------------------------------
app.use(express.static(path.resolve(__dirname, "public")));
app.get("/v3/swagger.json", (req, res) => cloudConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req, res) => cloudConfig.protocol.handleOperationPostRequest(req, res));
app.get(/\/imodel\//, async (req, res) => cloudConfig.protocol.handleOperationGetRequest(req, res));
app.use("*", (_req, res) => { res.send("<h1>IModelJs RPC Server</h1>"); });
app.get("/signin-callback", (_req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

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
  chromeLauncher.launch({ startingUrl: "http://localhost:3000" }).then((val) => { DisplayPerfRpcInterface.chrome = val; }); // tslint:disable-line:no-floating-promises
else if (browser === "firefox")
  child_process.execSync("start firefox http://localhost:3000");
else if (browser === "edge")
  child_process.execSync("start microsoft-edge:http://localhost:3000");
