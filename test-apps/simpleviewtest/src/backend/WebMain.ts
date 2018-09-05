import * as path from "path";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as cp from "child_process";
import * as fs from "fs";

import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { Config } from "@bentley/imodeljs-clients";
import { IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { initializeBackend } from "./backend";

// tslint:disable:no-console

export function getRpcInterfaces() {
  return [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
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

// Initialize the backend
initializeBackend();

// Start the dev-cors-proxy-server
const proxyServer = cp.spawn("node", ["./node_modules/@bentley/dev-cors-proxy-server/server.js", "--serve-over-https"]);
proxyServer.stdout.on("data", (data) => {
  console.log(`proxy server: ${data}`);
});
proxyServer.stderr.on("data", (data) => {
  console.log(`proxy server: ${data}`);
});
proxyServer.on("close", (code) => {
  console.log(`proxy server terminated with code ${code}`);
});

// Initialize additional web-specific backend parts
Config.devCorsProxyServer = "https://localhost:3001";
setupStandaloneConfiguration();
Logger.setLevelDefault(LogLevel.Error);
Logger.setLevel("imodeljs-clients", LogLevel.Trace);
Logger.setLevel("imodeljs-backend", LogLevel.Trace);

// Set up the ability to serve the supported rpcInterfaces via web requests
const cloudConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "SimpleViewApp", version: "v1.0" } }, getRpcInterfaces());

const app = express();
app.use(bodyParser.text());

// Enable CORS for all apis
app.all("/*", (_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, X-Requested-With");
  next();
});

// --------------------------------------------
// Routes
// --------------------------------------------
app.use(express.static(path.resolve(__dirname, "public")));
app.get("/v3/swagger.json", (req, res) => cloudConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req, res) => cloudConfig.protocol.handleOperationPostRequest(req, res));

// ---------------------------------------------
// Run the server...
// ---------------------------------------------
app.set("port", 3000);
// tslint:disable-next-line:no-console
app.listen(app.get("port"), () => console.log("***** SimpleViewTest running on localhost:" + app.get("port")));
