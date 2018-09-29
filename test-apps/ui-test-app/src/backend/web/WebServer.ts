/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console
import * as express from "express";
import * as bodyParser from "body-parser";
import { RpcInterfaceDefinition, BentleyCloudRpcManager } from "@bentley/imodeljs-common";

/**
 * Initializes Web Server backend
 */
export default function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell BentleyCloudRpcManager which RPC interfaces to handle
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "ui-test-app", version: "v1.0" } }, rpcs);

  // create a basic express web server
  const app = express();
  app.use(bodyParser.text());

  // enable CORS for all apis
  app.all("/*", (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });

  // routes
  app.get("/v3/swagger.json", (req, res) => rpcConfig.protocol.handleOpenApiDescriptionRequest(req, res));
  app.post("*", async (req, res) => rpcConfig.protocol.handleOperationPostRequest(req, res));

  app.set("port", process.env.PORT || 5000);
  app.listen(app.get("port"), () => console.log("Web backend for ui-test-app listening on port " + app.get("port")));
}
