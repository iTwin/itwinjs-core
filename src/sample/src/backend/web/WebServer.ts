import * as express from "express";
import * as bodyParser from "body-parser";
import { IModelGateway, BentleyCloudGatewayConfiguration } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition as ECPresentationGateway } from "@bentley/ecpresentation-common";
import SampleGateway from "../SampleGateway";

declare namespace global {
  const webpackDevServer: express.Application | undefined;
}

export function setupWebServer(app: express.Application) {

  const gatewaysConfig = BentleyCloudGatewayConfiguration.initialize({ info: { title: "my-app", version: "v1.0" } },
    [IModelGateway, ECPresentationGateway, SampleGateway]);

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
  app.listen(app.get("port"), () => console.log("Serving static resources for MyApp on port " + app.get("port")));
}
