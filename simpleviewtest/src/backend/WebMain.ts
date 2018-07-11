import * as express from "express";
import * as fs from "fs";
import * as bodyParser from "body-parser";
import * as cp from "child_process";

import { BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { Config } from "@bentley/imodeljs-clients/lib";
import { initializeBackend, getRpcInterfaces } from "./common";

// tslint:disable:no-console

// Start the dev-cors-proxy-server
const proxyServer = cp.spawn("node", ["./node_modules/@bentley/dev-cors-proxy-server/server.js"]);
proxyServer.stdout.on("data", (data) => {
  console.log(`proxy server: ${data}`);
});
proxyServer.stderr.on("data", (data) => {
  console.log(`proxy server: ${data}`);
});
proxyServer.on("close", (code) => {
  console.log(`proxy server terminated with code ${code}`);
});

// tslint:disable

// Store SVT settings in the configuration.json file, which will be read by the application
const configuration = {
  userName: "bistroDEV_pmadm1@mailinator.com",
  password: "pmadm1",
  projectName: "plant-sta",
  iModelName: "NabeelQATestiModel",
};
const filename = process.env.SVT_STANDALONE_FILENAME;
if (filename !== undefined) {
  configuration.iModelName = filename;
  (configuration as any).viewName = process.env.SVT_STANDALONE_VIEWNAME; // optional
  (configuration as any).standalonePath = process.env.SVT_STANDALONE_FILEPATH; // optional
  (configuration as any).standalone = true;
}
fs.writeFileSync("./lib/backend/public/configuration.json", JSON.stringify(configuration), "utf8");

// Initialize backend functionality and logging
Config.devCorsProxyServer = "http://localhost:3001";
initializeBackend();
const rpcInterfaces = getRpcInterfaces();

// Set up the ability to serve the supported rpcInterfaces via web requests
const cloudConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "SimpleViewApp", version: "v1.0" } }, rpcInterfaces);

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