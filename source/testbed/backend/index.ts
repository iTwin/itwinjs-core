/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as express from "express";
import * as bodyParser from "body-parser";
import { IModelDb } from "$(backend)/lib/backend/IModelDb";
import { IModelGateway } from "$(backend)/lib/gateway/IModelGateway";
import { BentleyCloudGatewayConfiguration } from "$(backend)/lib/gateway/BentleyCloudGatewayConfiguration";
import { NodeAddonRegistry, NodeAddonPackageName } from "$(backend)/lib/backend/NodeAddonRegistry";
import * as testbedConfig from "../config";

IModelDb; // Signal usage of IModelDb to tsc import logic
const gatewaysConfig = BentleyCloudGatewayConfiguration.initialize(testbedConfig.gatewayParams, [IModelGateway]);

// tslint:disable-next-line:no-var-requires
const addon = require(NodeAddonPackageName.computeDefaultImodelNodeAddonName());
NodeAddonRegistry.registerAddon(addon);

const app = express();
app.use(bodyParser.text());
app.get(testbedConfig.swaggerURI, (req, res) => gatewaysConfig.protocol.handleOpenApiDescriptionRequest(req, res));
app.post("*", async (req, res) => gatewaysConfig.protocol.handleOperationPostRequest(req, res));
app.listen(testbedConfig.serverPort);
