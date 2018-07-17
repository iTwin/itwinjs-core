import * as express from "express";
import * as bodyParser from "body-parser";
import * as cp from "child_process";

import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { Config } from "@bentley/imodeljs-clients";
import { IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";

// tslint:disable:no-console

export function getRpcInterfaces() {
  return [IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
}

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

// Initialize backend functionality and logging
Config.devCorsProxyServer = "https://localhost:3001";
IModelHost.startup();
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Error);
Logger.setLevel("imodeljs-clients", LogLevel.Trace);

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
app.use(express.static(__dirname));
app.get("/v3/swagger.json", (req, res) => cloudConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req, res) => cloudConfig.protocol.handleOperationPostRequest(req, res));

// ---------------------------------------------
// Run the server...
// ---------------------------------------------
app.set("port", 3000);
// tslint:disable-next-line:no-console
app.listen(app.get("port"), () => console.log("SimpleViewTest running on localhost:" + app.get("port")));
