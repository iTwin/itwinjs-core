/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { AddonRegistry, IModelHost } from "@bentley/imodeljs-backend";
import { TestbedConfig, TestbedIpcMessage } from "../common/TestbedConfig";
import { TestGatewayImpl } from "./TestGatewayImpl";

let pendingsSent = 0;
let pendingResponseQuota = 0;

// tslint:disable-next-line:no-var-requires
const { ipcMain } = require("electron");
ipcMain.on("testbed", (event: any, arg: any) => {
  const msg: TestbedIpcMessage = arg;
  if (msg.name === "pendingResponseQuota") {
    pendingResponseQuota = msg.value;
    pendingsSent = 0;
    event.returnValue = true;
  }
});

// Start the backend
IModelHost.startup();

TestGatewayImpl.register();
TestbedConfig.initializeGatewayConfig();

// tslint:disable-next-line:no-var-requires
AddonRegistry.loadAndRegisterStandardAddon();

if (TestbedConfig.gatewayConfig) {
  const app = express();
  app.use(bodyParser.text());
  app.use(express.static(__dirname + "/public"));
  app.get(TestbedConfig.swaggerURI, (req, res) => TestbedConfig.gatewayConfig.protocol.handleOpenApiDescriptionRequest(req, res));

  app.post("*", (req, res) => {
    if (pendingResponseQuota && pendingsSent < pendingResponseQuota) {
      ++pendingsSent;
      res.status(202).send(`Pending Response #${pendingsSent}`);
      return;
    }

    pendingsSent = 0;
    TestbedConfig.gatewayConfig.protocol.handleOperationPostRequest(req, res);
  });

  app.listen(TestbedConfig.serverPort);
}
