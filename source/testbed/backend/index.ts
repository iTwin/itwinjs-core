/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { IModelDb } from "@build/imodeljs-core/lib/backend/IModelDb";
import { NodeAddonRegistry, NodeAddonPackageName } from "@build/imodeljs-core/lib/backend/NodeAddonRegistry";
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

IModelDb; // Signal usage of IModelDb to tsc import logic
TestGatewayImpl.register();
TestbedConfig.initializeGatewayConfig();

// tslint:disable-next-line:no-var-requires
const addon = require(NodeAddonPackageName.computeDefaultImodelNodeAddonName());
NodeAddonRegistry.registerAddon(addon);

const app = express();
app.use(bodyParser.text());
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
