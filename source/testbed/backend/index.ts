/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { IModelDb } from "$(common)/lib/backend/IModelDb";
import { IModelGateway } from "$(common)/lib/gateway/IModelGateway";
import { BentleyCloudGatewayConfiguration } from "$(common)/lib/gateway/BentleyCloudGatewayConfiguration";
import { NodeAddonRegistry, NodeAddonPackageName } from "$(common)/lib/backend/NodeAddonRegistry";
import { TestbedConfig } from "../common/TestbedConfig";
import { TestGateway } from "../common/TestGateway";
import { TestGatewayImpl } from "./TestGatewayImpl";

IModelDb; // Signal usage of IModelDb to tsc import logic
TestGatewayImpl.register();
const gatewaysConfig = BentleyCloudGatewayConfiguration.initialize(TestbedConfig.gatewayParams, [IModelGateway, TestGateway]);

// tslint:disable-next-line:no-var-requires
const addon = require(NodeAddonPackageName.computeDefaultImodelNodeAddonName());
NodeAddonRegistry.registerAddon(addon);

const app = express();
app.use(bodyParser.text());
app.get(TestbedConfig.swaggerURI, (req, res) => gatewaysConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req, res) => gatewaysConfig.protocol.handleOperationPostRequest(req, res));
app.listen(TestbedConfig.serverPort);
