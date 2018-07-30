/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { IModelTileRpcInterface, IModelReadRpcInterface, BentleyCloudRpcManager } from "@bentley/imodeljs-common";

// FIXME: I have to use require here because no type definitions are being published for this module:
// tslint:disable-next-line:no-var-requires
// const { GatewayRegistry } = require("@bentley/imodeljs-common/lib/gateway/core/GatewayRegistry");

declare namespace global {
  const webpackDevServer: express.Application | undefined;
}

export function setupWebServer(app: express.Application) {

  const gatewaysConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "protogist", version: "v1.0" } },
    [IModelTileRpcInterface, IModelReadRpcInterface]);

  app.use(bodyParser.text());

  // Enable CORS for all apis
  app.all("/*", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });

  // ---------------------------------------------
  // Routes
  // ---------------------------------------------
  app.get("/v3/swagger.json", (req, res) => gatewaysConfig.protocol.handleOpenApiDescriptionRequest(req, res));
  app.post("*", async (req, res) => gatewaysConfig.protocol.handleOperationPostRequest(req, res));
}

if (global.webpackDevServer) {
  setupWebServer(global.webpackDevServer);
} else {
  const app = express();
  setupWebServer(app);

  app.use(express.static(__dirname));

  // ---------------------------------------------
  // Run the server...
  // ---------------------------------------------
  app.set("port", process.env.PORT || 3000);
  // tslint:disable-next-line:no-console
  app.listen(app.get("port"), () => console.log("Serving static resources for Protogist on port " + app.get("port")));
}
