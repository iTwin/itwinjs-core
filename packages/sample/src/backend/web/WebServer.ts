import * as express from "express";
import * as bodyParser from "body-parser";
import { BentleyCloudRpcManager, StandaloneIModelRpcInterface, IModelReadRpcInterface, IModelTileRpcInterface } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import SampleRpcInterface from "../../common/SampleRpcInterface";

declare namespace global {
  const webpackDevServer: express.Application | undefined;
}

export function setupWebServer(app: express.Application) {

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "my-app", version: "v1.0" } },
    [StandaloneIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, IModelTileRpcInterface, SampleRpcInterface]);

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
  app.get("/v3/swagger.json", (req, res) => rpcConfig.protocol.handleOpenApiDescriptionRequest(req, res));
  app.post("*", async (req, res) => rpcConfig.protocol.handleOperationPostRequest(req, res));
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
  app.listen(app.get("port"), () => console.log("Serving static resources for MyApp on port " + app.get("port")));
}
